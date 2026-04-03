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

const getLevelOrder = (level: LoggerLevel): number => {
    const order = LevelOrder[level] ?? null
    if (typeof order !== 'number') {
        return -1
    }
    return order
}

const getLevel = (levelOrder: number): LoggerLevel => {
    const level = Object.keys(LevelOrder).find(key => LevelOrder[key as LoggerLevel] === levelOrder) || null
    if (level === null) {
        return 'silent'
    }
    return level as LoggerLevel
}

export default Level
export { getLevelOrder, getLevel }
