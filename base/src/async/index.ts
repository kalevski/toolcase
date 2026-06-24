import Deferred from './Deferred'
import Semaphore from './Semaphore'
import Mutex from './Mutex'
import pLimit from './pLimit'
import withTimeout from './withTimeout'
import sleep from './sleep'
import debounce from './debounce'
import throttle from './throttle'
import AsyncQueue from './AsyncQueue'

export { Deferred, Semaphore, Mutex, pLimit, withTimeout, sleep, debounce, throttle, AsyncQueue }

const Async = {
    Deferred,
    Semaphore,
    Mutex,
    pLimit,
    withTimeout,
    sleep,
    debounce,
    throttle,
    AsyncQueue
}

export default Async
