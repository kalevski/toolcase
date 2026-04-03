import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'

class ConsoleLogReporter extends LogReporter {

    log(level: LoggerLevel, scope: string, time: string, messages: any[]): void {
        if (level === 'error') {
            console.error(`${level.toUpperCase()} [${time}] | ${scope}:`, ...messages)
        } else if (level === 'warning') {
            console.warn(`${level.toUpperCase()} [${time}] | ${scope}:`, ...messages)
        } else {
            console.log(`${level.toUpperCase()} [${time}] | ${scope}:`, ...messages)
        }
    }
    
}

export default ConsoleLogReporter
