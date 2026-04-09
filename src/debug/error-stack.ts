import ErrorStackParser from 'error-stack-parser'

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

export function parseErrorStack(error: unknown): DebugStackInfo | undefined {
  if (!(error instanceof Error)) {
    return undefined
  }

  try {
    const frames = ErrorStackParser.parse(error).map((frame) => {
      const normalizedFrame: DebugStackFrame = {
        columnNumber: frame.columnNumber,
        fileName: frame.fileName,
        functionName: frame.functionName,
        lineNumber: frame.lineNumber,
        source: '',
      }

      normalizedFrame.source = formatFrameSource(normalizedFrame)
      return normalizedFrame
    })

    return {
      frames,
      stack: error.stack,
    }
  } catch {
    if (!error.stack) {
      return undefined
    }

    return {
      frames: [],
      stack: error.stack,
    }
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
