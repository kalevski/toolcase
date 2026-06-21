import Deferred from './Deferred'
import Semaphore from './Semaphore'
import Mutex from './Mutex'
import pLimit from './pLimit'
import withTimeout from './withTimeout'
import sleep from './sleep'
import debounce from './debounce'
import throttle from './throttle'

export { Deferred, Semaphore, Mutex, pLimit, withTimeout, sleep, debounce, throttle }

const Async = {
    Deferred,
    Semaphore,
    Mutex,
    pLimit,
    withTimeout,
    sleep,
    debounce,
    throttle
}

export default Async
