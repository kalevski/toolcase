import { ConsoleLogReporter, Level, LoggerFactory as Factory } from '@toolcase/logging'
import type { LoggerLevel } from '@toolcase/logging/lib/Level'

export default class LoggerFactory extends Factory {

    constructor() {
        super([new ConsoleLogReporter()])
        this.level = Level.VERBOSE as LoggerLevel
    }

}
