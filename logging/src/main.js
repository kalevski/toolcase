import Logger from './Logger'
import Level from './Level'
import LoggerFactory from './LoggerFactory'
import LogReporter from './LogReporter'
import ConsoleLogReporter from './ConsoleLogReporter'

const logging = new LoggerFactory([
    new ConsoleLogReporter()
])

export default logging

export { Logger, Level, LoggerFactory, LogReporter, ConsoleLogReporter }