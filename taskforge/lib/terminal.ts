// App-side terminal line model. TaskForge's SSE stream tags lines with `kind`
// ('input' | 'output' | 'comment' | 'error'); tc-terminal-window expects `type`
// ('command' | 'output' | 'comment'). Keep our richer model and map at the
// render boundary via `toTcLines`.

import type { TerminalLine as TcTerminalLine } from '@toolcase/web-components'

export type TerminalLineKind = 'input' | 'output' | 'comment' | 'error'

export interface TerminalLine {
    kind: TerminalLineKind
    text: string
    delay?: number
}

const KIND_TO_TYPE: Record<TerminalLineKind, 'command' | 'output' | 'comment'> = {
    input: 'command',
    output: 'output',
    comment: 'comment',
    error: 'output', // tc-terminal-window has no error type
}

export function toTcLines(lines: TerminalLine[]): TcTerminalLine[] {
    return lines.map((l) => ({ type: KIND_TO_TYPE[l.kind], text: l.text }))
}
