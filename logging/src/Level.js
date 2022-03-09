/**
 * @typedef LoggerLevel
 * @type {('silent'|'error'|'warning'|'info'|'debug'|'verbose')}
 */

const LevelOrder = {
    silent: -1,
    error: 0,
    warning: 1,
    info: 2,
    debug: 3,
    verbose: 4
}

/**
 * @enum {string}
 */
const Level = {
    SILENT : 'silent',
    ERROR : 'error',
    WARNING : 'warning',
    INFO: 'info',
    DEBUG: 'debug',
    VERBOSE: 'verbose'
}

/**
 * 
 * @param {LoggerLevel} level 
 */
const getLevelOrder = (level) => {
    let order = LevelOrder[level] || null
    if (typeof order !== 'number') {
        return -1
    }
    return order
}

/**
 * 
 * @param {number} levelOrder 
 * @returns {LoggerLevel}
 */
const getLevel = (levelOrder) => {
    let level = Object.keys(LevelOrder).find(key => LevelOrder[key] === levelOrder) || null
    if (level === null) {
        return 'silent'
    }
    return level
}

export default Level
export { getLevelOrder, getLevel }