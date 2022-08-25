/**
 * @typedef ColorType
 * @type {('white'|'red'|'pink'|'purple'|'deep_purple'|'indigo'|'blue'|'light_blue'|'cyan'|'teal'|'green'|'light_green'|'lime'|'yellow'|'amber'|'orange'|'deep_orange'|'brown'|'grey'|'blue_grey'|'black')}
 */


 const Color = {
    RED: '#f44336',
    PINK: '#e91e63',
    PURPLE: '#9c27b0',
    DEEP_PURPLE: '#673ab7',
    INDIGO: '#3f51b5',
    BLUE: '#2196f3',
    LIGHT_BLUE: '#03a9f4',
    CYAN: '#00bcd4',
    TEAL: '#009688',
    GREEN: '#4caf50',
    LIGHT_GREEN: '#8bc34a',
    LIME: '#cddc39',
    YELLOW: '#ffeb3b',
    AMBER: '#ffc107',
    ORANGE: '#ff9800',
    DEEP_ORANGE: '#ff5722',

    /**
     * 
     * @param {ColorType} color 
     * @returns {string}
     */
    getHex: (color) => {
        let key = color.toUpperCase()
        return Color[key] || null
    },

    /**
     * 
     * @param {ColorType} color 
     */
    toNumber: (color) => {
        let hex = Color.getHex(color)
        if (hex === null) {
            return 0
        }
        return parseInt(hex.split('#')[1], 16)
    },

    /**
     * 
     * @returns {string}
     */
    getRandomHex: () => {
        let keys = Object.keys(Color).filter(key => typeof Color[key] === 'string')
        let index = Math.floor(Math.random() * keys.length)
        let color = keys[index]
        return Color[color]
    }
}

export default Color