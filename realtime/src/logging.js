import { ConsoleLogReporter, LoggerFactory } from '@toolcase/logging'

let loggging = new LoggerFactory([
    new ConsoleLogReporter()
])

export default loggging