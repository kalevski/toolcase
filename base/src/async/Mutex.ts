import Semaphore from './Semaphore'

class Mutex {

    private semaphore: Semaphore

    constructor() {
        this.semaphore = new Semaphore(1)
    }

    get locked(): boolean {
        return this.semaphore.available === 0
    }

    acquire(): Promise<() => void> {
        return this.semaphore.acquire().then(() => {
            let released = false
            return () => {
                if (!released) {
                    released = true
                    this.semaphore.release()
                }
            }
        })
    }

    run<T>(fn: () => T | Promise<T>): Promise<T> {
        return this.semaphore.run(fn)
    }

}

export default Mutex
