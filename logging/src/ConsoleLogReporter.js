import LogReporter from './LogReporter'

class ConsoleLogReporter extends LogReporter {

    /**
     * 
     * @param {import('./Level').LoggerLevel} level 
     * @param {string} scope 
     * @param {string} time
     * @param {Array<any>} messages 
     */
    log(level, scope, time, messages) {
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