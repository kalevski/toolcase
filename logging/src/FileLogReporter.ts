import { createWriteStream, unlinkSync, renameSync } from 'node:fs'
import StreamReporter, { type StreamLogFormatter, type StreamReporterOptions } from './StreamReporter'

export type FileLogFormatter = StreamLogFormatter

export interface FileLogReporterOptions extends StreamReporterOptions {
    append?: boolean
    maxFiles?: number
}

class FileLogReporter extends StreamReporter {

    private readonly filePath: string
    private readonly maxFiles: number

    constructor(filePath: string, options: FileLogReporterOptions = {}) {
        const flags = options.append === false ? 'w' : 'a'
        super(createWriteStream(filePath, { flags }), options)
        this.filePath = filePath
        this.maxFiles = options.maxFiles ?? 5
    }

    protected openRotatedStream(): Promise<void> {
        return new Promise<void>(resolve => {
            this.stream.end(() => {
                this.shiftFiles()
                this.bytesWritten = 0
                this.stream = createWriteStream(this.filePath, { flags: 'a' })
                this.stream.on('error', err => this.onError?.(err))
                resolve()
            })
        })
    }

    private shiftFiles(): void {
        try { unlinkSync(`${this.filePath}.${this.maxFiles}`) } catch {}
        for (let i = this.maxFiles - 1; i >= 1; i--) {
            try { renameSync(`${this.filePath}.${i}`, `${this.filePath}.${i + 1}`) } catch {}
        }
        try { renameSync(this.filePath, `${this.filePath}.1`) } catch {}
    }

}

export default FileLogReporter
