export interface DebugStackFrame {
  columnNumber?: number
  fileName?: string
  functionName?: string
  lineNumber?: number
  source: string
}

export interface DebugStackInfo {
  frames: DebugStackFrame[]
  stack?: string
}

function formatFrameSource(frame: DebugStackFrame) {
  const fileName = frame.fileName ?? '<unknown>'
  const lineNumber = frame.lineNumber ?? 0
  const columnNumber = frame.columnNumber ?? 0
  const functionName = frame.functionName && frame.functionName.trim() !== ''
    ? `${frame.functionName} `
    : ''

  return `${functionName}(${fileName}:${lineNumber}:${columnNumber})`
}

function createFrame(source: string, parts: Partial<DebugStackFrame> = {}): DebugStackFrame {
  return {
    ...parts,
    source,
  }
}

function parseStackLine(line: string): DebugStackFrame | undefined {
  const trimmed = line.trim()

  if (trimmed === '' || trimmed.toLowerCase().startsWith('error')) {
    return undefined
  }

  const v8Named = /^at\s+(.*?)\s+\((.+):(\d+):(\d+)\)$/u.exec(trimmed)

  if (v8Named) {
    const [, functionName, fileName, lineNumber, columnNumber] = v8Named
    return createFrame(trimmed, {
      columnNumber: Number(columnNumber),
      fileName,
      functionName,
      lineNumber: Number(lineNumber),
    })
  }

  const v8Anonymous = /^at\s+(.+):(\d+):(\d+)$/u.exec(trimmed)

  if (v8Anonymous) {
    const [, fileName, lineNumber, columnNumber] = v8Anonymous
    return createFrame(trimmed, {
      columnNumber: Number(columnNumber),
      fileName,
      lineNumber: Number(lineNumber),
    })
  }

  const firefoxNamed = /^(.*?)@(.+):(\d+):(\d+)$/u.exec(trimmed)

  if (firefoxNamed) {
    const [, functionName, fileName, lineNumber, columnNumber] = firefoxNamed
    return createFrame(trimmed, {
      columnNumber: Number(columnNumber),
      fileName,
      functionName: functionName || undefined,
      lineNumber: Number(lineNumber),
    })
  }

  return createFrame(trimmed)
}

function parseStackFrames(stack: string) {
  return stack
    .split('\n')
    .map(parseStackLine)
    .filter((frame): frame is DebugStackFrame => frame !== undefined)
    .map((frame) => ({
      ...frame,
      source: frame.fileName || frame.functionName ? formatFrameSource(frame) : frame.source,
    }))
}

export function parseErrorStack(error: unknown): DebugStackInfo | undefined {
  if (!(error instanceof Error)) {
    return undefined
  }

  if (!error.stack) {
    return undefined
  }

  return {
    frames: parseStackFrames(error.stack),
    stack: error.stack,
  }
}

export function formatParsedStack(stack: DebugStackInfo | undefined, maxFrames = 8) {
  if (!stack) {
    return []
  }

  if (stack.frames.length > 0) {
    return stack.frames.slice(0, maxFrames).map((frame) => frame.source)
  }

  return stack.stack
    ? stack.stack.split('\n').slice(0, maxFrames + 1).map((line) => line.trim()).filter(Boolean)
    : []
}
