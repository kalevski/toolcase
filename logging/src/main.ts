import Logger from './Logger'
import Level from './Level'
import { isKnownLevel, KNOWN_LEVELS } from './Level'
import LoggerFactory from './LoggerFactory'
import LogReporter from './LogReporter'
import ConsoleLogReporter from './ConsoleLogReporter'
import JSONLineReporter from './JSONLineReporter'
import BufferedReporter from './BufferedReporter'
import RingBufferReporter from './RingBufferReporter'
import LevelFilterReporter from './LevelFilterReporter'
import ScopeFilterReporter from './ScopeFilterReporter'
import RedactionReporter from './RedactionReporter'
import SamplingReporter from './SamplingReporter'
import FanoutReporter, { MultiReporter } from './FanoutReporter'
import HTTPReporter from './HTTPReporter'
import OTLPReporter from './OTLPReporter'
import MemoryReporter from './MemoryReporter'
import { textFormatter, jsonFormatter, logfmtFormatter } from './Formatter'

const logging = new LoggerFactory([
    new ConsoleLogReporter()
])

export default logging

export { logging, Logger, Level, LoggerFactory, LogReporter, ConsoleLogReporter, JSONLineReporter, BufferedReporter, RingBufferReporter, isKnownLevel, KNOWN_LEVELS, LevelFilterReporter, ScopeFilterReporter, RedactionReporter, SamplingReporter, FanoutReporter, MultiReporter, HTTPReporter, OTLPReporter, MemoryReporter, textFormatter, jsonFormatter, logfmtFormatter }
export type { LoggerLevel } from './Level'
export type { ConsoleLogReporterOptions } from './ConsoleLogReporter'
export type { ClockFn } from './Logger'
export type { LogEntry } from './BufferedReporter'
export type { RedactionKeys } from './RedactionReporter'
export type { HTTPReporterOptions, HTTPTransport } from './HTTPReporter'
export type { OTLPReporterOptions, OTLPTransport } from './OTLPReporter'
export type { LogFormatter } from './Formatter'
export type { JSONLineReporterOptions, JSONLineWriter } from './JSONLineReporter'
