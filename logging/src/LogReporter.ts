import { LoggerLevel } from './Level'

class LogReporter {

    log(_level: LoggerLevel, _scope: string, _time: number, _fields: Record<string, any>, _messages: any[]): void {}

    flush(): void {}

    close(): void | Promise<void> {}

}

export default LogReporter
