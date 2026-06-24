export type LoggerLevel = 'silent' | 'error' | 'warning' | 'info' | 'debug' | 'verbose'

const LevelOrder: Record<LoggerLevel, number> = {
    silent: -1,
    error: 0,
    warning: 1,
    info: 2,
    debug: 3,
    verbose: 4
}

const Level: Record<string, LoggerLevel> = {
    SILENT : 'silent',
    ERROR : 'error',
    WARNING : 'warning',
    INFO: 'info',
    DEBUG: 'debug',
    VERBOSE: 'verbose'
}

const OrderToLevel = Object.fromEntries(
    Object.entries(LevelOrder).map(([k, v]) => [v, k])
) as Record<number, LoggerLevel>

const getLevelOrder = (level: LoggerLevel): number =>
    LevelOrder[level] ?? Number.POSITIVE_INFINITY

const getLevel = (order: number): LoggerLevel => OrderToLevel[order] ?? 'silent'

const KNOWN_LEVELS = Object.keys(LevelOrder) as LoggerLevel[]

const isKnownLevel = (level: string): level is LoggerLevel =>
    Object.prototype.hasOwnProperty.call(LevelOrder, level)

export default Level
export { getLevelOrder, getLevel, isKnownLevel, KNOWN_LEVELS }
