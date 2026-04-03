const bufferToHex = (buffer: Uint8Array): string => {
    return [...buffer].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export default bufferToHex
