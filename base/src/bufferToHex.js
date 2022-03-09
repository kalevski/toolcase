/**
 * 
 * @param {Uint8Array} buffer 
 * @returns {string}
 */
 const bufferToHex = (buffer) => {
    return [...buffer].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export default bufferToHex