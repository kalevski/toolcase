import { LoggerLevel } from './Level'

class LogReporter {

    log(_level: LoggerLevel, _scope: string, _time: string, _messages: any[]): void {}

    flush(): void {}

    close(): void | Promise<void> {}

}

export default LogReporter
