import Logger from './Logger'
import Level from './Level'
import { isKnownLevel, KNOWN_LEVELS } from './Level'
import LoggerFactory from './LoggerFactory'
import LogReporter from './LogReporter'
import ConsoleLogReporter, { type ConsoleLogReporterOptions } from './ConsoleLogReporter'
import JSONLineReporter from './JSONLineReporter'
import BufferedReporter from './BufferedReporter'
import RingBufferReporter from './RingBufferReporter'

const logging = new LoggerFactory([
    new ConsoleLogReporter()
])

export default logging

export { logging, Logger, Level, LoggerFactory, LogReporter, ConsoleLogReporter, JSONLineReporter, BufferedReporter, RingBufferReporter, isKnownLevel, KNOWN_LEVELS }
export type { ConsoleLogReporterOptions, LoggerLevel } from './Level'
export type { ClockFn } from './Logger'
export type { LogEntry } from './BufferedReporter'
