function sleep(ms: number): Promise<void> {
    if (ms < 0) {
        throw new Error('ms must be a non-negative number')
    }
    return new Promise(resolve => setTimeout(resolve, ms))
}

export default sleep
