import path from 'node:path'
import url from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import ts from 'typescript'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

import { vorzelaRoutesPlugin } from './scripts/generate-routes'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROUTE_FILE_PATTERN = /src[\\/]routes[\\/].*\.(ts|tsx)$/u
const SERVER_ONLY_MODULE_PATTERN = /(?:^|[\\/])\.server(?:[\\/]|$)|\.server(?:$|\.)/u
const SOURCE_ROOT = path.resolve(__dirname, 'src')

const ROUTE_SERVER_PROPERTY_NAMES = new Set(['loader', 'beforeLoad', 'validateSearch'])

type TextRange = {
  end: number
  start: number
}

function stripQuerySuffix(value: string) {
  const queryIndex = value.indexOf('?')
  return queryIndex === -1 ? value : value.slice(0, queryIndex)
}

function isRouteFileId(id: string) {
  return ROUTE_FILE_PATTERN.test(stripQuerySuffix(id))
}

function isServerOnlyModuleSpecifier(specifier: string) {
  return SERVER_ONLY_MODULE_PATTERN.test(specifier)
}

function isProjectSourceFile(id: string) {
  const normalizedId = stripQuerySuffix(id)
  return normalizedId.startsWith(`${SOURCE_ROOT}${path.sep}`)
}

function formatRelativeId(id: string) {
  return path.relative(__dirname, stripQuerySuffix(id)) || stripQuerySuffix(id)
}

function getObjectLiteralElementName(property: ts.ObjectLiteralElementLike) {
  if (!('name' in property)) {
    return null
  }

  return getPropertyNameText(property.name)
}

function getPropertyNameText(name: ts.PropertyName | undefined) {
  if (!name) {
    return null
  }

  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text
  }

  return null
}

function getBindingNames(name: ts.BindingName, names: string[] = []) {
  if (ts.isIdentifier(name)) {
    names.push(name.text)
    return names
  }

  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) {
      getBindingNames(element.name, names)
    }
  }

  return names
}

function getTopLevelStatementBindingNames(statement: ts.Statement) {
  if (ts.isFunctionDeclaration(statement) && statement.name) {
    return [statement.name.text]
  }

  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) => getBindingNames(declaration.name))
  }

  return []
}

function isNodeWithinRanges(node: ts.Node, sourceFile: ts.SourceFile, ranges: TextRange[]) {
  const start = node.getStart(sourceFile)
  return ranges.some((range) => start >= range.start && node.end <= range.end)
}

function isIdentifierReference(node: ts.Identifier) {
  const parent = node.parent

  if (
    (ts.isPropertyAssignment(parent) && parent.name === node && parent.initializer !== node)
    || (ts.isShorthandPropertyAssignment(parent) && parent.name === node && parent.objectAssignmentInitializer !== undefined)
    || (ts.isMethodDeclaration(parent) && parent.name === node)
    || (ts.isPropertyDeclaration(parent) && parent.name === node)
    || (ts.isPropertySignature(parent) && parent.name === node)
    || (ts.isPropertyAccessExpression(parent) && parent.name === node)
    || (ts.isQualifiedName(parent) && parent.right === node)
    || (ts.isImportClause(parent) && parent.name === node)
    || (ts.isImportSpecifier(parent) && (parent.name === node || parent.propertyName === node))
    || (ts.isNamespaceImport(parent) && parent.name === node)
    || (ts.isBindingElement(parent) && (parent.name === node || parent.propertyName === node))
    || (ts.isVariableDeclaration(parent) && parent.name === node)
    || (ts.isFunctionDeclaration(parent) && parent.name === node)
    || (ts.isParameter(parent) && parent.name === node)
    || ts.isTypeReferenceNode(parent)
    || ts.isExpressionWithTypeArguments(parent)
    || ts.isImportTypeNode(parent)
    || ts.isTypeQueryNode(parent)
  ) {
    return false
  }

  return true
}

function isRouteOptionsObject(node: ts.ObjectLiteralExpression) {
  const propertyNames = new Set(
    node.properties
      .map((property) => getObjectLiteralElementName(property))
      .filter((name): name is string => name !== null),
  )

  return propertyNames.has('component')
}

function collectRouteServerOnlyContext(sourceFile: ts.SourceFile) {
  const ranges: TextRange[] = []
  const topLevelBindingNames = new Set<string>()

  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node) && isRouteOptionsObject(node)) {
      for (const property of node.properties) {
        const name = getObjectLiteralElementName(property)

        if (!name || !ROUTE_SERVER_PROPERTY_NAMES.has(name)) {
          continue
        }

        ranges.push({
          end: property.end,
          start: property.getStart(sourceFile),
        })

        if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer)) {
          topLevelBindingNames.add(property.initializer.text)
        }

        if (ts.isShorthandPropertyAssignment(property)) {
          topLevelBindingNames.add(property.name.text)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  for (const statement of sourceFile.statements) {
    if (getTopLevelStatementBindingNames(statement).some((name) => topLevelBindingNames.has(name))) {
      ranges.push({
        end: statement.end,
        start: statement.getStart(sourceFile),
      })
    }
  }

  return {
    ranges,
    topLevelBindingNames,
  }
}

function getImportValueBindingNames(importClause: ts.ImportClause | undefined) {
  if (!importClause || importClause.isTypeOnly) {
    return []
  }

  const names: string[] = []

  if (importClause.name) {
    names.push(importClause.name.text)
  }

  if (!importClause.namedBindings) {
    return names
  }

  if (ts.isNamespaceImport(importClause.namedBindings)) {
    names.push(importClause.namedBindings.name.text)
    return names
  }

  for (const element of importClause.namedBindings.elements) {
    if (!element.isTypeOnly) {
      names.push(element.name.text)
    }
  }

  return names
}

function getServerOnlyImportInfo(
  sourceFile: ts.SourceFile,
  serverOnlyRanges: TextRange[],
  id: string,
) {
  const removableImports = new Set<ts.ImportDeclaration>()
  const valueImports = new Map<string, string>()

  const throwClientBoundaryError = (specifier: string, reason: string) => {
    throw new Error(
      `[vorzelajs-server-only] ${formatRelativeId(id)} ${reason} "${specifier}". `
      + 'Move that usage into loader/beforeLoad/validateSearch, or keep it behind a .server import that is only referenced there.',
    )
  }

  const visitForRouteViolations = (node: ts.Node) => {
    if (
      ts.isExportDeclaration(node)
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
      && isServerOnlyModuleSpecifier(node.moduleSpecifier.text)
    ) {
      throwClientBoundaryError(node.moduleSpecifier.text, 're-exports a .server module from client-visible route code:')
    }

    if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
      && isServerOnlyModuleSpecifier(node.arguments[0].text)
      && !isNodeWithinRanges(node, sourceFile, serverOnlyRanges)
    ) {
      throwClientBoundaryError(node.arguments[0].text, 'uses a .server dynamic import outside server-only route code:')
    }

    ts.forEachChild(node, visitForRouteViolations)
  }

  visitForRouteViolations(sourceFile)

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue
    }

    const specifier = statement.moduleSpecifier.text

    if (!isServerOnlyModuleSpecifier(specifier)) {
      continue
    }

    if (!statement.importClause) {
      throwClientBoundaryError(specifier, 'contains a side-effect .server import in client-visible route code:')
    }

    const bindingNames = getImportValueBindingNames(statement.importClause)

    if (bindingNames.length === 0) {
      continue
    }

    removableImports.add(statement)

    for (const bindingName of bindingNames) {
      valueImports.set(bindingName, specifier)
    }
  }

  if (valueImports.size === 0) {
    return removableImports
  }

  const visitForBindingUsage = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      return
    }

    if (ts.isIdentifier(node) && isIdentifierReference(node)) {
      const specifier = valueImports.get(node.text)

      if (specifier && !isNodeWithinRanges(node, sourceFile, serverOnlyRanges)) {
        throwClientBoundaryError(specifier, `references .server binding "${node.text}" outside server-only route code from`)
      }
    }

    ts.forEachChild(node, visitForBindingUsage)
  }

  visitForBindingUsage(sourceFile)

  return removableImports
}

function stripTopLevelServerOnlyStatement(statement: ts.Statement, bindingNames: Set<string>) {
  if (ts.isFunctionDeclaration(statement) && statement.name && bindingNames.has(statement.name.text)) {
    return null
  }

  if (ts.isVariableStatement(statement)) {
    const keptDeclarations = statement.declarationList.declarations.filter((declaration) => {
      return !getBindingNames(declaration.name).some((name) => bindingNames.has(name))
    })

    if (keptDeclarations.length === 0) {
      return null
    }

    if (keptDeclarations.length !== statement.declarationList.declarations.length) {
      return ts.factory.updateVariableStatement(
        statement,
        statement.modifiers,
        ts.factory.updateVariableDeclarationList(statement.declarationList, keptDeclarations),
      )
    }
  }

  return statement
}

function stripRouteServerProperties(code: string, id: string) {
  const normalizedId = stripQuerySuffix(id)
  const scriptKind = normalizedId.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(normalizedId, code, ts.ScriptTarget.Latest, true, scriptKind)
  const { ranges: serverOnlyRanges, topLevelBindingNames } = collectRouteServerOnlyContext(sourceFile)
  const removableImports = getServerOnlyImportInfo(sourceFile, serverOnlyRanges, normalizedId)
  let changed = false

  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visitor = (node: ts.Node): ts.Node => {
      if (ts.isObjectLiteralExpression(node) && isRouteOptionsObject(node)) {
        const filteredProperties = node.properties.filter((property) => {
          const name = getObjectLiteralElementName(property)
          const shouldKeep = !name || !ROUTE_SERVER_PROPERTY_NAMES.has(name)

          if (!shouldKeep) {
            changed = true
          }

          return shouldKeep
        })

        if (filteredProperties.length !== node.properties.length) {
          return ts.factory.updateObjectLiteralExpression(node, filteredProperties)
        }
      }

      return ts.visitEachChild(node, visitor, context)
    }

    return (rootNode) => {
      const nextStatements: ts.Statement[] = []

      for (const statement of rootNode.statements) {
        if (ts.isImportDeclaration(statement) && removableImports.has(statement)) {
          changed = true
          continue
        }

        const strippedStatement = stripTopLevelServerOnlyStatement(statement, topLevelBindingNames)

        if (!strippedStatement) {
          changed = true
          continue
        }

        nextStatements.push(ts.visitNode(strippedStatement, visitor) as ts.Statement)
      }

      if (!changed) {
        return rootNode
      }

      return ts.factory.updateSourceFile(rootNode, nextStatements)
    }
  }

  const result = ts.transform(sourceFile, [transformer])

  try {
    if (!changed) {
      return null
    }

    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
    return printer.printFile(result.transformed[0])
  } finally {
    result.dispose()
  }
}

function assertNoServerOnlyImportsInClientFile(code: string, id: string) {
  const normalizedId = stripQuerySuffix(id)

  if (!isProjectSourceFile(normalizedId) || isRouteFileId(normalizedId)) {
    return
  }

  const scriptKind = normalizedId.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : normalizedId.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : normalizedId.endsWith('.js')
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(normalizedId, code, ts.ScriptTarget.Latest, true, scriptKind)

  const throwClientBoundaryError = (specifier: string) => {
    throw new Error(
      `[vorzelajs-server-only] ${formatRelativeId(id)} imports .server module "${specifier}". `
      + 'Only route loader/beforeLoad/validateSearch code may reference .server modules in the client build.',
    )
  }

  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
      && isServerOnlyModuleSpecifier(node.moduleSpecifier.text)
    ) {
      throwClientBoundaryError(node.moduleSpecifier.text)
    }

    if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
      && isServerOnlyModuleSpecifier(node.arguments[0].text)
    ) {
      throwClientBoundaryError(node.arguments[0].text)
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

function vorzelaServerOnlySupportPlugin(): Plugin {
  return {
    name: 'vorzelajs-server-only-support',
    enforce: 'pre',
    transform(code, id) {
      assertNoServerOnlyImportsInClientFile(code, id)

      if (!isRouteFileId(id)) {
        return null
      }

      const modified = stripRouteServerProperties(code, id)

      if (!modified) {
        return null
      }

      return { code: modified, map: null }
    },
  }
}

export default defineConfig(({ isSsrBuild, command }) => {
  const isClientBuild = command === 'build' && !isSsrBuild

  return {
    resolve: {
      alias: {
        '~': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [
      vorzelaRoutesPlugin(),
      tailwindcss(),
      solidPlugin({ ssr: true }),
      ...(isClientBuild ? [vorzelaServerOnlySupportPlugin()] : []),
    ],
    build: isSsrBuild
      ? {
          outDir: 'dist/server',
          emptyOutDir: false,
          copyPublicDir: false,
          rollupOptions: {
            output: {
              entryFileNames: 'entry-server.js',
              chunkFileNames: 'chunks/[name]-[hash].js',
              assetFileNames: 'assets/[name]-[hash][extname]',
            },
          },
        }
      : {
          cssCodeSplit: false,
          outDir: 'dist/client',
          emptyOutDir: true,
          copyPublicDir: true,
          manifest: true,
          rollupOptions: {
            input: path.resolve(__dirname, 'src/entry-client.tsx'),
            output: {
              entryFileNames: 'assets/[name]-[hash].js',
              chunkFileNames: 'assets/[name]-[hash].js',
              assetFileNames: 'assets/[name]-[hash][extname]',
            },
          },
        },
  }
})