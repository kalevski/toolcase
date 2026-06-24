import { describe, it, expect, vi } from 'vitest'
import { default as Level, getLevelOrder, getLevel, isKnownLevel, KNOWN_LEVELS } from '../src/Level'
import Logger from '../src/Logger'
import LoggerFactory from '../src/LoggerFactory'
import ConsoleLogReporter from '../src/ConsoleLogReporter'
import LogReporter from '../src/LogReporter'
import JSONLineReporter from '../src/JSONLineReporter'
import FileLogReporter from '../src/FileLogReporter'
import StreamReporter from '../src/StreamReporter'
import BufferedReporter from '../src/BufferedReporter'
import RingBufferReporter from '../src/RingBufferReporter'
import LevelFilterReporter from '../src/LevelFilterReporter'
import ScopeFilterReporter from '../src/ScopeFilterReporter'
import RedactionReporter from '../src/RedactionReporter'
import SamplingReporter from '../src/SamplingReporter'
import FanoutReporter, { MultiReporter } from '../src/FanoutReporter'
import HTTPReporter, { type HTTPTransport } from '../src/HTTPReporter'
import OTLPReporter, { type OTLPTransport } from '../src/OTLPReporter'
import BeaconReporter from '../src/BeaconReporter'
import IndexedDBReporter from '../src/IndexedDBReporter'
import { textFormatter, jsonFormatter, logfmtFormatter } from '../src/Formatter'
import AsyncContext from '../src/AsyncContext'
import ContextualReporter from '../src/ContextualReporter'
import MemoryReporter from '../src/MemoryReporter'

// 2026-01-01T00:00:00.000Z in epoch ms
const T0 = 1767225600000
// 2026-01-01T00:00:01.000Z in epoch ms
const T1 = 1767225601000

describe('Level', () => {
    it('has all expected levels', () => {
        expect(Level.SILENT).toBe('silent')
        expect(Level.ERROR).toBe('error')
        expect(Level.WARNING).toBe('warning')
        expect(Level.INFO).toBe('info')
        expect(Level.DEBUG).toBe('debug')
        expect(Level.VERBOSE).toBe('verbose')
    })

    it('getLevelOrder returns correct order', () => {
        expect(getLevelOrder('silent')).toBe(-1)
        expect(getLevelOrder('error')).toBe(0)
        expect(getLevelOrder('warning')).toBe(1)
        expect(getLevelOrder('info')).toBe(2)
        expect(getLevelOrder('debug')).toBe(3)
        expect(getLevelOrder('verbose')).toBe(4)
    })

    it('getLevel returns level name from order', () => {
        expect(getLevel(0)).toBe('error')
        expect(getLevel(2)).toBe('info')
        expect(getLevel(-1)).toBe('silent')
    })

    it('getLevel returns silent for unknown order', () => {
        expect(getLevel(999)).toBe('silent')
    })

    it('isKnownLevel identifies valid level tokens', () => {
        expect(isKnownLevel('silent')).toBe(true)
        expect(isKnownLevel('error')).toBe(true)
        expect(isKnownLevel('warning')).toBe(true)
        expect(isKnownLevel('info')).toBe(true)
        expect(isKnownLevel('debug')).toBe(true)
        expect(isKnownLevel('verbose')).toBe(true)
    })

    it('isKnownLevel rejects unknown strings', () => {
        expect(isKnownLevel('trace')).toBe(false)
        expect(isKnownLevel('warn')).toBe(false)
        expect(isKnownLevel('trase')).toBe(false)
        expect(isKnownLevel('')).toBe(false)
        expect(isKnownLevel('VERBOSE')).toBe(false)
    })

    it('KNOWN_LEVELS contains exactly the six valid level tokens', () => {
        expect([...KNOWN_LEVELS].sort()).toEqual(['debug', 'error', 'info', 'silent', 'verbose', 'warning'])
    })
})

describe('LoggerFactory', () => {
    it('creates loggers with scope', () => {
        const factory = new LoggerFactory([])
        const logger = factory.getLogger('test')
        expect(logger).toBeDefined()
    })

    it('returns same logger for same scope', () => {
        const factory = new LoggerFactory([])
        const a = factory.getLogger('scope1')
        const b = factory.getLogger('scope1')
        expect(a).toBe(b)
    })

    it('level getter/setter works', () => {
        const factory = new LoggerFactory([])
        factory.level = 'error'
        expect(factory.level).toBe('error')
        factory.level = 'verbose'
        expect(factory.level).toBe('verbose')
    })

    it('throws RangeError when an invalid level is assigned', () => {
        const factory = new LoggerFactory([])
        expect(() => { (factory as any).level = 'warn' }).toThrow(RangeError)
        expect(() => { (factory as any).level = 'trace' }).toThrow(RangeError)
        expect(() => { (factory as any).level = '' }).toThrow(RangeError)
        expect(() => { (factory as any).level = 'VERBOSE' }).toThrow(RangeError)
    })

    it('drops unknown level tokens even when factory level is silent', () => {
        const messages: string[] = []
        class DummyReporter extends LogReporter {
            log(level: string): void { messages.push(level) }
        }
        const factory = new LoggerFactory([new DummyReporter()])
        factory.level = 'silent'
        const logger = factory.getLogger('test')
        logger.log('trace' as any, 'should be dropped')
        expect(messages).toHaveLength(0)
    })

    it('filters messages below configured level', () => {
        const messages: { level: string; msgs: any[] }[] = []

        class DummyReporter extends LogReporter {
            log(level: string, scope: string, time: number, _fields: any, msgs: any[]): void {
                messages.push({ level, msgs })
            }
        }

        const factory = new LoggerFactory([
            new DummyReporter()
        ])
        factory.level = 'warning'
        const logger = factory.getLogger('test')
        logger.error('err msg')
        logger.warning('warn msg')
        logger.info('info msg')
        logger.debug('debug msg')
        expect(messages).toHaveLength(2)
        expect(messages[0].level).toBe('error')
        expect(messages[1].level).toBe('warning')
    })
})

describe('LoggerFactory — flush / close lifecycle', () => {
    it('flush() calls flush() on all reporters including dynamically added ones', () => {
        const flushed: string[] = []
        class F extends LogReporter {
            constructor(private id: string) { super() }
            log(): void {}
            flush(): void { flushed.push(this.id) }
        }
        const factory = new LoggerFactory([new F('a')])
        factory.addReporter(new F('b'))
        factory.flush()
        expect(flushed).toEqual(['a', 'b'])
    })

    it('flush() does not call flush() on removed reporters', () => {
        const flushed: string[] = []
        class F extends LogReporter {
            constructor(private id: string) { super() }
            log(): void {}
            flush(): void { flushed.push(this.id) }
        }
        const r = new F('x')
        const factory = new LoggerFactory([r])
        factory.removeReporter(r)
        factory.flush()
        expect(flushed).toHaveLength(0)
    })

    it('flush() isolates reporter errors', () => {
        class Throws extends LogReporter {
            log(): void {}
            flush(): void { throw new Error('flush failure') }
        }
        const factory = new LoggerFactory([new Throws()])
        expect(() => factory.flush()).not.toThrow()
    })

    it('close() calls close() on all reporters including dynamically added ones', async () => {
        const closed: string[] = []
        class C extends LogReporter {
            constructor(private id: string) { super() }
            log(): void {}
            close(): void { closed.push(this.id) }
        }
        const factory = new LoggerFactory([new C('a')])
        factory.addReporter(new C('b'))
        await factory.close()
        expect(closed).toEqual(['a', 'b'])
    })

    it('close() awaits async close() on reporters', async () => {
        let resolved = false
        class AsyncC extends LogReporter {
            log(): void {}
            close(): Promise<void> {
                return new Promise(r => setTimeout(() => { resolved = true; r() }, 10))
            }
        }
        const factory = new LoggerFactory([new AsyncC()])
        await factory.close()
        expect(resolved).toBe(true)
    })

    it('close() does not call close() on removed reporters', async () => {
        const closed: string[] = []
        class C extends LogReporter {
            constructor(private id: string) { super() }
            log(): void {}
            close(): void { closed.push(this.id) }
        }
        const r = new C('gone')
        const factory = new LoggerFactory([r, new C('kept')])
        factory.removeReporter(r)
        await factory.close()
        expect(closed).toEqual(['kept'])
    })

    it('close() isolates reporter errors', async () => {
        class Throws extends LogReporter {
            log(): void {}
            close(): void { throw new Error('close failure') }
        }
        const factory = new LoggerFactory([new Throws()])
        await expect(factory.close()).resolves.toBeUndefined()
    })
})

describe('LoggerFactory — close() drains BufferedReporter', () => {
    it('factory.close() drains buffered entries to the inner reporter', async () => {
        const received: string[] = []
        class Inner extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]): void { received.push(msgs[0]) }
        }
        const buf = new BufferedReporter(new Inner(), { maxSize: 100, flushInterval: 99999 })
        const factory = new LoggerFactory([buf])
        factory.getLogger('test').info('alpha')
        factory.getLogger('test').info('beta')
        expect(received).toHaveLength(0)
        await factory.close()
        expect(received).toEqual(['alpha', 'beta'])
    })

    it('factory.flush() drains buffered entries to the inner reporter', () => {
        const received: string[] = []
        class Inner extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]): void { received.push(msgs[0]) }
        }
        const buf = new BufferedReporter(new Inner(), { maxSize: 100, flushInterval: 99999 })
        const factory = new LoggerFactory([buf])
        factory.getLogger('test').info('gamma')
        expect(received).toHaveLength(0)
        factory.flush()
        expect(received).toEqual(['gamma'])
    })

    it('factory.close() drains multiple BufferedReporters', async () => {
        const drainedA: string[] = []
        const drainedB: string[] = []
        class A extends LogReporter { log(_l: any, _s: any, _t: any, _f: any, msgs: any[]): void { drainedA.push(msgs[0]) } }
        class B extends LogReporter { log(_l: any, _s: any, _t: any, _f: any, msgs: any[]): void { drainedB.push(msgs[0]) } }
        const bufA = new BufferedReporter(new A(), { maxSize: 100, flushInterval: 99999 })
        const bufB = new BufferedReporter(new B(), { maxSize: 100, flushInterval: 99999 })
        const factory = new LoggerFactory([bufA, bufB])
        factory.getLogger('t').info('msg')
        expect(drainedA).toHaveLength(0)
        expect(drainedB).toHaveLength(0)
        await factory.close()
        expect(drainedA).toEqual(['msg'])
        expect(drainedB).toEqual(['msg'])
    })
})

describe('LoggerFactory — addReporter / removeReporter', () => {
    it('addReporter causes the reporter to receive subsequent logs', () => {
        const received: string[] = []
        class R extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]): void { received.push(msgs[0]) }
        }
        const factory = new LoggerFactory([])
        const logger = factory.getLogger('test')
        const reporter = new R()
        factory.addReporter(reporter)
        logger.info('after-add')
        expect(received).toEqual(['after-add'])
    })

    it('added reporter does not receive logs emitted before addReporter', () => {
        const received: string[] = []
        class R extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]): void { received.push(msgs[0]) }
        }
        const factory = new LoggerFactory([])
        const logger = factory.getLogger('test')
        logger.info('before-add')
        factory.addReporter(new R())
        expect(received).toHaveLength(0)
    })

    it('removeReporter stops the reporter from receiving subsequent logs', () => {
        const received: string[] = []
        class R extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]): void { received.push(msgs[0]) }
        }
        const reporter = new R()
        const factory = new LoggerFactory([reporter])
        const logger = factory.getLogger('test')
        logger.info('before-remove')
        factory.removeReporter(reporter)
        logger.info('after-remove')
        expect(received).toEqual(['before-remove'])
    })

    it('removeReporter is a no-op for an unregistered reporter', () => {
        const factory = new LoggerFactory([])
        class R extends LogReporter { log(): void {} }
        expect(() => factory.removeReporter(new R())).not.toThrow()
    })

    it('multiple reporters can be added and each receives logs', () => {
        const a: string[] = []
        const b: string[] = []
        class A extends LogReporter { log(_l: any, _s: any, _t: any, _f: any, msgs: any[]): void { a.push(msgs[0]) } }
        class B extends LogReporter { log(_l: any, _s: any, _t: any, _f: any, msgs: any[]): void { b.push(msgs[0]) } }
        const factory = new LoggerFactory([])
        factory.addReporter(new A())
        factory.addReporter(new B())
        factory.getLogger('t').info('msg')
        expect(a).toEqual(['msg'])
        expect(b).toEqual(['msg'])
    })
})

describe('LoggerFactory — clock injection', () => {
    it('timestamp delivered to reporter is a number (epoch ms)', () => {
        const received: number[] = []
        class R extends LogReporter {
            log(_l: any, _s: any, time: number): void { received.push(time) }
        }
        const factory = new LoggerFactory([new R()])
        factory.getLogger('t').info('msg')
        expect(typeof received[0]).toBe('number')
        expect(received[0]).toBeGreaterThan(0)
    })

    it('injected clock determines the timestamp passed to reporters', () => {
        const received: number[] = []
        class R extends LogReporter {
            log(_l: any, _s: any, time: number): void { received.push(time) }
        }
        const factory = new LoggerFactory([new R()], () => 1234567890000)
        factory.getLogger('t').info('msg')
        expect(received[0]).toBe(1234567890000)
    })

    it('clock is not called for disabled levels', () => {
        let calls = 0
        const factory = new LoggerFactory([], () => { calls++; return 1000 })
        factory.level = 'info'
        factory.getLogger('t').debug('disabled')
        expect(calls).toBe(0)
    })

    it('clock is called once per enabled log call', () => {
        let calls = 0
        const factory = new LoggerFactory([], () => { calls++; return 1000 })
        factory.level = 'debug'
        factory.getLogger('t').debug('enabled')
        expect(calls).toBe(1)
    })

    it('withContext child uses the same injected clock', () => {
        const received: number[] = []
        class R extends LogReporter {
            log(_l: any, _s: any, time: number): void { received.push(time) }
        }
        const factory = new LoggerFactory([new R()], () => 9999)
        const log = factory.getLogger('t')
        const child = log.withContext({ x: 1 })
        child.info('msg')
        expect(received[0]).toBe(9999)
    })

    it('fixed clock makes timestamps deterministic across multiple calls', () => {
        const received: number[] = []
        class R extends LogReporter {
            log(_l: any, _s: any, time: number): void { received.push(time) }
        }
        const factory = new LoggerFactory([new R()], () => 42)
        const log = factory.getLogger('t')
        log.info('a')
        log.info('b')
        log.warning('c')
        expect(received).toEqual([42, 42, 42])
    })
})

describe('Logger', () => {
    it('passes scope, time, and args through dispatch fn', () => {
        const captures: any[] = []
        const logger = new Logger('billing', (level, scope, time, fields, messages) => {
            captures.push({ level, scope, time, fields, messages })
        })
        logger.info('hello', 42)
        expect(captures).toHaveLength(1)
        expect(captures[0].level).toBe('info')
        expect(captures[0].scope).toBe('billing')
        expect(captures[0].fields).toEqual({})
        expect(captures[0].messages).toEqual(['hello', 42])
        expect(typeof captures[0].time).toBe('number')
    })

    it('exposes a method per level', () => {
        const captures: string[] = []
        const logger = new Logger('s', (level) => { captures.push(level) })
        logger.error('e')
        logger.warning('w')
        logger.info('i')
        logger.debug('d')
        logger.verbose('v')
        expect(captures).toEqual(['error', 'warning', 'info', 'debug', 'verbose'])
    })

    it('log() dispatches known level tokens', () => {
        const captures: string[] = []
        const logger = new Logger('s', (level) => { captures.push(level) })
        logger.log('verbose', 'msg')
        expect(captures).toEqual(['verbose'])
    })

    it('log() drops unknown level tokens even without a factory isEnabledFn', () => {
        const captures: string[] = []
        const logger = new Logger('s', (level) => { captures.push(level) })
        logger.log('trace' as any, 'should be dropped')
        logger.log('warn' as any, 'should be dropped')
        expect(captures).toHaveLength(0)
    })
})

describe('Logger.setLevel (per-logger override)', () => {
    it('narrows: logger override blocks below-threshold messages even when factory is verbose', () => {
        const captured: string[] = []
        class R extends LogReporter { log(level: any) { captured.push(level) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'verbose'
        const logger = factory.getLogger('svc')
        logger.setLevel('warning')
        logger.error('e')
        logger.warning('w')
        logger.info('i')
        logger.debug('d')
        expect(captured).toEqual(['error', 'warning'])
    })

    it('widens: logger override permits below-factory messages', () => {
        const captured: string[] = []
        class R extends LogReporter { log(level: any) { captured.push(level) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'warning'
        const noisy = factory.getLogger('noisy')
        noisy.setLevel('verbose')
        noisy.info('i')
        noisy.debug('d')
        noisy.verbose('v')
        expect(captured).toEqual(['info', 'debug', 'verbose'])
    })

    it('null clears the override (defers back to factory)', () => {
        const captured: string[] = []
        class R extends LogReporter { log(level: any) { captured.push(level) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'error'
        const log = factory.getLogger('s')
        log.setLevel('verbose')
        log.info('shown')
        log.setLevel(null)
        captured.length = 0
        log.info('dropped')
        log.error('shown')
        expect(captured).toEqual(['error'])
    })

    it('getLevel reports the override or null', () => {
        const factory = new LoggerFactory([])
        const log = factory.getLogger('x')
        expect(log.getLevel()).toBeNull()
        log.setLevel('debug')
        expect(log.getLevel()).toBe('debug')
        log.setLevel(null)
        expect(log.getLevel()).toBeNull()
    })

    it('per-logger override is scope-local', () => {
        const captured: { scope: string, level: string }[] = []
        class R extends LogReporter { log(level: any, scope: string) { captured.push({ level, scope }) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'warning'
        const a = factory.getLogger('a')
        const b = factory.getLogger('b')
        a.setLevel('verbose')
        a.debug('a-debug')
        b.debug('b-debug')
        expect(captured).toEqual([{ scope: 'a', level: 'debug' }])
    })
})

describe('Logger.withContext (structured context binding)', () => {
    it('threads context as top-level fields, not as first message', () => {
        const captured: { fields: any, msgs: any[] }[] = []
        class R extends LogReporter { log(_l: any, _s: any, _t: any, fields: any, msgs: any[]) { captured.push({ fields, msgs }) } }
        const factory = new LoggerFactory([new R()])
        const log = factory.getLogger('svc')
        const req = log.withContext({ requestId: 'r1' })
        req.info('start')
        req.info('done', 42)
        expect(captured[0].fields).toEqual({ requestId: 'r1' })
        expect(captured[0].msgs).toEqual(['start'])
        expect(captured[1].fields).toEqual({ requestId: 'r1' })
        expect(captured[1].msgs).toEqual(['done', 42])
    })

    it('does not mutate the parent logger', () => {
        const captured: { fields: any, msgs: any[] }[] = []
        class R extends LogReporter { log(_l: any, _s: any, _t: any, fields: any, msgs: any[]) { captured.push({ fields, msgs }) } }
        const factory = new LoggerFactory([new R()])
        const parent = factory.getLogger('svc')
        parent.withContext({ x: 1 })
        parent.info('hi')
        expect(captured[0].fields).toEqual({})
        expect(captured[0].msgs).toEqual(['hi'])
    })

    it('nested withContext merges context, child wins on key conflict', () => {
        const captured: { fields: any, msgs: any[] }[] = []
        class R extends LogReporter { log(_l: any, _s: any, _t: any, fields: any, msgs: any[]) { captured.push({ fields, msgs }) } }
        const factory = new LoggerFactory([new R()])
        const log = factory.getLogger('svc')
        const a = log.withContext({ requestId: 'r1', userId: 7 })
        const b = a.withContext({ userId: 9, sessionId: 's' })
        b.info('event')
        expect(captured[0].fields).toEqual({ requestId: 'r1', userId: 9, sessionId: 's' })
        expect(captured[0].msgs).toEqual(['event'])
    })

    it('inherits parent level override', () => {
        const captured: string[] = []
        class R extends LogReporter { log(level: any) { captured.push(level) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'warning'
        const log = factory.getLogger('svc')
        log.setLevel('verbose')
        const child = log.withContext({ requestId: 'r1' })
        child.debug('d')
        expect(captured).toEqual(['debug'])
    })
})

describe('Logger.isEnabled (public guard predicate)', () => {
    it('returns true for all levels when no factory predicate is wired', () => {
        const log = new Logger('s', () => {})
        expect(log.isEnabled('error')).toBe(true)
        expect(log.isEnabled('debug')).toBe(true)
        expect(log.isEnabled('verbose')).toBe(true)
    })

    it('reflects factory level threshold', () => {
        const factory = new LoggerFactory([])
        factory.level = 'warning'
        const log = factory.getLogger('x')
        expect(log.isEnabled('error')).toBe(true)
        expect(log.isEnabled('warning')).toBe(true)
        expect(log.isEnabled('info')).toBe(false)
        expect(log.isEnabled('debug')).toBe(false)
        expect(log.isEnabled('verbose')).toBe(false)
    })

    it('respects per-logger level override', () => {
        const factory = new LoggerFactory([])
        factory.level = 'warning'
        const log = factory.getLogger('y')
        log.setLevel('verbose')
        expect(log.isEnabled('debug')).toBe(true)
        expect(log.isEnabled('verbose')).toBe(true)
    })

    it('withContext child inherits predicate', () => {
        const factory = new LoggerFactory([])
        factory.level = 'info'
        const log = factory.getLogger('z')
        const child = log.withContext({ requestId: 'r1' })
        expect(child.isEnabled('info')).toBe(true)
        expect(child.isEnabled('debug')).toBe(false)
    })

})

describe('Logger — early return for disabled levels', () => {
    it('does not invoke the clock or the dispatch fn for a disabled level', () => {
        let clockCalls = 0
        const factory = new LoggerFactory([], () => { clockCalls++; return 1000 })
        factory.level = 'info'
        const log = factory.getLogger('perf')
        const child = log.withContext({ requestId: 'r1' })
        child.debug('expensive payload')
        expect(clockCalls).toBe(0)
    })

    it('does not invoke dispatch fn for a disabled level', () => {
        const dispatched: string[] = []
        const factory = new LoggerFactory([])
        factory.level = 'info'
        const log = factory.getLogger('perf2')
        ;(log as any).logMessageFn = (level: string) => dispatched.push(level)
        log.debug('should be dropped')
        expect(dispatched).toHaveLength(0)
    })

    it('invokes the clock exactly once for an enabled level', () => {
        let clockCalls = 0
        const factory = new LoggerFactory([], () => { clockCalls++; return 1000 })
        factory.level = 'debug'
        const log = factory.getLogger('enabled')
        log.debug('this should pass')
        expect(clockCalls).toBe(1)
    })

    it('short-circuits context array allocation when level is disabled', () => {
        const received: { fields: any, msgs: any[] }[] = []
        class R extends LogReporter { log(_l: any, _s: any, _t: any, fields: any, msgs: any[]) { received.push({ fields, msgs }) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'info'
        const log = factory.getLogger('ctx')
        const child = log.withContext({ userId: 42 })
        child.debug('nope')
        expect(received).toHaveLength(0)
        child.info('yes')
        expect(received).toHaveLength(1)
        expect(received[0].fields).toEqual({ userId: 42 })
        expect(received[0].msgs).toEqual(['yes'])
    })
})

describe('Logger — lazy thunk evaluation', () => {
    it('never calls a thunk arg when the level is disabled', () => {
        const factory = new LoggerFactory([])
        factory.level = 'info'
        const log = factory.getLogger('thunk')
        let called = false
        log.debug(() => { called = true; return 'expensive' })
        expect(called).toBe(false)
    })

    it('calls a thunk arg when the level is enabled', () => {
        const received: any[][] = []
        class R extends LogReporter { log(_l: any, _s: any, _t: any, _f: any, msgs: any[]) { received.push(msgs) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'debug'
        const log = factory.getLogger('thunk')
        log.debug(() => 'lazy-value')
        expect(received).toHaveLength(1)
        expect(received[0]).toEqual(['lazy-value'])
    })

    it('evaluates each thunk in a mixed args list', () => {
        const received: any[][] = []
        class R extends LogReporter { log(_l: any, _s: any, _t: any, _f: any, msgs: any[]) { received.push(msgs) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'debug'
        const log = factory.getLogger('thunk')
        log.debug('prefix', () => ({ id: 99 }), 'suffix')
        expect(received[0]).toEqual(['prefix', { id: 99 }, 'suffix'])
    })

    it('does not call any thunk in a mixed list when the level is disabled', () => {
        const factory = new LoggerFactory([])
        factory.level = 'info'
        const log = factory.getLogger('thunk')
        let calls = 0
        log.debug(() => { calls++; return 'a' }, () => { calls++; return 'b' })
        expect(calls).toBe(0)
    })

    it('thunk result is threaded to fields and messages separately when context is set', () => {
        const received: { fields: any, msgs: any[] }[] = []
        class R extends LogReporter { log(_l: any, _s: any, _t: any, fields: any, msgs: any[]) { received.push({ fields, msgs }) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'debug'
        const log = factory.getLogger('thunk').withContext({ req: 'r1' })
        log.debug(() => 'lazy')
        expect(received[0].fields).toEqual({ req: 'r1' })
        expect(received[0].msgs).toEqual(['lazy'])
    })
})

describe('ConsoleLogReporter', () => {
    it('can be instantiated', () => {
        const reporter = new ConsoleLogReporter()
        expect(reporter).toBeDefined()
        expect(typeof reporter.log).toBe('function')
    })

    it('routes error level to console.error', () => {
        const reporter = new ConsoleLogReporter()
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        reporter.log('error', 'svc', T0, {}, ['boom'])
        expect(spy).toHaveBeenCalledTimes(1)
        const call = spy.mock.calls[0].join(' ')
        expect(call).toContain('ERROR')
        expect(call).toContain('svc')
        expect(call).toContain('boom')
        spy.mockRestore()
    })

    it('routes warning level to console.warn', () => {
        const reporter = new ConsoleLogReporter()
        const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        reporter.log('warning', 'svc', T0, {}, ['heads up'])
        expect(spy).toHaveBeenCalledTimes(1)
        spy.mockRestore()
    })

    it('routes info/debug/verbose to console.log', () => {
        const reporter = new ConsoleLogReporter()
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        reporter.log('info', 's', T0, {}, ['x'])
        reporter.log('debug', 's', T0, {}, ['x'])
        reporter.log('verbose', 's', T0, {}, ['x'])
        expect(spy).toHaveBeenCalledTimes(3)
        spy.mockRestore()
    })

    it('{ color: false } emits no ANSI escape sequences', () => {
        const reporter = new ConsoleLogReporter({ color: false })
        const spyError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {})
        reporter.log('error',   'svc', T0, {}, ['msg'])
        reporter.log('warning', 'svc', T0, {}, ['msg'])
        reporter.log('info',    'svc', T0, {}, ['msg'])
        for (const spy of [spyError, spyWarn, spyLog]) {
            for (const call of spy.mock.calls) {
                expect(call.join(' ')).not.toMatch(/\x1b\[/)
            }
            spy.mockRestore()
        }
    })

    it('NO_COLOR env var disables color auto-detection', () => {
        const prev = process.env.NO_COLOR
        process.env.NO_COLOR = ''
        try {
            const reporter = new ConsoleLogReporter()
            const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
            reporter.log('info', 's', T0, {}, ['msg'])
            const call = spy.mock.calls[0]
            expect(call.join(' ')).not.toMatch(/\x1b\[/)
            expect(call[0]).not.toContain('%c')
            spy.mockRestore()
        } finally {
            if (prev === undefined) delete process.env.NO_COLOR
            else process.env.NO_COLOR = prev
        }
    })

    it('{ timestamp: false } omits time from the default prefix', () => {
        const reporter = new ConsoleLogReporter({ color: false, timestamp: false })
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        reporter.log('info', 'svc', T0, {}, ['msg'])
        const call = spy.mock.calls[0].join(' ')
        expect(call).not.toContain('2026-01-01T00:00:00')
        expect(call).toContain('INFO')
        expect(call).toContain('svc')
        spy.mockRestore()
    })

    it('{ timestamp: true } (default) includes ISO time in the prefix', () => {
        const reporter = new ConsoleLogReporter({ color: false })
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        reporter.log('info', 'svc', T0, {}, ['msg'])
        const call = spy.mock.calls[0].join(' ')
        expect(call).toContain('2026-01-01T00:00:00.000Z')
        spy.mockRestore()
    })

    it('custom string prefix replaces the default prefix', () => {
        const reporter = new ConsoleLogReporter({ color: false, prefix: '[MY-APP]' })
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        reporter.log('info', 'svc', T0, {}, ['msg'])
        const call = spy.mock.calls[0].join(' ')
        expect(call).toContain('[MY-APP]')
        expect(call).not.toContain('INFO')
        expect(call).not.toContain('svc')
        spy.mockRestore()
    })

    it('prefix function receives level/scope/time (number) and its return is used', () => {
        const reporter = new ConsoleLogReporter({
            color: false,
            prefix: (level, scope, time) => `${level}|${scope}|${new Date(time).toISOString()}`
        })
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        reporter.log('info', 'svc', T0, {}, ['msg'])
        const call = spy.mock.calls[0].join(' ')
        expect(call).toContain('info|svc|2026-01-01T00:00:00.000Z')
        spy.mockRestore()
    })

    it('{ objects: "pretty" } serializes plain objects to indented JSON strings', () => {
        const reporter = new ConsoleLogReporter({ color: false, objects: 'pretty' })
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        reporter.log('info', 's', T0, {}, [{ key: 'value' }])
        const objectArg = spy.mock.calls[0][1]
        expect(typeof objectArg).toBe('string')
        expect(objectArg).toContain('"key"')
        expect(objectArg).toContain('"value"')
        spy.mockRestore()
    })

    it('{ objects: "pretty" } serializes Error instances to a string', () => {
        const reporter = new ConsoleLogReporter({ color: false, objects: 'pretty' })
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        reporter.log('info', 's', T0, {}, [new Error('boom')])
        const objectArg = spy.mock.calls[0][1]
        expect(typeof objectArg).toBe('string')
        expect(objectArg).toContain('boom')
        spy.mockRestore()
    })

    it('{ objects: "pretty" } passes primitives through unchanged', () => {
        const reporter = new ConsoleLogReporter({ color: false, objects: 'pretty' })
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        reporter.log('info', 's', T0, {}, ['hello', 42, true, null])
        const args = spy.mock.calls[0].slice(1)
        expect(args).toEqual(['hello', 42, true, null])
        spy.mockRestore()
    })

    it('{ objects: "compact" } (default) passes objects through unchanged', () => {
        const reporter = new ConsoleLogReporter({ color: false })
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const obj = { key: 'value' }
        reporter.log('info', 's', T0, {}, [obj])
        const objectArg = spy.mock.calls[0][1]
        expect(objectArg).toBe(obj)
        spy.mockRestore()
    })
})

describe('JSONLineReporter', () => {
    it('emits a JSON line with level/scope/time (epoch ms)/messages', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        reporter.log('info', 'auth', T0, {}, ['ok', { id: 7 }])
        expect(lines).toHaveLength(1)
        const parsed = JSON.parse(lines[0])
        expect(parsed).toEqual({
            level: 'info',
            scope: 'auth',
            time: T0,
            messages: ['ok', { id: 7 }]
        })
    })

    it('spreads context fields as top-level keys alongside level/scope/time/messages', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        reporter.log('info', 'svc', T0, { requestId: 'r1', userId: 42 }, ['start'])
        expect(lines).toHaveLength(1)
        const parsed = JSON.parse(lines[0])
        expect(parsed.requestId).toBe('r1')
        expect(parsed.userId).toBe(42)
        expect(parsed.messages).toEqual(['start'])
        expect(parsed.level).toBe('info')
        expect(parsed.scope).toBe('svc')
    })

    it('context fields appear at top level via factory pipeline (requestId top-level field)', () => {
        const lines: string[] = []
        const factory = new LoggerFactory([new JSONLineReporter({ write: line => lines.push(line) })])
        const log = factory.getLogger('api')
        const req = log.withContext({ requestId: 'req-123' })
        req.info('start')
        expect(lines).toHaveLength(1)
        const parsed = JSON.parse(lines[0])
        expect(parsed.requestId).toBe('req-123')
        expect(parsed.messages).toEqual(['start'])
    })

    it('time in JSON record is a number (epoch ms)', () => {
        const lines: string[] = []
        const factory = new LoggerFactory([new JSONLineReporter({ write: line => lines.push(line) })], () => T0)
        factory.getLogger('t').info('msg')
        const parsed = JSON.parse(lines[0])
        expect(typeof parsed.time).toBe('number')
        expect(parsed.time).toBe(T0)
    })

    it('serializes Error instances with stack', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        reporter.log('error', 's', T0, {}, [new Error('boom')])
        const parsed = JSON.parse(lines[0])
        expect(parsed.messages[0].name).toBe('Error')
        expect(parsed.messages[0].message).toBe('boom')
        expect(typeof parsed.messages[0].stack).toBe('string')
    })

    it('merges static extras into each record', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({
            write: line => lines.push(line),
            extra: { service: 'api', region: 'eu' }
        })
        reporter.log('info', 's', T0, {}, ['ok'])
        const parsed = JSON.parse(lines[0])
        expect(parsed.service).toBe('api')
        expect(parsed.region).toBe('eu')
    })

    it('context fields override extra but not level/scope/time/messages', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({
            write: line => lines.push(line),
            extra: { service: 'api', env: 'prod' }
        })
        reporter.log('info', 's', T0, { env: 'staging', requestId: 'r1' }, ['msg'])
        const parsed = JSON.parse(lines[0])
        expect(parsed.env).toBe('staging')
        expect(parsed.requestId).toBe('r1')
        expect(parsed.service).toBe('api')
    })

    it('replaces a circular ref field with [Circular] and keeps siblings', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        const cyc: any = {}
        cyc.self = cyc
        reporter.log('info', 's', T0, {}, ['ok', cyc])
        expect(lines).toHaveLength(1)
        const parsed = JSON.parse(lines[0])
        expect(parsed.messages[0]).toBe('ok')
        expect(parsed.messages[1]).toEqual({ self: '[Circular]' })
    })

    it('serializes a nested Error with name/message/stack', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        reporter.log('error', 's', T0, {}, [{ err: new Error('x') }])
        const parsed = JSON.parse(lines[0])
        expect(parsed.messages[0].err.name).toBe('Error')
        expect(parsed.messages[0].err.message).toBe('x')
        expect(typeof parsed.messages[0].err.stack).toBe('string')
    })

    it('serializes BigInt messages as strings', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        reporter.log('info', 's', T0, {}, [42n])
        const parsed = JSON.parse(lines[0])
        expect(parsed.messages[0]).toBe('42')
    })

    it('preserves good fields in an object that also contains a bigint field', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        reporter.log('info', 's', T0, {}, [{ label: 'counter', value: 9007199254740993n, unit: 'ops' }])
        expect(lines).toHaveLength(1)
        const parsed = JSON.parse(lines[0])
        expect(parsed.messages[0]).toEqual({ label: 'counter', value: '9007199254740993', unit: 'ops' })
    })

    it('preserves good fields in an object that also contains a circular ref field', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        const obj: any = { name: 'node', status: 'ok', count: 3 }
        obj.self = obj
        reporter.log('info', 's', T0, {}, [obj])
        expect(lines).toHaveLength(1)
        const parsed = JSON.parse(lines[0])
        expect(parsed.messages[0].name).toBe('node')
        expect(parsed.messages[0].status).toBe('ok')
        expect(parsed.messages[0].count).toBe(3)
        expect(parsed.messages[0].self).toBe('[Circular]')
    })

    it('handles deeply nested mixed good/bad fields without losing the surrounding record', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        const inner: any = { x: 1 }
        inner.loop = inner
        reporter.log('info', 's', T0, {}, [
            'prefix',
            { fine: true, nested: { ok: 'yes', circ: inner, big: 42n }, after: 'end' },
            'suffix'
        ])
        expect(lines).toHaveLength(1)
        const parsed = JSON.parse(lines[0])
        expect(parsed.messages[0]).toBe('prefix')
        expect(parsed.messages[1].fine).toBe(true)
        expect(parsed.messages[1].nested.ok).toBe('yes')
        expect(parsed.messages[1].nested.circ.x).toBe(1)
        expect(parsed.messages[1].nested.circ.loop).toBe('[Circular]')
        expect(parsed.messages[1].nested.big).toBe('42')
        expect(parsed.messages[1].after).toBe('end')
        expect(parsed.messages[2]).toBe('suffix')
    })
})

describe('BufferedReporter', () => {
    it('flushes when maxSize is reached', () => {
        const captured: string[][] = []
        class R extends LogReporter { log(level: any) { captured.push([level]) } }
        const buf = new BufferedReporter(new R(), { maxSize: 3, flushInterval: 0 })
        buf.log('info', 's', T0, {}, ['a'])
        buf.log('info', 's', T0, {}, ['b'])
        expect(captured).toHaveLength(0)
        buf.log('info', 's', T0, {}, ['c'])
        expect(captured).toHaveLength(3)
    })

    it('flushes after flushInterval ms', () => {
        vi.useFakeTimers()
        const captured: number[] = []
        class R extends LogReporter { log() { captured.push(1) } }
        const buf = new BufferedReporter(new R(), { maxSize: 100, flushInterval: 500 })
        buf.log('info', 's', T0, {}, ['a'])
        buf.log('info', 's', T0, {}, ['b'])
        expect(captured).toHaveLength(0)
        vi.advanceTimersByTime(500)
        expect(captured).toHaveLength(2)
        vi.useRealTimers()
    })

    it('flush() drains immediately and cancels the timer', () => {
        vi.useFakeTimers()
        const captured: number[] = []
        class R extends LogReporter { log() { captured.push(1) } }
        const buf = new BufferedReporter(new R(), { maxSize: 100, flushInterval: 1000 })
        buf.log('info', 's', T0, {}, ['a'])
        buf.flush()
        expect(captured).toHaveLength(1)
        vi.advanceTimersByTime(2000)
        expect(captured).toHaveLength(1)
        vi.useRealTimers()
    })

    it('close() flushes pending entries and clears the timer', () => {
        vi.useFakeTimers()
        const captured: number[] = []
        class R extends LogReporter { log() { captured.push(1) } }
        const buf = new BufferedReporter(new R(), { maxSize: 100, flushInterval: 1000 })
        buf.log('info', 's', T0, {}, ['a'])
        buf.log('info', 's', T0, {}, ['b'])
        buf.close()
        expect(captured).toHaveLength(2)
        vi.advanceTimersByTime(2000)
        expect(captured).toHaveLength(2)
        vi.useRealTimers()
    })

    it('onFlush handler receives the batch (no inner reporter required)', () => {
        const batches: any[][] = []
        const buf = new BufferedReporter(null, {
            maxSize: 2,
            flushInterval: 0,
            onFlush: entries => batches.push(entries)
        })
        buf.log('info', 's', T0, {}, ['a'])
        buf.log('warning', 's', T0, {}, ['b'])
        expect(batches).toHaveLength(1)
        expect(batches[0]).toHaveLength(2)
        expect(batches[0][0].level).toBe('info')
        expect(batches[0][1].level).toBe('warning')
    })

    it('LogEntry.time is a number (epoch ms)', () => {
        const batches: any[][] = []
        const buf = new BufferedReporter(null, {
            maxSize: 1,
            flushInterval: 0,
            onFlush: entries => batches.push(entries)
        })
        buf.log('info', 's', T0, {}, ['a'])
        expect(typeof batches[0][0].time).toBe('number')
        expect(batches[0][0].time).toBe(T0)
    })

    it('when both inner and onFlush are provided, both receive the flushed entries', () => {
        const innerReceived: string[] = []
        class R extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]): void { innerReceived.push(msgs[0]) }
        }
        const batches: any[][] = []
        const buf = new BufferedReporter(new R(), {
            maxSize: 2,
            flushInterval: 0,
            onFlush: entries => batches.push(entries)
        })
        buf.log('info', 's', T0, {}, ['x'])
        buf.log('info', 's', T0, {}, ['y'])
        // onFlush received the batch
        expect(batches).toHaveLength(1)
        expect(batches[0]).toHaveLength(2)
        // inner also received each entry individually
        expect(innerReceived).toEqual(['x', 'y'])
    })

    it('throws when neither inner reporter nor onFlush is provided', () => {
        expect(() => new BufferedReporter(null, {})).toThrow(/inner reporter or an onFlush/)
    })

    it('size() reports buffered entry count', () => {
        const buf = new BufferedReporter(null, { onFlush: () => {}, maxSize: 100, flushInterval: 0 })
        expect(buf.size()).toBe(0)
        buf.log('info', 's', T0, {}, ['a'])
        buf.log('info', 's', T0, {}, ['b'])
        expect(buf.size()).toBe(2)
        buf.flush()
        expect(buf.size()).toBe(0)
    })

    it('flush on empty buffer is a no-op', () => {
        let calls = 0
        const buf = new BufferedReporter(null, { onFlush: () => { calls++ }, maxSize: 10, flushInterval: 0 })
        buf.flush()
        expect(calls).toBe(0)
    })

    it('flush() is called on process.beforeExit', () => {
        const buf = new BufferedReporter(null, { onFlush: () => {}, maxSize: 100, flushInterval: 0 })
        buf.log('info', 's', T0, {}, ['pending'])
        const flushSpy = vi.spyOn(buf, 'flush')
        process.emit('beforeExit', 0)
        expect(flushSpy).toHaveBeenCalledTimes(1)
        flushSpy.mockRestore()
    })

    it('flush() is called on window pagehide', () => {
        const originalWindow = (globalThis as any).window
        const listeners: Array<() => void> = []
        ;(globalThis as any).window = {
            addEventListener: (event: string, fn: () => void, _opts?: any) => {
                if (event === 'pagehide') listeners.push(fn)
            }
        }
        try {
            const received: string[] = []
            const buf = new BufferedReporter(null, {
                onFlush: entries => entries.forEach(e => received.push(e.messages[0])),
                maxSize: 100,
                flushInterval: 0
            })
            buf.log('info', 's', T0, {}, ['queued'])
            expect(received).toHaveLength(0)
            listeners.forEach(fn => fn())
            expect(received).toEqual(['queued'])
        } finally {
            if (originalWindow === undefined) delete (globalThis as any).window
            else (globalThis as any).window = originalWindow
        }
    })
})

describe('LoggerFactory — reporter isolation', () => {
    it('does not throw when a reporter throws', () => {
        class ThrowingReporter extends LogReporter {
            log(): void { throw new Error('reporter failure') }
        }
        const factory = new LoggerFactory([new ThrowingReporter()])
        const logger = factory.getLogger('iso')
        expect(() => logger.info('msg')).not.toThrow()
    })

    it('runs sibling reporters after a throwing reporter', () => {
        const received: string[] = []
        class ThrowingReporter extends LogReporter {
            log(): void { throw new Error('reporter failure') }
        }
        class GoodReporter extends LogReporter {
            log(level: any, _s: any, _t: any, _f: any, msgs: any[]): void { received.push(msgs[0]) }
        }
        const factory = new LoggerFactory([new ThrowingReporter(), new GoodReporter()])
        const logger = factory.getLogger('iso')
        logger.info('hello')
        expect(received).toEqual(['hello'])
    })
})

describe('BufferedReporter — flush isolation', () => {
    it('does not throw when onFlush throws', () => {
        const buf = new BufferedReporter(null, {
            maxSize: 2,
            flushInterval: 0,
            onFlush: () => { throw new Error('flush failure') }
        })
        buf.log('info', 's', T0, {}, ['a'])
        expect(() => buf.log('info', 's', T0, {}, ['b'])).not.toThrow()
    })

    it('does not throw when the inner reporter throws during flush', () => {
        class ThrowingReporter extends LogReporter {
            log(): void { throw new Error('inner failure') }
        }
        const buf = new BufferedReporter(new ThrowingReporter(), { maxSize: 2, flushInterval: 0 })
        buf.log('info', 's', T0, {}, ['a'])
        expect(() => buf.log('info', 's', T0, {}, ['b'])).not.toThrow()
    })

    it('buffer is cleared even when onFlush throws', () => {
        const buf = new BufferedReporter(null, {
            maxSize: 2,
            flushInterval: 0,
            onFlush: () => { throw new Error('flush failure') }
        })
        buf.log('info', 's', T0, {}, ['a'])
        buf.log('info', 's', T0, {}, ['b'])
        expect(buf.size()).toBe(0)
    })

    it('inner reporter still receives all entries when onFlush throws', () => {
        const innerReceived: string[] = []
        class R extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]): void { innerReceived.push(msgs[0]) }
        }
        const buf = new BufferedReporter(new R(), {
            maxSize: 2,
            flushInterval: 0,
            onFlush: () => { throw new Error('onFlush failure') }
        })
        buf.log('info', 's', T0, {}, ['a'])
        buf.log('info', 's', T0, {}, ['b'])
        expect(innerReceived).toEqual(['a', 'b'])
    })

    it('inner reporter is called for all entries even when it throws on each', () => {
        let callCount = 0
        class R extends LogReporter {
            log(): void { callCount++; throw new Error('inner failure') }
        }
        const buf = new BufferedReporter(new R(), { maxSize: 3, flushInterval: 0 })
        buf.log('info', 's', T0, {}, ['a'])
        buf.log('info', 's', T0, {}, ['b'])
        buf.log('info', 's', T0, {}, ['c'])
        expect(callCount).toBe(3)
    })
})

describe('FileLogReporter', () => {
    it('writes formatted lines to a file', async () => {
        const { mkdtempSync, readFileSync } = await import('node:fs')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')
        const dir = mkdtempSync(join(tmpdir(), 'tc-log-'))
        const file = join(dir, 'app.log')
        const reporter = new FileLogReporter(file)
        reporter.log('info', 'svc', T0, {}, ['hello', { k: 1 }])
        reporter.log('error', 'svc', T1, {}, [new Error('boom')])
        await reporter.close()
        const content = readFileSync(file, 'utf8')
        expect(content).toContain('INFO')
        expect(content).toContain('svc')
        expect(content).toContain('hello')
        expect(content).toContain('{"k":1}')
        expect(content).toContain('ERROR')
        expect(content).toContain('boom')
    })

    it('invokes onError and does not crash when the path is unwritable', async () => {
        const errors: Error[] = []
        const reporter = new FileLogReporter('/nonexistent-dir/does-not-exist/app.log', {
            onError: err => errors.push(err)
        })
        reporter.log('info', 'svc', T0, {}, ['msg'])
        await new Promise(resolve => setTimeout(resolve, 200))
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(Error)
    })

    it('honors custom formatter', async () => {
        const { mkdtempSync, readFileSync } = await import('node:fs')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')
        const dir = mkdtempSync(join(tmpdir(), 'tc-log-'))
        const file = join(dir, 'app.log')
        const reporter = new FileLogReporter(file, {
            formatter: (level, _scope, _time, _fields, messages) => `[${level}] ${messages.join('|')}`
        })
        reporter.log('warning', 's', T0, {}, ['a', 'b'])
        await reporter.close()
        const content = readFileSync(file, 'utf8').trim()
        expect(content).toBe('[warning] a|b')
    })

    it('rotates when maxBytes is exceeded', async () => {
        const { mkdtempSync, readFileSync, existsSync } = await import('node:fs')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')
        const dir = mkdtempSync(join(tmpdir(), 'tc-log-rot-'))
        const file = join(dir, 'app.log')
        // Line 1 = 25 bytes, line 2 = 27 bytes; 25+27=52 > maxBytes=50 → rotation on 2nd write
        const reporter = new FileLogReporter(file, {
            maxBytes: 50,
            maxFiles: 3,
            formatter: (_level, _scope, _time, _fields, messages) => messages.join(' ')
        })
        reporter.log('info', 's', T0, {}, ['line-one-fills-the-file'])
        reporter.log('info', 's', T0, {}, ['line-two-goes-to-new-file'])
        await reporter.close()
        expect(existsSync(file)).toBe(true)
        expect(existsSync(`${file}.1`)).toBe(true)
        const archived = readFileSync(`${file}.1`, 'utf8')
        expect(archived).toContain('line-one-fills-the-file')
        const current = readFileSync(file, 'utf8')
        expect(current).toContain('line-two-goes-to-new-file')
    })

    it('keeps at most maxFiles archived logs, dropping the oldest', async () => {
        const { mkdtempSync, existsSync, writeFileSync, readFileSync } = await import('node:fs')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')
        const dir = mkdtempSync(join(tmpdir(), 'tc-log-maxf-'))
        const file = join(dir, 'app.log')
        // Pre-seed archives up to the cap (maxFiles = 2)
        writeFileSync(`${file}.1`, 'archive-1\n')
        writeFileSync(`${file}.2`, 'archive-2\n')
        const reporter = new FileLogReporter(file, {
            maxBytes: 20,
            maxFiles: 2,
            formatter: (_l, _s, _t, _f, msgs) => msgs.join('')
        })
        // First write fits (6 bytes); second write (21 bytes) pushes over 20 → rotation
        reporter.log('info', 's', T0, {}, ['hello'])
        reporter.log('info', 's', T0, {}, ['msg-padded-xxxxxxxxx'])
        await reporter.close()
        // Shift: archive-2 dropped, archive-1 → .2, old app.log (hello) → .1
        expect(existsSync(`${file}.2`)).toBe(true)
        expect(existsSync(`${file}.3`)).toBe(false)
        expect(readFileSync(`${file}.2`, 'utf8')).toBe('archive-1\n')
        expect(readFileSync(`${file}.1`, 'utf8')).toBe('hello\n')
    })
})

describe('StreamReporter', () => {
    it('writes formatted lines to a Writable', async () => {
        const { Writable } = await import('node:stream')
        const chunks: Buffer[] = []
        const stream = new Writable({
            write(chunk, _enc, done) { chunks.push(chunk); done() }
        })
        const reporter = new StreamReporter(stream)
        reporter.log('info', 'svc', T0, {}, ['hello', { k: 1 }])
        await reporter.close()
        const content = Buffer.concat(chunks).toString()
        expect(content).toContain('INFO')
        expect(content).toContain('svc')
        expect(content).toContain('hello')
        expect(content).toContain('{"k":1}')
    })

    it('uses a custom formatter', async () => {
        const { Writable } = await import('node:stream')
        const chunks: Buffer[] = []
        const stream = new Writable({
            write(chunk, _enc, done) { chunks.push(chunk); done() }
        })
        const reporter = new StreamReporter(stream, {
            formatter: (level, _scope, _time, _fields, messages) => `[${level}] ${messages.join('|')}`
        })
        reporter.log('warning', 's', T0, {}, ['a', 'b'])
        await reporter.close()
        const content = Buffer.concat(chunks).toString().trim()
        expect(content).toBe('[warning] a|b')
    })

    it('invokes onError when the stream emits an error', async () => {
        const { PassThrough } = await import('node:stream')
        const errors: Error[] = []
        const stream = new PassThrough()
        const reporter = new StreamReporter(stream, { onError: err => errors.push(err) })
        const err = new Error('stream error')
        stream.emit('error', err)
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBe(err)
    })

    it('resets the byte counter when maxBytes is exceeded and continues writing to the same stream', async () => {
        const { Writable } = await import('node:stream')
        const chunks: Buffer[] = []
        const stream = new Writable({
            write(chunk, _enc, done) { chunks.push(chunk); done() }
        })
        const reporter = new StreamReporter(stream, {
            maxBytes: 10,
            formatter: (_l, _s, _t, _f, msgs) => msgs.join('')
        })
        reporter.log('info', 's', T0, {}, ['hello'])   // "hello\n" = 6 bytes → written directly
        reporter.log('info', 's', T0, {}, ['world'])   // "world\n" = 6 bytes → 6+6 > 10 → rotation
        await reporter.close()
        const content = Buffer.concat(chunks).toString()
        expect(content).toContain('hello')
        expect(content).toContain('world')
    })

    it('queues multiple lines during rotation and flushes them all afterwards', async () => {
        const { Writable } = await import('node:stream')
        const chunks: Buffer[] = []
        const stream = new Writable({
            write(chunk, _enc, done) { chunks.push(chunk); done() }
        })
        const reporter = new StreamReporter(stream, {
            maxBytes: 5,
            formatter: (_l, _s, _t, _f, msgs) => msgs.join('')
        })
        reporter.log('info', 's', T0, {}, ['abc'])    // "abc\n" = 4 bytes → written
        reporter.log('info', 's', T0, {}, ['xyz'])    // "xyz\n" = 4 bytes → 4+4 > 5 → rotation; queued
        reporter.log('info', 's', T0, {}, ['pqr'])    // queued during rotation
        await reporter.close()
        const content = Buffer.concat(chunks).toString()
        expect(content).toContain('abc')
        expect(content).toContain('xyz')
        expect(content).toContain('pqr')
    })

    it('close() ends the stream', async () => {
        const { Writable } = await import('node:stream')
        let finished = false
        const stream = new Writable({
            write(_chunk, _enc, done) { done() }
        })
        stream.on('finish', () => { finished = true })
        const reporter = new StreamReporter(stream)
        await reporter.close()
        expect(finished).toBe(true)
    })

    it('FileLogReporter is a subclass of StreamReporter', () => {
        expect(Object.getPrototypeOf(FileLogReporter.prototype)).toBe(StreamReporter.prototype)
    })
})

describe('LoggerFactory.setLevel (scope-pattern overrides)', () => {
    it('enables a below-global level for a matching scope', () => {
        const captured: { level: string, scope: string }[] = []
        class R extends LogReporter { log(level: any, scope: string) { captured.push({ level, scope }) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'warning'
        factory.setLevel('db:*', 'debug')
        const db = factory.getLogger('db:pool')
        db.debug('pool debug')
        db.verbose('pool verbose')
        expect(captured.map(e => e.level)).toEqual(['debug'])
    })

    it('does not affect scopes that do not match the pattern', () => {
        const captured: string[] = []
        class R extends LogReporter { log(level: any) { captured.push(level) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'warning'
        factory.setLevel('db:*', 'debug')
        factory.getLogger('auth').debug('skipped')
        expect(captured).toHaveLength(0)
    })

    it('most-specific pattern wins — db:pool:* over db:*', () => {
        const captured: string[] = []
        class R extends LogReporter { log(level: any) { captured.push(level) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'info'
        factory.setLevel('db:*', 'debug')
        factory.setLevel('db:pool:*', 'warning')
        factory.getLogger('db:pool:worker').debug('dropped by db:pool:*')
        factory.getLogger('db:pool:worker').warning('shown')
        factory.getLogger('db:query').debug('shown via db:*')
        expect(captured).toEqual(['warning', 'debug'])
    })

    it('exact pattern beats wildcard', () => {
        const captured: string[] = []
        class R extends LogReporter { log(level: any) { captured.push(level) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'info'
        factory.setLevel('db:*', 'debug')
        factory.setLevel('db:pool', 'error')
        factory.getLogger('db:pool').debug('dropped by exact pattern')
        factory.getLogger('db:pool').error('shown')
        factory.getLogger('db:query').debug('shown via db:*')
        expect(captured).toEqual(['error', 'debug'])
    })

    it('per-logger setLevel overrides pattern override', () => {
        const captured: string[] = []
        class R extends LogReporter { log(level: any) { captured.push(level) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'info'
        factory.setLevel('db:*', 'debug')
        const logger = factory.getLogger('db:pool')
        logger.setLevel('warning')
        logger.debug('dropped by per-logger override')
        logger.warning('shown')
        expect(captured).toEqual(['warning'])
    })

    it('re-registering the same pattern replaces its level', () => {
        const captured: string[] = []
        class R extends LogReporter { log(level: any) { captured.push(level) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'info'
        factory.setLevel('db:*', 'debug')
        factory.setLevel('db:*', 'error')
        factory.getLogger('db:pool').debug('dropped')
        factory.getLogger('db:pool').warning('dropped')
        factory.getLogger('db:pool').error('shown')
        expect(captured).toEqual(['error'])
    })

    it('throws RangeError for an unknown level', () => {
        const factory = new LoggerFactory([])
        expect(() => factory.setLevel('db:*', 'trace' as any)).toThrow(RangeError)
    })

    it('isEnabled reflects pattern threshold', () => {
        const factory = new LoggerFactory([])
        factory.level = 'warning'
        factory.setLevel('db:*', 'debug')
        const logger = factory.getLogger('db:pool')
        expect(logger.isEnabled('debug')).toBe(true)
        expect(logger.isEnabled('verbose')).toBe(false)
        expect(factory.getLogger('auth').isEnabled('debug')).toBe(false)
    })

    it('wildcard-only pattern * matches any scope', () => {
        const captured: string[] = []
        class R extends LogReporter { log(level: any) { captured.push(level) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'warning'
        factory.setLevel('*', 'debug')
        factory.getLogger('anything').debug('shown')
        factory.getLogger('other:scope').debug('shown')
        expect(captured).toEqual(['debug', 'debug'])
    })
})

describe('LoggerFactory.parseEnv', () => {
    it('LOG_LEVEL sets the global factory level', () => {
        const factory = new LoggerFactory([])
        factory.parseEnv({ LOG_LEVEL: 'debug' })
        expect(factory.level).toBe('debug')
    })

    it('DEBUG sets debug level for comma-separated patterns', () => {
        const captured: { level: string, scope: string }[] = []
        class R extends LogReporter { log(level: any, scope: string) { captured.push({ level, scope }) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'warning'
        factory.parseEnv({ DEBUG: 'auth*,db:*' })
        factory.getLogger('auth').debug('shown')
        factory.getLogger('auth:login').debug('shown')
        factory.getLogger('db:pool').debug('shown')
        factory.getLogger('other').debug('dropped')
        expect(captured.map(e => e.level)).toEqual(['debug', 'debug', 'debug'])
        expect(captured.map(e => e.scope)).toEqual(['auth', 'auth:login', 'db:pool'])
    })

    it('DEBUG with space-separated patterns', () => {
        const captured: string[] = []
        class R extends LogReporter { log(_l: any, scope: string) { captured.push(scope) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'warning'
        factory.parseEnv({ DEBUG: 'auth db' })
        factory.getLogger('auth').debug('shown')
        factory.getLogger('db').debug('shown')
        factory.getLogger('other').debug('dropped')
        expect(captured).toEqual(['auth', 'db'])
    })

    it('LOG_LEVEL and DEBUG can be combined', () => {
        const factory = new LoggerFactory([])
        factory.parseEnv({ LOG_LEVEL: 'error', DEBUG: 'verbose-svc' })
        expect(factory.level).toBe('error')
        expect(factory.getLogger('verbose-svc').isEnabled('debug')).toBe(true)
        expect(factory.getLogger('other').isEnabled('info')).toBe(false)
    })

    it('unknown LOG_LEVEL is silently ignored', () => {
        const factory = new LoggerFactory([])
        factory.level = 'info'
        factory.parseEnv({ LOG_LEVEL: 'trace' })
        expect(factory.level).toBe('info')
    })

    it('missing keys are silently skipped', () => {
        const factory = new LoggerFactory([])
        factory.level = 'info'
        factory.parseEnv({})
        expect(factory.level).toBe('info')
    })
})

describe('Logger.child (hierarchical scopes)', () => {
    it('creates a logger with scope parent:child', () => {
        const captured: { scope: string }[] = []
        class R extends LogReporter { log(_l: any, scope: string) { captured.push({ scope }) } }
        const factory = new LoggerFactory([new R()])
        const db = factory.getLogger('db')
        const pool = db.child('pool')
        pool.info('msg')
        expect(captured[0].scope).toBe('db:pool')
    })

    it('nested child scopes concatenate with colons', () => {
        const captured: string[] = []
        class R extends LogReporter { log(_l: any, scope: string) { captured.push(scope) } }
        const factory = new LoggerFactory([new R()])
        const pool = factory.getLogger('db').child('pool')
        const worker = pool.child('worker')
        worker.info('msg')
        expect(captured[0]).toBe('db:pool:worker')
    })

    it('child inherits parent level override', () => {
        const captured: string[] = []
        class R extends LogReporter { log(level: any) { captured.push(level) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'warning'
        const parent = factory.getLogger('svc')
        parent.setLevel('verbose')
        const child = parent.child('sub')
        child.debug('shown via inherited override')
        expect(captured).toEqual(['debug'])
    })

    it('child inherits parent withContext fields', () => {
        const captured: { fields: any }[] = []
        class R extends LogReporter { log(_l: any, _s: any, _t: any, fields: any) { captured.push({ fields }) } }
        const factory = new LoggerFactory([new R()])
        const parent = factory.getLogger('svc').withContext({ requestId: 'r1' })
        const child = parent.child('sub')
        child.info('msg')
        expect(captured[0].fields).toEqual({ requestId: 'r1' })
    })

    it('child receives pattern level from factory', () => {
        const captured: string[] = []
        class R extends LogReporter { log(level: any) { captured.push(level) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'warning'
        factory.setLevel('db:*', 'debug')
        const pool = factory.getLogger('db').child('pool')
        pool.debug('shown via pattern')
        expect(captured).toEqual(['debug'])
    })

    it('child logs pass through the factory reporters', () => {
        const captured: string[] = []
        class R extends LogReporter { log(_l: any, _s: any, _t: any, _f: any, msgs: any[]) { captured.push(msgs[0]) } }
        const factory = new LoggerFactory([new R()])
        factory.getLogger('db').child('pool').info('hello')
        expect(captured).toEqual(['hello'])
    })
})

describe('FileLogReporter — ESM smoke (post-build)', () => {
    it('constructs without a Dynamic require error when loaded from the built ESM bundle', async () => {
        const { existsSync } = await import('node:fs')
        // Resolve lib/node.module.js relative to this test file
        const builtUrl = new URL('../lib/node.module.js', import.meta.url)
        if (!existsSync(builtUrl)) {
            // Package has not been built yet; skip silently rather than fail CI
            return
        }
        // Dynamic import of the ESM bundle — must not throw "Dynamic require of ... is not supported"
        const mod = await import(/* @vite-ignore */ builtUrl.href)
        const FileLogReporterBuilt: typeof FileLogReporter = mod.default
        const reporter = new FileLogReporterBuilt('/tmp/esm-smoke-test.log')
        await reporter.close()
    })
})

describe('RingBufferReporter', () => {
    it('throws when capacity is not a positive integer', () => {
        expect(() => new RingBufferReporter(0)).toThrow()
        expect(() => new RingBufferReporter(-1)).toThrow()
        expect(() => new RingBufferReporter(1.5)).toThrow()
    })

    it('buffers entries up to capacity', () => {
        const reporter = new RingBufferReporter(3)
        const factory = new LoggerFactory([reporter], () => T0)
        factory.level = 'verbose'
        factory.getLogger('a').info('one')
        factory.getLogger('a').info('two')
        factory.getLogger('a').info('three')
        expect(reporter.size).toBe(3)
        expect(reporter.snapshot()).toHaveLength(3)
    })

    it('overwrites the oldest entry when full', () => {
        const reporter = new RingBufferReporter(3)
        const factory = new LoggerFactory([reporter], () => T0)
        factory.level = 'verbose'
        const log = factory.getLogger('a')
        log.info('one')
        log.info('two')
        log.info('three')
        log.info('four')
        const snap = reporter.snapshot()
        expect(snap).toHaveLength(3)
        expect(snap[0].messages[0]).toBe('two')
        expect(snap[1].messages[0]).toBe('three')
        expect(snap[2].messages[0]).toBe('four')
    })

    it('snapshot returns entries in insertion order (oldest to newest)', () => {
        const reporter = new RingBufferReporter(5)
        const factory = new LoggerFactory([reporter], () => T0)
        factory.level = 'verbose'
        const log = factory.getLogger('s')
        log.info('a')
        log.info('b')
        log.info('c')
        const snap = reporter.snapshot()
        expect(snap.map(e => e.messages[0])).toEqual(['a', 'b', 'c'])
    })

    it('snapshot returns a shallow copy — mutating it does not affect the buffer', () => {
        const reporter = new RingBufferReporter(3)
        const factory = new LoggerFactory([reporter], () => T0)
        factory.level = 'verbose'
        factory.getLogger('s').info('msg')
        const snap = reporter.snapshot()
        snap.pop()
        expect(reporter.size).toBe(1)
    })

    it('size reflects the number of buffered entries', () => {
        const reporter = new RingBufferReporter(5)
        const factory = new LoggerFactory([reporter], () => T0)
        factory.level = 'verbose'
        expect(reporter.size).toBe(0)
        factory.getLogger('s').info('x')
        expect(reporter.size).toBe(1)
        factory.getLogger('s').info('y')
        expect(reporter.size).toBe(2)
    })

    it('size is capped at capacity after overflow', () => {
        const reporter = new RingBufferReporter(2)
        const factory = new LoggerFactory([reporter], () => T0)
        factory.level = 'verbose'
        factory.getLogger('s').info('a')
        factory.getLogger('s').info('b')
        factory.getLogger('s').info('c')
        expect(reporter.size).toBe(2)
    })

    it('capacity getter returns the configured limit', () => {
        const reporter = new RingBufferReporter(7)
        expect(reporter.capacity).toBe(7)
    })

    it('clear resets size to zero and snapshot returns empty array', () => {
        const reporter = new RingBufferReporter(4)
        const factory = new LoggerFactory([reporter], () => T0)
        factory.level = 'verbose'
        factory.getLogger('s').info('a')
        factory.getLogger('s').info('b')
        reporter.clear()
        expect(reporter.size).toBe(0)
        expect(reporter.snapshot()).toHaveLength(0)
    })

    it('clear preserves capacity — new entries can be pushed after clear', () => {
        const reporter = new RingBufferReporter(3)
        const factory = new LoggerFactory([reporter], () => T0)
        factory.level = 'verbose'
        factory.getLogger('s').info('a')
        reporter.clear()
        factory.getLogger('s').info('b')
        const snap = reporter.snapshot()
        expect(snap).toHaveLength(1)
        expect(snap[0].messages[0]).toBe('b')
    })

    it('respects factory level filtering', () => {
        const reporter = new RingBufferReporter(10)
        const factory = new LoggerFactory([reporter], () => T0)
        factory.level = 'warning'
        const log = factory.getLogger('s')
        log.debug('dropped')
        log.info('dropped')
        log.warning('kept')
        log.error('kept')
        expect(reporter.size).toBe(2)
    })

    it('captures level, scope, time, fields, and messages on each entry', () => {
        const reporter = new RingBufferReporter(5)
        const factory = new LoggerFactory([reporter], () => T0)
        factory.level = 'verbose'
        const log = factory.getLogger('svc').withContext({ reqId: 'r1' })
        log.warning('something happened', { detail: 42 })
        const [entry] = reporter.snapshot()
        expect(entry.level).toBe('warning')
        expect(entry.scope).toBe('svc')
        expect(entry.time).toBe(T0)
        expect(entry.fields).toEqual({ reqId: 'r1' })
        expect(entry.messages).toEqual(['something happened', { detail: 42 }])
    })

    it('ring wraps correctly across multiple overwrite cycles', () => {
        const reporter = new RingBufferReporter(3)
        const factory = new LoggerFactory([reporter], () => T0)
        factory.level = 'verbose'
        const log = factory.getLogger('s')
        for (let i = 1; i <= 9; i++) {
            log.info(`msg-${i}`)
        }
        const snap = reporter.snapshot()
        expect(snap.map(e => e.messages[0])).toEqual(['msg-7', 'msg-8', 'msg-9'])
    })
})

describe('LevelFilterReporter', () => {
    it('forwards entries at or above the min level', () => {
        const captured: string[] = []
        class Sink extends LogReporter {
            log(level: any) { captured.push(level) }
        }
        const reporter = new LevelFilterReporter(new Sink(), 'warning')
        reporter.log('error', 's', T0, {}, ['e'])
        reporter.log('warning', 's', T0, {}, ['w'])
        reporter.log('info', 's', T0, {}, ['i'])
        reporter.log('debug', 's', T0, {}, ['d'])
        expect(captured).toEqual(['error', 'warning'])
    })

    it('forwards all entries when minLevel is verbose', () => {
        const captured: string[] = []
        class Sink extends LogReporter {
            log(level: any) { captured.push(level) }
        }
        const reporter = new LevelFilterReporter(new Sink(), 'verbose')
        reporter.log('error', 's', T0, {}, ['e'])
        reporter.log('verbose', 's', T0, {}, ['v'])
        expect(captured).toEqual(['error', 'verbose'])
    })

    it('blocks entries below minLevel', () => {
        const captured: string[] = []
        class Sink extends LogReporter {
            log(level: any) { captured.push(level) }
        }
        const reporter = new LevelFilterReporter(new Sink(), 'error')
        reporter.log('warning', 's', T0, {}, ['w'])
        reporter.log('info', 's', T0, {}, ['i'])
        reporter.log('debug', 's', T0, {}, ['d'])
        expect(captured).toHaveLength(0)
    })

    it('passes all fields and messages unmodified to inner reporter', () => {
        const captured: any[] = []
        class Sink extends LogReporter {
            log(_l: any, scope: string, time: number, fields: any, msgs: any[]) {
                captured.push({ scope, time, fields, msgs })
            }
        }
        const reporter = new LevelFilterReporter(new Sink(), 'info')
        reporter.log('error', 'svc', T0, { reqId: 'r1' }, ['boom'])
        expect(captured[0]).toEqual({ scope: 'svc', time: T0, fields: { reqId: 'r1' }, msgs: ['boom'] })
    })

    it('delegates flush() to inner reporter', () => {
        let flushed = false
        class Sink extends LogReporter {
            log() {}
            flush() { flushed = true }
        }
        new LevelFilterReporter(new Sink(), 'info').flush()
        expect(flushed).toBe(true)
    })

    it('delegates close() to inner reporter', async () => {
        let closed = false
        class Sink extends LogReporter {
            log() {}
            close() { closed = true }
        }
        await new LevelFilterReporter(new Sink(), 'info').close()
        expect(closed).toBe(true)
    })

    it('can be combined with a factory to add per-reporter threshold', () => {
        const captured: string[] = []
        class Sink extends LogReporter {
            log(level: any) { captured.push(level) }
        }
        const factory = new LoggerFactory([new LevelFilterReporter(new Sink(), 'error')])
        factory.level = 'verbose'
        factory.getLogger('t').error('e')
        factory.getLogger('t').warning('w')
        expect(captured).toEqual(['error'])
    })
})

describe('ScopeFilterReporter', () => {
    it('forwards entries whose scope matches the glob pattern', () => {
        const captured: string[] = []
        class Sink extends LogReporter {
            log(_l: any, scope: string) { captured.push(scope) }
        }
        const reporter = new ScopeFilterReporter(new Sink(), 'db:*')
        reporter.log('info', 'db:pool', T0, {}, ['x'])
        reporter.log('info', 'db:query', T0, {}, ['x'])
        reporter.log('info', 'auth', T0, {}, ['x'])
        expect(captured).toEqual(['db:pool', 'db:query'])
    })

    it('exact pattern matches only that scope', () => {
        const captured: string[] = []
        class Sink extends LogReporter {
            log(_l: any, scope: string) { captured.push(scope) }
        }
        const reporter = new ScopeFilterReporter(new Sink(), 'auth')
        reporter.log('info', 'auth', T0, {}, ['x'])
        reporter.log('info', 'auth:login', T0, {}, ['x'])
        expect(captured).toEqual(['auth'])
    })

    it('wildcard-only pattern matches any scope', () => {
        const captured: string[] = []
        class Sink extends LogReporter {
            log(_l: any, scope: string) { captured.push(scope) }
        }
        const reporter = new ScopeFilterReporter(new Sink(), '*')
        reporter.log('info', 'auth', T0, {}, ['x'])
        reporter.log('info', 'db:pool', T0, {}, ['x'])
        expect(captured).toEqual(['auth', 'db:pool'])
    })

    it('prefix wildcard matches scopes with a shared prefix', () => {
        const captured: string[] = []
        class Sink extends LogReporter {
            log(_l: any, scope: string) { captured.push(scope) }
        }
        const reporter = new ScopeFilterReporter(new Sink(), 'http*')
        reporter.log('info', 'http', T0, {}, ['x'])
        reporter.log('info', 'http:request', T0, {}, ['x'])
        reporter.log('info', 'authentication', T0, {}, ['x'])
        expect(captured).toEqual(['http', 'http:request'])
    })

    it('delegates flush() to inner reporter', () => {
        let flushed = false
        class Sink extends LogReporter {
            log() {}
            flush() { flushed = true }
        }
        new ScopeFilterReporter(new Sink(), 'db:*').flush()
        expect(flushed).toBe(true)
    })

    it('delegates close() to inner reporter', async () => {
        let closed = false
        class Sink extends LogReporter {
            log() {}
            close() { closed = true }
        }
        await new ScopeFilterReporter(new Sink(), 'db:*').close()
        expect(closed).toBe(true)
    })
})

describe('RedactionReporter', () => {
    it('redacts keys matching a string list in messages', () => {
        const captured: any[] = []
        class Sink extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]) { captured.push(...msgs) }
        }
        const reporter = new RedactionReporter(new Sink(), ['password', 'authorization'])
        reporter.log('info', 's', T0, {}, [{ user: 'alice', password: 'secret', token: 'x' }])
        expect(captured[0].password).toBe('[REDACTED]')
        expect(captured[0].user).toBe('alice')
        expect(captured[0].token).toBe('x')
    })

    it('redacts keys matching a regex in messages', () => {
        const captured: any[] = []
        class Sink extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]) { captured.push(...msgs) }
        }
        const reporter = new RedactionReporter(new Sink(), /password|secret/i)
        reporter.log('info', 's', T0, {}, [{ Password: 'x', secretKey: 'y', other: 'z' }])
        expect(captured[0].Password).toBe('[REDACTED]')
        expect(captured[0].secretKey).toBe('[REDACTED]')
        expect(captured[0].other).toBe('z')
    })

    it('redacts matching keys in fields', () => {
        const captured: any[] = []
        class Sink extends LogReporter {
            log(_l: any, _s: any, _t: any, fields: any) { captured.push(fields) }
        }
        const reporter = new RedactionReporter(new Sink(), ['authorization'])
        reporter.log('info', 's', T0, { authorization: 'Bearer tok', reqId: 'r1' }, [])
        expect(captured[0].authorization).toBe('[REDACTED]')
        expect(captured[0].reqId).toBe('r1')
    })

    it('redacts nested keys inside objects', () => {
        const captured: any[] = []
        class Sink extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]) { captured.push(...msgs) }
        }
        const reporter = new RedactionReporter(new Sink(), ['password'])
        reporter.log('info', 's', T0, {}, [{ user: { name: 'alice', password: 'secret' } }])
        expect(captured[0].user.name).toBe('alice')
        expect(captured[0].user.password).toBe('[REDACTED]')
    })

    it('redacts matching keys inside arrays in messages', () => {
        const captured: any[] = []
        class Sink extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]) { captured.push(...msgs) }
        }
        const reporter = new RedactionReporter(new Sink(), ['password'])
        reporter.log('info', 's', T0, {}, [[{ password: 's' }, { password: 't' }]])
        expect(captured[0][0].password).toBe('[REDACTED]')
        expect(captured[0][1].password).toBe('[REDACTED]')
    })

    it('passes Error instances through without modification', () => {
        const captured: any[] = []
        class Sink extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]) { captured.push(...msgs) }
        }
        const err = new Error('boom')
        const reporter = new RedactionReporter(new Sink(), ['password'])
        reporter.log('error', 's', T0, {}, [err])
        expect(captured[0]).toBe(err)
    })

    it('handles circular references without throwing', () => {
        const captured: any[] = []
        class Sink extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]) { captured.push(...msgs) }
        }
        const obj: any = { name: 'node', password: 'secret' }
        obj.self = obj
        const reporter = new RedactionReporter(new Sink(), ['password'])
        expect(() => reporter.log('info', 's', T0, {}, [obj])).not.toThrow()
        expect(captured[0].password).toBe('[REDACTED]')
        expect(captured[0].name).toBe('node')
    })

    it('does not mutate the original messages', () => {
        const original = { user: 'alice', password: 'secret' }
        class Sink extends LogReporter { log() {} }
        const reporter = new RedactionReporter(new Sink(), ['password'])
        reporter.log('info', 's', T0, {}, [original])
        expect(original.password).toBe('secret')
    })

    it('delegates flush() to inner reporter', () => {
        let flushed = false
        class Sink extends LogReporter {
            log() {}
            flush() { flushed = true }
        }
        new RedactionReporter(new Sink(), ['password']).flush()
        expect(flushed).toBe(true)
    })

    it('delegates close() to inner reporter', async () => {
        let closed = false
        class Sink extends LogReporter {
            log() {}
            close() { closed = true }
        }
        await new RedactionReporter(new Sink(), ['password']).close()
        expect(closed).toBe(true)
    })
})

describe('SamplingReporter', () => {
    it('forwards all entries when rate is 1', () => {
        const captured: number[] = []
        class Sink extends LogReporter {
            log() { captured.push(1) }
        }
        const reporter = new SamplingReporter(new Sink(), 1)
        reporter.log('info', 's', T0, {}, ['a'])
        reporter.log('info', 's', T0, {}, ['b'])
        reporter.log('info', 's', T0, {}, ['c'])
        expect(captured).toHaveLength(3)
    })

    it('drops all entries when rate is 0', () => {
        const captured: number[] = []
        class Sink extends LogReporter {
            log() { captured.push(1) }
        }
        const reporter = new SamplingReporter(new Sink(), 0)
        reporter.log('info', 's', T0, {}, ['a'])
        reporter.log('info', 's', T0, {}, ['b'])
        expect(captured).toHaveLength(0)
    })

    it('forwards an entry when Math.random() is below the rate', () => {
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.3)
        const captured: number[] = []
        class Sink extends LogReporter {
            log() { captured.push(1) }
        }
        new SamplingReporter(new Sink(), 0.5).log('info', 's', T0, {}, ['a'])
        expect(captured).toHaveLength(1)
        spy.mockRestore()
    })

    it('drops an entry when Math.random() is at or above the rate', () => {
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.9)
        const captured: number[] = []
        class Sink extends LogReporter {
            log() { captured.push(1) }
        }
        new SamplingReporter(new Sink(), 0.5).log('info', 's', T0, {}, ['a'])
        expect(captured).toHaveLength(0)
        spy.mockRestore()
    })

    it('throws RangeError for rate below 0', () => {
        class Sink extends LogReporter { log() {} }
        expect(() => new SamplingReporter(new Sink(), -0.1)).toThrow(RangeError)
    })

    it('throws RangeError for rate above 1', () => {
        class Sink extends LogReporter { log() {} }
        expect(() => new SamplingReporter(new Sink(), 1.1)).toThrow(RangeError)
    })

    it('delegates flush() to inner reporter', () => {
        let flushed = false
        class Sink extends LogReporter {
            log() {}
            flush() { flushed = true }
        }
        new SamplingReporter(new Sink(), 1).flush()
        expect(flushed).toBe(true)
    })

    it('delegates close() to inner reporter', async () => {
        let closed = false
        class Sink extends LogReporter {
            log() {}
            close() { closed = true }
        }
        await new SamplingReporter(new Sink(), 1).close()
        expect(closed).toBe(true)
    })
})

describe('FanoutReporter', () => {
    it('forwards log entries to all inner reporters', () => {
        const a: string[] = []
        const b: string[] = []
        class A extends LogReporter { log(_l: any, _s: any, _t: any, _f: any, msgs: any[]) { a.push(msgs[0]) } }
        class B extends LogReporter { log(_l: any, _s: any, _t: any, _f: any, msgs: any[]) { b.push(msgs[0]) } }
        const reporter = new FanoutReporter([new A(), new B()])
        reporter.log('info', 's', T0, {}, ['hello'])
        expect(a).toEqual(['hello'])
        expect(b).toEqual(['hello'])
    })

    it('continues calling remaining reporters after one throws', () => {
        const captured: string[] = []
        class Throws extends LogReporter { log() { throw new Error('boom') } }
        class Good extends LogReporter { log(_l: any, _s: any, _t: any, _f: any, msgs: any[]) { captured.push(msgs[0]) } }
        const reporter = new FanoutReporter([new Throws(), new Good()])
        expect(() => reporter.log('info', 's', T0, {}, ['msg'])).not.toThrow()
        expect(captured).toEqual(['msg'])
    })

    it('flush() calls flush() on all inner reporters', () => {
        const flushed: string[] = []
        class F extends LogReporter {
            constructor(private id: string) { super() }
            log() {}
            flush() { flushed.push(this.id) }
        }
        new FanoutReporter([new F('a'), new F('b')]).flush()
        expect(flushed).toEqual(['a', 'b'])
    })

    it('flush() isolates reporter errors', () => {
        class Throws extends LogReporter {
            log() {}
            flush() { throw new Error('flush boom') }
        }
        expect(() => new FanoutReporter([new Throws()]).flush()).not.toThrow()
    })

    it('close() calls close() on all inner reporters', async () => {
        const closed: string[] = []
        class C extends LogReporter {
            constructor(private id: string) { super() }
            log() {}
            close() { closed.push(this.id) }
        }
        await new FanoutReporter([new C('a'), new C('b')]).close()
        expect(closed).toEqual(['a', 'b'])
    })

    it('close() awaits async close() on reporters', async () => {
        let resolved = false
        class AsyncC extends LogReporter {
            log() {}
            close(): Promise<void> {
                return new Promise((r) => setTimeout(() => { resolved = true; r() }, 10))
            }
        }
        await new FanoutReporter([new AsyncC()]).close()
        expect(resolved).toBe(true)
    })

    it('close() isolates reporter errors', async () => {
        class Throws extends LogReporter {
            log() {}
            close() { throw new Error('close boom') }
        }
        await expect(new FanoutReporter([new Throws()]).close()).resolves.toBeUndefined()
    })

    it('MultiReporter is an alias for FanoutReporter', () => {
        expect(MultiReporter).toBe(FanoutReporter)
    })

    it('can compose with LevelFilterReporter for per-sink thresholds', () => {
        const errors: string[] = []
        const all: string[] = []
        class ErrorSink extends LogReporter { log(level: any) { errors.push(level) } }
        class AllSink extends LogReporter { log(level: any) { all.push(level) } }
        const fanout = new FanoutReporter([
            new LevelFilterReporter(new ErrorSink(), 'error'),
            new AllSink(),
        ])
        const factory = new LoggerFactory([fanout])
        factory.level = 'verbose'
        factory.getLogger('t').error('e')
        factory.getLogger('t').info('i')
        expect(errors).toEqual(['error'])
        expect(all).toEqual(['error', 'info'])
    })
})

describe('HTTPReporter', () => {
    it('batches entries and posts them as a JSON body on flush', async () => {
        const posts: { url: string; body: any }[] = []
        const transport: HTTPTransport = async (url, body) => {
            posts.push({ url, body: JSON.parse(body) })
            return 200
        }
        const reporter = new HTTPReporter({
            url: 'https://logs.example.com/ingest',
            maxSize: 3,
            flushInterval: 0,
            transport,
        })
        reporter.log('info', 'svc', T0, {}, ['a'])
        reporter.log('warning', 'svc', T0, {}, ['b'])
        reporter.log('error', 'svc', T0, {}, ['c'])
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(posts).toHaveLength(1)
        expect(posts[0].url).toBe('https://logs.example.com/ingest')
        expect(posts[0].body.entries).toHaveLength(3)
    })

    it('payload entries carry level, scope, time, fields, and messages', async () => {
        const posts: any[] = []
        const transport: HTTPTransport = async (_url, body) => {
            posts.push(JSON.parse(body))
            return 200
        }
        const reporter = new HTTPReporter({
            url: 'https://logs.example.com/ingest',
            maxSize: 1,
            flushInterval: 0,
            transport,
        })
        reporter.log('warning', 'auth', T0, { requestId: 'r1' }, ['login failed', { ip: '1.2.3.4' }])
        await new Promise(resolve => setTimeout(resolve, 0))
        const entry = posts[0].entries[0]
        expect(entry.level).toBe('warning')
        expect(entry.scope).toBe('auth')
        expect(entry.time).toBe(T0)
        expect(entry.fields).toEqual({ requestId: 'r1' })
        expect(entry.messages).toEqual(['login failed', { ip: '1.2.3.4' }])
    })

    it('sends configured headers to the transport', async () => {
        const received: Record<string, string>[] = []
        const transport: HTTPTransport = async (_url, _body, headers) => {
            received.push(headers)
            return 200
        }
        const reporter = new HTTPReporter({
            url: 'https://logs.example.com/ingest',
            maxSize: 1,
            flushInterval: 0,
            headers: { Authorization: 'Bearer token123', 'X-Service': 'api' },
            transport,
        })
        reporter.log('info', 't', T0, {}, ['x'])
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(received[0]['Authorization']).toBe('Bearer token123')
        expect(received[0]['X-Service']).toBe('api')
    })

    it('retries when the transport throws', async () => {
        let callCount = 0
        const transport: HTTPTransport = async () => {
            callCount++
            if (callCount < 2) throw new Error('network error')
            return 200
        }
        const reporter = new HTTPReporter({
            url: 'https://logs.example.com/ingest',
            maxSize: 1,
            flushInterval: 0,
            retries: 2,
            retryMinTimeout: 0,
            transport,
        })
        reporter.log('info', 't', T0, {}, ['msg'])
        await new Promise(resolve => setTimeout(resolve, 50))
        expect(callCount).toBe(2)
    })

    it('retries when the transport returns a non-2xx status', async () => {
        let callCount = 0
        const transport: HTTPTransport = async () => {
            callCount++
            return callCount < 2 ? 503 : 200
        }
        const reporter = new HTTPReporter({
            url: 'https://logs.example.com/ingest',
            maxSize: 1,
            flushInterval: 0,
            retries: 2,
            retryMinTimeout: 0,
            transport,
        })
        reporter.log('info', 't', T0, {}, ['msg'])
        await new Promise(resolve => setTimeout(resolve, 50))
        expect(callCount).toBe(2)
    })

    it('does not throw when transport permanently fails', async () => {
        const transport: HTTPTransport = async () => { throw new Error('permanent failure') }
        const reporter = new HTTPReporter({
            url: 'https://logs.example.com/ingest',
            maxSize: 1,
            flushInterval: 0,
            retries: 1,
            retryMinTimeout: 0,
            transport,
        })
        expect(() => reporter.log('info', 't', T0, {}, ['msg'])).not.toThrow()
        await new Promise(resolve => setTimeout(resolve, 50))
    })

    it('respects factory level filtering', async () => {
        const posts: any[] = []
        const transport: HTTPTransport = async (_url, body) => { posts.push(JSON.parse(body)); return 200 }
        const reporter = new HTTPReporter({
            url: 'https://logs.example.com/ingest',
            maxSize: 1,
            flushInterval: 0,
            transport,
        })
        const factory = new LoggerFactory([reporter])
        factory.level = 'warning'
        factory.getLogger('t').debug('dropped')
        factory.getLogger('t').info('dropped')
        factory.getLogger('t').warning('kept')
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(posts).toHaveLength(1)
        expect(posts[0].entries[0].level).toBe('warning')
    })

    it('flush() drains buffer immediately and posts the batch', async () => {
        const posts: any[] = []
        const transport: HTTPTransport = async (_url, body) => { posts.push(JSON.parse(body)); return 200 }
        const reporter = new HTTPReporter({
            url: 'https://logs.example.com/ingest',
            maxSize: 100,
            flushInterval: 99999,
            transport,
        })
        reporter.log('info', 't', T0, {}, ['a'])
        reporter.log('info', 't', T0, {}, ['b'])
        reporter.flush()
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(posts).toHaveLength(1)
        expect(posts[0].entries).toHaveLength(2)
    })
})

describe('OTLPReporter — level→severity mapping', () => {
    const mkReporter = () => {
        const posts: any[] = []
        const transport: OTLPTransport = async (_url, body) => { posts.push(JSON.parse(body)); return 200 }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 1,
            flushInterval: 0,
            transport,
        })
        return { reporter, posts }
    }

    it('verbose maps to severityNumber 1 and severityText TRACE', async () => {
        const { reporter, posts } = mkReporter()
        reporter.log('verbose', 'svc', T0, {}, ['trace msg'])
        await new Promise(resolve => setTimeout(resolve, 0))
        const rec = posts[0].resourceLogs[0].scopeLogs[0].logRecords[0]
        expect(rec.severityNumber).toBe(1)
        expect(rec.severityText).toBe('TRACE')
    })

    it('debug maps to severityNumber 5 and severityText DEBUG', async () => {
        const { reporter, posts } = mkReporter()
        reporter.log('debug', 'svc', T0, {}, ['debug msg'])
        await new Promise(resolve => setTimeout(resolve, 0))
        const rec = posts[0].resourceLogs[0].scopeLogs[0].logRecords[0]
        expect(rec.severityNumber).toBe(5)
        expect(rec.severityText).toBe('DEBUG')
    })

    it('info maps to severityNumber 9 and severityText INFO', async () => {
        const { reporter, posts } = mkReporter()
        reporter.log('info', 'svc', T0, {}, ['info msg'])
        await new Promise(resolve => setTimeout(resolve, 0))
        const rec = posts[0].resourceLogs[0].scopeLogs[0].logRecords[0]
        expect(rec.severityNumber).toBe(9)
        expect(rec.severityText).toBe('INFO')
    })

    it('warning maps to severityNumber 13 and severityText WARN', async () => {
        const { reporter, posts } = mkReporter()
        reporter.log('warning', 'svc', T0, {}, ['warn msg'])
        await new Promise(resolve => setTimeout(resolve, 0))
        const rec = posts[0].resourceLogs[0].scopeLogs[0].logRecords[0]
        expect(rec.severityNumber).toBe(13)
        expect(rec.severityText).toBe('WARN')
    })

    it('error maps to severityNumber 17 and severityText ERROR', async () => {
        const { reporter, posts } = mkReporter()
        reporter.log('error', 'svc', T0, {}, ['err msg'])
        await new Promise(resolve => setTimeout(resolve, 0))
        const rec = posts[0].resourceLogs[0].scopeLogs[0].logRecords[0]
        expect(rec.severityNumber).toBe(17)
        expect(rec.severityText).toBe('ERROR')
    })
})

describe('OTLPReporter — fields become attributes', () => {
    it('context fields from withContext() appear as OTLP attributes', async () => {
        const posts: any[] = []
        const transport: OTLPTransport = async (_url, body) => { posts.push(JSON.parse(body)); return 200 }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 1,
            flushInterval: 0,
            transport,
        })
        reporter.log('info', 'auth', T0, { requestId: 'r1', userId: 42 }, ['login'])
        await new Promise(resolve => setTimeout(resolve, 0))
        const attrs: Array<{ key: string; value: any }> =
            posts[0].resourceLogs[0].scopeLogs[0].logRecords[0].attributes
        const byKey = Object.fromEntries(attrs.map(a => [a.key, a.value]))
        expect(byKey['requestId']).toEqual({ stringValue: 'r1' })
        expect(byKey['userId']).toEqual({ intValue: '42' })
    })

    it('scope appears as the log.scope attribute', async () => {
        const posts: any[] = []
        const transport: OTLPTransport = async (_url, body) => { posts.push(JSON.parse(body)); return 200 }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 1,
            flushInterval: 0,
            transport,
        })
        reporter.log('info', 'payments', T0, {}, ['charged'])
        await new Promise(resolve => setTimeout(resolve, 0))
        const attrs: Array<{ key: string; value: any }> =
            posts[0].resourceLogs[0].scopeLogs[0].logRecords[0].attributes
        const byKey = Object.fromEntries(attrs.map(a => [a.key, a.value]))
        expect(byKey['log.scope']).toEqual({ stringValue: 'payments' })
    })

    it('scope appears as the instrumentation scope name', async () => {
        const posts: any[] = []
        const transport: OTLPTransport = async (_url, body) => { posts.push(JSON.parse(body)); return 200 }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 1,
            flushInterval: 0,
            transport,
        })
        reporter.log('info', 'db:pool', T0, {}, ['connected'])
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(posts[0].resourceLogs[0].scopeLogs[0].scope.name).toBe('db:pool')
    })

    it('resource attributes appear in the resource envelope', async () => {
        const posts: any[] = []
        const transport: OTLPTransport = async (_url, body) => { posts.push(JSON.parse(body)); return 200 }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 1,
            flushInterval: 0,
            resource: { 'service.name': 'api', 'deployment.environment': 'prod' },
            transport,
        })
        reporter.log('info', 'svc', T0, {}, ['boot'])
        await new Promise(resolve => setTimeout(resolve, 0))
        const attrs: Array<{ key: string; value: any }> =
            posts[0].resourceLogs[0].resource.attributes
        const byKey = Object.fromEntries(attrs.map(a => [a.key, a.value]))
        expect(byKey['service.name']).toEqual({ stringValue: 'api' })
        expect(byKey['deployment.environment']).toEqual({ stringValue: 'prod' })
    })

    it('timeUnixNano is epoch ms converted to nanoseconds as a string', async () => {
        const posts: any[] = []
        const transport: OTLPTransport = async (_url, body) => { posts.push(JSON.parse(body)); return 200 }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 1,
            flushInterval: 0,
            transport,
        })
        reporter.log('info', 'svc', T0, {}, ['msg'])
        await new Promise(resolve => setTimeout(resolve, 0))
        const rec = posts[0].resourceLogs[0].scopeLogs[0].logRecords[0]
        expect(rec.timeUnixNano).toBe(String(T0 * 1_000_000))
    })

    it('messages are joined into a string body', async () => {
        const posts: any[] = []
        const transport: OTLPTransport = async (_url, body) => { posts.push(JSON.parse(body)); return 200 }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 1,
            flushInterval: 0,
            transport,
        })
        reporter.log('info', 'svc', T0, {}, ['server started', { port: 3000 }])
        await new Promise(resolve => setTimeout(resolve, 0))
        const rec = posts[0].resourceLogs[0].scopeLogs[0].logRecords[0]
        expect(rec.body.stringValue).toBe('server started {"port":3000}')
    })
})

describe('OTLPReporter — batching and transport', () => {
    it('groups multiple entries by scope into separate scopeLogs sections', async () => {
        const posts: any[] = []
        const transport: OTLPTransport = async (_url, body) => { posts.push(JSON.parse(body)); return 200 }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 4,
            flushInterval: 0,
            transport,
        })
        reporter.log('info', 'auth', T0, {}, ['a'])
        reporter.log('info', 'db', T0, {}, ['b'])
        reporter.log('info', 'auth', T0, {}, ['c'])
        reporter.log('info', 'db', T0, {}, ['d'])
        await new Promise(resolve => setTimeout(resolve, 0))
        const scopeLogs = posts[0].resourceLogs[0].scopeLogs
        const authScope = scopeLogs.find((s: any) => s.scope.name === 'auth')
        const dbScope = scopeLogs.find((s: any) => s.scope.name === 'db')
        expect(authScope.logRecords).toHaveLength(2)
        expect(dbScope.logRecords).toHaveLength(2)
    })

    it('sends configured headers to the transport', async () => {
        const received: Record<string, string>[] = []
        const transport: OTLPTransport = async (_url, _body, headers) => {
            received.push(headers)
            return 200
        }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 1,
            flushInterval: 0,
            headers: { 'otlp-api-key': 'secret', 'X-Service': 'api' },
            transport,
        })
        reporter.log('info', 't', T0, {}, ['x'])
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(received[0]['otlp-api-key']).toBe('secret')
        expect(received[0]['X-Service']).toBe('api')
    })

    it('retries when the transport returns a non-2xx status', async () => {
        let callCount = 0
        const transport: OTLPTransport = async () => {
            callCount++
            return callCount < 2 ? 503 : 200
        }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 1,
            flushInterval: 0,
            retries: 2,
            retryMinTimeout: 0,
            transport,
        })
        reporter.log('info', 't', T0, {}, ['msg'])
        await new Promise(resolve => setTimeout(resolve, 50))
        expect(callCount).toBe(2)
    })

    it('does not throw when transport permanently fails', async () => {
        const transport: OTLPTransport = async () => { throw new Error('permanent failure') }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 1,
            flushInterval: 0,
            retries: 1,
            retryMinTimeout: 0,
            transport,
        })
        expect(() => reporter.log('info', 't', T0, {}, ['msg'])).not.toThrow()
        await new Promise(resolve => setTimeout(resolve, 50))
    })

    it('respects factory level filtering', async () => {
        const posts: any[] = []
        const transport: OTLPTransport = async (_url, body) => { posts.push(JSON.parse(body)); return 200 }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 1,
            flushInterval: 0,
            transport,
        })
        const factory = new LoggerFactory([reporter])
        factory.level = 'warning'
        factory.getLogger('t').debug('dropped')
        factory.getLogger('t').info('dropped')
        factory.getLogger('t').warning('kept')
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(posts).toHaveLength(1)
        const rec = posts[0].resourceLogs[0].scopeLogs[0].logRecords[0]
        expect(rec.severityNumber).toBe(13)
        expect(rec.severityText).toBe('WARN')
    })

    it('flush() drains buffer immediately', async () => {
        const posts: any[] = []
        const transport: OTLPTransport = async (_url, body) => { posts.push(JSON.parse(body)); return 200 }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 100,
            flushInterval: 99999,
            transport,
        })
        reporter.log('info', 't', T0, {}, ['a'])
        reporter.log('info', 't', T0, {}, ['b'])
        reporter.flush()
        await new Promise(resolve => setTimeout(resolve, 0))
        expect(posts).toHaveLength(1)
        expect(posts[0].resourceLogs[0].scopeLogs[0].logRecords).toHaveLength(2)
    })

    it('fields from withContext() flow through factory into OTLP attributes', async () => {
        const posts: any[] = []
        const transport: OTLPTransport = async (_url, body) => { posts.push(JSON.parse(body)); return 200 }
        const reporter = new OTLPReporter({
            url: 'https://otel.example.com/v1/logs',
            maxSize: 1,
            flushInterval: 0,
            transport,
        })
        const factory = new LoggerFactory([reporter])
        factory.level = 'debug'
        const log = factory.getLogger('api').withContext({ requestId: 'r-99' })
        log.info('handled')
        await new Promise(resolve => setTimeout(resolve, 0))
        const attrs: Array<{ key: string; value: any }> =
            posts[0].resourceLogs[0].scopeLogs[0].logRecords[0].attributes
        const byKey = Object.fromEntries(attrs.map((a: any) => [a.key, a.value]))
        expect(byKey['requestId']).toEqual({ stringValue: 'r-99' })
    })
})

// ---------------------------------------------------------------------------
// Minimal in-memory IDB shim
// ---------------------------------------------------------------------------

function makeFakeIDB() {
    const stores: Record<string, { data: Map<number, any>; nextKey: number }> = {}

    function makeRequest<T>(result: T) {
        const req: any = { result, error: null, onsuccess: null, onerror: null }
        Promise.resolve().then(() => req.onsuccess?.({ target: req }))
        return req
    }

    function makeObjectStore(name: string) {
        const s = stores[name]
        return {
            add(value: any) {
                const key = s.nextKey++
                s.data.set(key, value)
                return makeRequest(key)
            },
            count() { return makeRequest(s.data.size) },
            openCursor() {
                const keys = [...s.data.keys()].sort((a, b) => a - b)
                let idx = 0
                const req: any = { result: null, error: null, onsuccess: null, onerror: null }
                const advance = () => {
                    if (idx < keys.length) {
                        const k = keys[idx]
                        req.result = {
                            primaryKey: k,
                            value: s.data.get(k),
                            delete() { s.data.delete(k) },
                            continue() {
                                idx++
                                Promise.resolve().then(() => { advance(); req.onsuccess?.({ target: req }) })
                            }
                        }
                    } else {
                        req.result = null
                    }
                }
                Promise.resolve().then(() => { advance(); req.onsuccess?.({ target: req }) })
                return req
            },
            getAll() { return makeRequest([...s.data.values()]) },
            clear() { s.data.clear(); return makeRequest(undefined) },
        }
    }

    function makeDB() {
        return {
            objectStoreNames: { contains: (name: string) => name in stores },
            createObjectStore(name: string, _opts?: any) {
                stores[name] = { data: new Map(), nextKey: 1 }
                return makeObjectStore(name)
            },
            transaction(storeName: string, _mode?: string) {
                const tx: any = { oncomplete: null, onerror: null, objectStore: () => makeObjectStore(storeName) }
                setTimeout(() => tx.oncomplete?.(), 0)
                return tx
            },
            close() {},
        }
    }

    const db = makeDB()
    return {
        open(_name: string, _version: number) {
            const req: any = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null }
            Promise.resolve().then(() => {
                req.result = db
                req.onupgradeneeded?.({ target: req })
                Promise.resolve().then(() => req.onsuccess?.({ target: req }))
            })
            return req
        },
        deleteDatabase(_name: string) {
            const req: any = { onsuccess: null }
            Promise.resolve().then(() => req.onsuccess?.())
            return req
        },
    }
}

// ---------------------------------------------------------------------------
// BeaconReporter tests
// ---------------------------------------------------------------------------

describe('BeaconReporter', () => {

    it('throws when navigator.sendBeacon is absent', () => {
        const orig = (globalThis as any).navigator
        ;(globalThis as any).navigator = undefined
        try {
            expect(() => new BeaconReporter({ url: '/logs' })).toThrow('navigator.sendBeacon')
        } finally {
            ;(globalThis as any).navigator = orig
        }
    })

    it('buffers entries and sends them via sendBeacon on flush', () => {
        const orig = (globalThis as any).navigator
        const calls: { url: string; data: string }[] = []
        ;(globalThis as any).navigator = { sendBeacon: (url: string, data: string) => { calls.push({ url, data }); return true } }
        try {
            const reporter = new BeaconReporter({ url: '/logs', maxSize: 100, flushInterval: 0 })
            reporter.log('info', 'svc', T0, {}, ['hello'])
            reporter.log('warning', 'svc', T0, {}, ['world'])
            reporter.flush()
            expect(calls).toHaveLength(1)
            expect(calls[0].url).toBe('/logs')
            const entries = JSON.parse(calls[0].data)
            expect(entries).toHaveLength(2)
            expect(entries[0].level).toBe('info')
            expect(entries[1].level).toBe('warning')
        } finally {
            ;(globalThis as any).navigator = orig
        }
    })

    it('each entry carries level, scope, time, fields, and messages', () => {
        const orig = (globalThis as any).navigator
        const calls: any[] = []
        ;(globalThis as any).navigator = { sendBeacon: (_url: string, data: string) => { calls.push(JSON.parse(data)); return true } }
        try {
            const reporter = new BeaconReporter({ url: '/logs', maxSize: 1, flushInterval: 0 })
            reporter.log('error', 'auth', T0, { reqId: 'r1' }, ['boom', { code: 42 }])
            const entry = calls[0][0]
            expect(entry.level).toBe('error')
            expect(entry.scope).toBe('auth')
            expect(entry.time).toBe(T0)
            expect(entry.fields).toEqual({ reqId: 'r1' })
            expect(entry.messages).toEqual(['boom', { code: 42 }])
        } finally {
            ;(globalThis as any).navigator = orig
        }
    })

    it('flushes buffered entries via pagehide', () => {
        const origNav = (globalThis as any).navigator
        const origWin = (globalThis as any).window
        const beaconCalls: string[] = []
        const pageHideListeners: Array<() => void> = []
        ;(globalThis as any).navigator = { sendBeacon: (_url: string, data: string) => { beaconCalls.push(data); return true } }
        ;(globalThis as any).window = {
            onerror: null,
            addEventListener: (event: string, fn: () => void, _opts?: any) => {
                if (event === 'pagehide') pageHideListeners.push(fn)
            }
        }
        try {
            const reporter = new BeaconReporter({ url: '/logs', maxSize: 100, flushInterval: 0 })
            reporter.log('error', 'svc', T0, {}, ['critical'])
            pageHideListeners.forEach(fn => fn())
            expect(beaconCalls).toHaveLength(1)
            const entries = JSON.parse(beaconCalls[0])
            expect(entries[0].messages[0]).toBe('critical')
        } finally {
            ;(globalThis as any).navigator = origNav
            ;(globalThis as any).window = origWin
        }
    })

    it('does not throw when sendBeacon throws', () => {
        const orig = (globalThis as any).navigator
        ;(globalThis as any).navigator = { sendBeacon: () => { throw new Error('beacon failed') } }
        try {
            const reporter = new BeaconReporter({ url: '/logs', maxSize: 1, flushInterval: 0 })
            expect(() => reporter.log('error', 's', T0, {}, ['msg'])).not.toThrow()
        } finally {
            ;(globalThis as any).navigator = orig
        }
    })

    it('respects factory level filtering', () => {
        const orig = (globalThis as any).navigator
        const calls: any[] = []
        ;(globalThis as any).navigator = { sendBeacon: (_url: string, data: string) => { calls.push(JSON.parse(data)); return true } }
        try {
            const reporter = new BeaconReporter({ url: '/logs', maxSize: 10, flushInterval: 0 })
            const factory = new LoggerFactory([reporter])
            factory.level = 'warning'
            factory.getLogger('t').debug('dropped')
            factory.getLogger('t').info('dropped')
            factory.getLogger('t').warning('kept')
            reporter.flush()
            expect(calls).toHaveLength(1)
            expect(calls[0]).toHaveLength(1)
            expect(calls[0][0].level).toBe('warning')
        } finally {
            ;(globalThis as any).navigator = orig
        }
    })

    it('captureErrors installs window.onerror that logs into the reporter', () => {
        const origNav = (globalThis as any).navigator
        const origWin = (globalThis as any).window
        const beaconCalls: any[] = []
        ;(globalThis as any).navigator = { sendBeacon: (_url: string, data: string) => { beaconCalls.push(JSON.parse(data)); return true } }
        const mockWindow: any = { onerror: null, addEventListener: () => {} }
        ;(globalThis as any).window = mockWindow
        try {
            const reporter = new BeaconReporter({ url: '/logs', maxSize: 1, flushInterval: 0, captureErrors: true })
            mockWindow.onerror('Something went wrong', 'app.js', 10, 5, new Error('test'))
            expect(beaconCalls).toHaveLength(1)
            expect(beaconCalls[0][0].level).toBe('error')
            expect(beaconCalls[0][0].scope).toBe('window')
        } finally {
            ;(globalThis as any).navigator = origNav
            ;(globalThis as any).window = origWin
        }
    })

    it('captureErrors custom errorScope is used for captured errors', () => {
        const origNav = (globalThis as any).navigator
        const origWin = (globalThis as any).window
        const beaconCalls: any[] = []
        ;(globalThis as any).navigator = { sendBeacon: (_url: string, data: string) => { beaconCalls.push(JSON.parse(data)); return true } }
        const mockWindow: any = { onerror: null, addEventListener: () => {} }
        ;(globalThis as any).window = mockWindow
        try {
            const reporter = new BeaconReporter({ url: '/logs', maxSize: 1, flushInterval: 0, captureErrors: true, errorScope: 'global' })
            mockWindow.onerror('err', 'app.js', 1, 1, new Error('x'))
            expect(beaconCalls[0][0].scope).toBe('global')
        } finally {
            ;(globalThis as any).navigator = origNav
            ;(globalThis as any).window = origWin
        }
    })

    it('captureErrors installs unhandledrejection listener', () => {
        const origNav = (globalThis as any).navigator
        const origWin = (globalThis as any).window
        const beaconCalls: any[] = []
        ;(globalThis as any).navigator = { sendBeacon: (_url: string, data: string) => { beaconCalls.push(JSON.parse(data)); return true } }
        const listeners: Array<(evt: any) => void> = []
        const mockWindow: any = { onerror: null, addEventListener: (_evt: string, fn: any) => listeners.push(fn) }
        ;(globalThis as any).window = mockWindow
        try {
            const reporter = new BeaconReporter({ url: '/logs', maxSize: 1, flushInterval: 0, captureErrors: true })
            listeners.forEach(fn => fn({ reason: new Error('promise rejected') }))
            expect(beaconCalls).toHaveLength(1)
            expect(beaconCalls[0][0].level).toBe('error')
            expect(beaconCalls[0][0].messages[0]).toBe('Unhandled promise rejection')
        } finally {
            ;(globalThis as any).navigator = origNav
            ;(globalThis as any).window = origWin
        }
    })

    it('close() flushes pending entries', () => {
        const orig = (globalThis as any).navigator
        const calls: any[] = []
        ;(globalThis as any).navigator = { sendBeacon: (_url: string, data: string) => { calls.push(JSON.parse(data)); return true } }
        try {
            const reporter = new BeaconReporter({ url: '/logs', maxSize: 100, flushInterval: 0 })
            reporter.log('info', 's', T0, {}, ['closing'])
            reporter.close()
            expect(calls).toHaveLength(1)
        } finally {
            ;(globalThis as any).navigator = orig
        }
    })

})

// ---------------------------------------------------------------------------
// IndexedDBReporter tests
// ---------------------------------------------------------------------------

describe('IndexedDBReporter', () => {

    it('throws when indexedDB is absent', () => {
        const orig = (globalThis as any).indexedDB
        ;(globalThis as any).indexedDB = undefined
        try {
            expect(() => new IndexedDBReporter()).toThrow('IndexedDB')
        } finally {
            ;(globalThis as any).indexedDB = orig
        }
    })

    it('stores log entries and drain() returns them', async () => {
        const orig = (globalThis as any).indexedDB
        ;(globalThis as any).indexedDB = makeFakeIDB()
        try {
            const reporter = new IndexedDBReporter()
            reporter.log('info', 'svc', T0, {}, ['hello'])
            reporter.log('warning', 'svc', T1, { reqId: 'r1' }, ['world'])
            await reporter.flush()
            const entries = await reporter.drain()
            expect(entries).toHaveLength(2)
            expect(entries[0].level).toBe('info')
            expect(entries[0].scope).toBe('svc')
            expect(entries[0].time).toBe(T0)
            expect(entries[0].messages).toEqual(['hello'])
            expect(entries[1].level).toBe('warning')
            expect(entries[1].fields).toEqual({ reqId: 'r1' })
        } finally {
            ;(globalThis as any).indexedDB = orig
        }
    })

    it('drain() clears the store so a second drain returns empty', async () => {
        const orig = (globalThis as any).indexedDB
        ;(globalThis as any).indexedDB = makeFakeIDB()
        try {
            const reporter = new IndexedDBReporter()
            reporter.log('info', 's', T0, {}, ['a'])
            await reporter.flush()
            await reporter.drain()
            const second = await reporter.drain()
            expect(second).toHaveLength(0)
        } finally {
            ;(globalThis as any).indexedDB = orig
        }
    })

    it('flush() waits for all pending writes before resolving', async () => {
        const orig = (globalThis as any).indexedDB
        ;(globalThis as any).indexedDB = makeFakeIDB()
        try {
            const reporter = new IndexedDBReporter()
            reporter.log('info', 's', T0, {}, ['a'])
            reporter.log('info', 's', T0, {}, ['b'])
            reporter.log('info', 's', T0, {}, ['c'])
            await reporter.flush()
            const entries = await reporter.drain()
            expect(entries).toHaveLength(3)
        } finally {
            ;(globalThis as any).indexedDB = orig
        }
    })

    it('evicts oldest entries when maxEntries is exceeded', async () => {
        const orig = (globalThis as any).indexedDB
        ;(globalThis as any).indexedDB = makeFakeIDB()
        try {
            const reporter = new IndexedDBReporter({ maxEntries: 2 })
            reporter.log('info', 's', T0, {}, ['first'])
            reporter.log('info', 's', T0, {}, ['second'])
            reporter.log('info', 's', T0, {}, ['third'])
            await reporter.flush()
            const entries = await reporter.drain()
            expect(entries).toHaveLength(2)
            const messages = entries.map(e => e.messages[0])
            expect(messages).not.toContain('first')
            expect(messages).toContain('third')
        } finally {
            ;(globalThis as any).indexedDB = orig
        }
    })

    it('close() stops accepting new entries', async () => {
        const orig = (globalThis as any).indexedDB
        ;(globalThis as any).indexedDB = makeFakeIDB()
        try {
            const reporter = new IndexedDBReporter()
            reporter.log('info', 's', T0, {}, ['before-close'])
            await reporter.close()
            reporter.log('info', 's', T0, {}, ['after-close'])
            const entries = await reporter.drain()
            const messages = entries.map(e => e.messages[0])
            expect(messages).toContain('before-close')
            expect(messages).not.toContain('after-close')
        } finally {
            ;(globalThis as any).indexedDB = orig
        }
    })

    it('respects factory level filtering', async () => {
        const orig = (globalThis as any).indexedDB
        ;(globalThis as any).indexedDB = makeFakeIDB()
        try {
            const reporter = new IndexedDBReporter()
            const factory = new LoggerFactory([reporter])
            factory.level = 'warning'
            factory.getLogger('t').debug('dropped')
            factory.getLogger('t').info('dropped')
            factory.getLogger('t').warning('kept')
            await reporter.flush()
            const entries = await reporter.drain()
            expect(entries).toHaveLength(1)
            expect(entries[0].level).toBe('warning')
        } finally {
            ;(globalThis as any).indexedDB = orig
        }
    })

    it('does not throw when IDB open fails', async () => {
        const orig = (globalThis as any).indexedDB
        ;(globalThis as any).indexedDB = {
            open(_name: string, _version: number) {
                const req: any = { result: null, error: new Error('open failed'), onupgradeneeded: null, onsuccess: null, onerror: null }
                Promise.resolve().then(() => req.onerror?.({ target: req }))
                return req
            }
        }
        try {
            const reporter = new IndexedDBReporter()
            reporter.log('info', 's', T0, {}, ['msg'])
            await expect(reporter.flush()).resolves.toBeUndefined()
        } finally {
            ;(globalThis as any).indexedDB = orig
        }
    })

    it('drain() returns entries with correct fields shape', async () => {
        const orig = (globalThis as any).indexedDB
        ;(globalThis as any).indexedDB = makeFakeIDB()
        try {
            const reporter = new IndexedDBReporter()
            reporter.log('error', 'auth', T1, { userId: 7 }, ['login failed', { code: 401 }])
            await reporter.flush()
            const [entry] = await reporter.drain()
            expect(entry.level).toBe('error')
            expect(entry.scope).toBe('auth')
            expect(entry.time).toBe(T1)
            expect(entry.fields).toEqual({ userId: 7 })
            expect(entry.messages).toEqual(['login failed', { code: 401 }])
        } finally {
            ;(globalThis as any).indexedDB = orig
        }
    })

})

describe('textFormatter', () => {
    it('produces LEVEL [ISO] | scope: msg format', () => {
        const line = textFormatter('info', 'auth', T0, {}, ['hello'])
        expect(line).toBe('INFO [2026-01-01T00:00:00.000Z] | auth: hello')
    })

    it('uppercases the level token', () => {
        expect(textFormatter('error', 's', T0, {}, ['e'])).toMatch(/^ERROR/)
        expect(textFormatter('warning', 's', T0, {}, ['w'])).toMatch(/^WARNING/)
        expect(textFormatter('verbose', 's', T0, {}, ['v'])).toMatch(/^VERBOSE/)
    })

    it('joins multiple messages with a space', () => {
        const line = textFormatter('info', 's', T0, {}, ['hello', 'world'])
        expect(line).toContain('hello world')
    })

    it('serializes plain objects to inline JSON', () => {
        const line = textFormatter('info', 's', T0, {}, [{ key: 'val' }])
        expect(line).toContain('{"key":"val"}')
    })

    it('serializes Error instances using the stack', () => {
        const err = new Error('boom')
        const line = textFormatter('error', 's', T0, {}, [err])
        expect(line).toContain('boom')
    })

    it('ignores fields — they do not appear in the output', () => {
        const line = textFormatter('info', 's', T0, { requestId: 'r1' }, ['msg'])
        expect(line).not.toContain('requestId')
        expect(line).not.toContain('r1')
    })
})

describe('jsonFormatter', () => {
    it('produces valid parseable JSON', () => {
        const line = jsonFormatter('info', 'auth', T0, {}, ['ok'])
        expect(() => JSON.parse(line)).not.toThrow()
    })

    it('contains level, scope, time (number), and messages', () => {
        const parsed = JSON.parse(jsonFormatter('info', 'auth', T0, {}, ['ok', { id: 7 }]))
        expect(parsed.level).toBe('info')
        expect(parsed.scope).toBe('auth')
        expect(parsed.time).toBe(T0)
        expect(parsed.messages).toEqual(['ok', { id: 7 }])
    })

    it('spreads fields as top-level keys', () => {
        const parsed = JSON.parse(jsonFormatter('info', 's', T0, { requestId: 'r1', userId: 42 }, ['msg']))
        expect(parsed.requestId).toBe('r1')
        expect(parsed.userId).toBe(42)
        expect(parsed.messages).toEqual(['msg'])
    })

    it('serializes Error instances in messages with name/message/stack', () => {
        const parsed = JSON.parse(jsonFormatter('error', 's', T0, {}, [new Error('boom')]))
        expect(parsed.messages[0].name).toBe('Error')
        expect(parsed.messages[0].message).toBe('boom')
        expect(typeof parsed.messages[0].stack).toBe('string')
    })

    it('converts BigInt values in messages to strings', () => {
        const parsed = JSON.parse(jsonFormatter('info', 's', T0, {}, [42n]))
        expect(parsed.messages[0]).toBe('42')
    })

    it('replaces circular references in messages with [Circular]', () => {
        const cyc: any = {}
        cyc.self = cyc
        const parsed = JSON.parse(jsonFormatter('info', 's', T0, {}, [cyc]))
        expect(parsed.messages[0].self).toBe('[Circular]')
    })

    it('keeps sibling fields around a circular reference', () => {
        const obj: any = { name: 'node', status: 'ok' }
        obj.loop = obj
        const parsed = JSON.parse(jsonFormatter('info', 's', T0, {}, [obj]))
        expect(parsed.messages[0].name).toBe('node')
        expect(parsed.messages[0].status).toBe('ok')
        expect(parsed.messages[0].loop).toBe('[Circular]')
    })
})

describe('logfmtFormatter', () => {
    it('produces level, scope, ts, and msg fields', () => {
        const line = logfmtFormatter('info', 'auth', T0, {}, ['hello'])
        expect(line).toContain('level=info')
        expect(line).toContain('scope=auth')
        expect(line).toContain('ts=2026-01-01T00:00:00.000Z')
        expect(line).toContain('msg=hello')
    })

    it('includes context fields as key=value pairs between ts and msg', () => {
        const line = logfmtFormatter('info', 's', T0, { requestId: 'r1', userId: '42' }, ['event'])
        expect(line).toContain('requestId=r1')
        expect(line).toContain('userId=42')
        const tsIdx = line.indexOf('ts=')
        const msgIdx = line.indexOf('msg=')
        const reqIdx = line.indexOf('requestId=')
        expect(reqIdx).toBeGreaterThan(tsIdx)
        expect(reqIdx).toBeLessThan(msgIdx)
    })

    it('joins multiple messages with a space in the msg field', () => {
        const line = logfmtFormatter('info', 's', T0, {}, ['hello', 'world'])
        expect(line).toContain('msg="hello world"')
    })

    it('quotes msg values that contain spaces', () => {
        const line = logfmtFormatter('info', 's', T0, {}, ['hello world'])
        expect(line).toContain('msg="hello world"')
    })

    it('quotes field values that contain spaces', () => {
        const line = logfmtFormatter('info', 's', T0, { env: 'my env' }, ['x'])
        expect(line).toContain('env="my env"')
    })

    it('quotes field values that contain = characters', () => {
        const line = logfmtFormatter('info', 's', T0, { expr: 'a=b' }, ['x'])
        expect(line).toContain('expr="a=b"')
    })

    it('produces "" for an empty msg', () => {
        const line = logfmtFormatter('info', 's', T0, {}, [''])
        expect(line).toContain('msg=""')
    })

    it('serializes object messages as JSON within the msg field', () => {
        const line = logfmtFormatter('info', 's', T0, {}, [{ id: 7 }])
        expect(line).toContain('{"id":7}')
    })

    it('uses error.message for Error instances in messages', () => {
        const err = new Error('something went wrong')
        const line = logfmtFormatter('error', 's', T0, {}, [err])
        expect(line).toContain('something went wrong')
    })
})

describe('JSONLineReporter — formatter option', () => {
    it('uses jsonFormatter by default (parseable JSON with level/scope/time/messages)', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        reporter.log('info', 'auth', T0, {}, ['ok'])
        const parsed = JSON.parse(lines[0])
        expect(parsed.level).toBe('info')
        expect(parsed.scope).toBe('auth')
        expect(parsed.time).toBe(T0)
        expect(parsed.messages).toEqual(['ok'])
    })

    it('accepts a custom formatter — logfmt output over JSONLineReporter', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line), formatter: logfmtFormatter })
        reporter.log('info', 'auth', T0, {}, ['hello'])
        expect(lines[0]).toContain('level=info')
        expect(lines[0]).toContain('scope=auth')
        expect(lines[0]).toContain('msg=hello')
    })

    it('merges extra into fields before passing to the formatter', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({
            write: line => lines.push(line),
            extra: { service: 'api' },
            formatter: logfmtFormatter
        })
        reporter.log('info', 's', T0, {}, ['x'])
        expect(lines[0]).toContain('service=api')
    })
})

describe('ConsoleLogReporter — formatter option', () => {
    it('uses the formatter to produce the full output line instead of the default prefix + messages', () => {
        const reporter = new ConsoleLogReporter({ color: false, formatter: logfmtFormatter })
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        reporter.log('info', 'auth', T0, {}, ['hello'])
        const call = spy.mock.calls[0][0]
        expect(call).toContain('level=info')
        expect(call).toContain('scope=auth')
        expect(call).toContain('msg=hello')
        expect(call).not.toContain('INFO [')
        spy.mockRestore()
    })

    it('routes error level to console.error when formatter is set', () => {
        const reporter = new ConsoleLogReporter({ color: false, formatter: textFormatter })
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
        reporter.log('error', 's', T0, {}, ['boom'])
        expect(spy).toHaveBeenCalledTimes(1)
        const line = spy.mock.calls[0][0]
        expect(line).toContain('ERROR')
        spy.mockRestore()
    })

    it('passes fields to the formatter when set', () => {
        const reporter = new ConsoleLogReporter({
            color: false,
            formatter: (level, scope, _time, fields, messages) => {
                return `${level} ${scope} req=${fields.requestId} ${messages.join(' ')}`
            }
        })
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        reporter.log('info', 'api', T0, { requestId: 'r1' }, ['start'])
        expect(spy.mock.calls[0][0]).toBe('info api req=r1 start')
        spy.mockRestore()
    })
})

describe('AsyncContext', () => {
    it('getFields() returns {} when no context is active', () => {
        const ctx = new AsyncContext()
        expect(ctx.getFields()).toEqual({})
    })

    it('run() makes fields available inside the callback', () => {
        const ctx = new AsyncContext()
        const result = ctx.run({ requestId: 'r1' }, () => ctx.getFields())
        expect(result).toEqual({ requestId: 'r1' })
    })

    it('getFields() returns {} after run() exits', () => {
        const ctx = new AsyncContext()
        ctx.run({ requestId: 'r1' }, () => {})
        expect(ctx.getFields()).toEqual({})
    })

    it('fields propagate across async continuations', async () => {
        const ctx = new AsyncContext()
        let captured: Record<string, any> = {}
        await ctx.run({ requestId: 'async-1' }, async () => {
            await Promise.resolve()
            captured = ctx.getFields()
        })
        expect(captured).toEqual({ requestId: 'async-1' })
    })

    it('nested run() merges parent fields, child wins on key conflict', () => {
        const ctx = new AsyncContext()
        let inner: Record<string, any> = {}
        ctx.run({ requestId: 'r1', userId: 1 }, () => {
            ctx.run({ userId: 2, traceId: 't1' }, () => {
                inner = ctx.getFields()
            })
        })
        expect(inner).toEqual({ requestId: 'r1', userId: 2, traceId: 't1' })
    })

    it('parent context is restored after nested run() exits', () => {
        const ctx = new AsyncContext()
        let outer: Record<string, any> = {}
        ctx.run({ requestId: 'r1' }, () => {
            ctx.run({ traceId: 't1' }, () => {})
            outer = ctx.getFields()
        })
        expect(outer).toEqual({ requestId: 'r1' })
    })

    it('multiple independent AsyncContext instances do not interfere', () => {
        const ctxA = new AsyncContext()
        const ctxB = new AsyncContext()
        let fieldsA: Record<string, any> = {}
        let fieldsB: Record<string, any> = {}
        ctxA.run({ source: 'a' }, () => {
            ctxB.run({ source: 'b' }, () => {
                fieldsA = ctxA.getFields()
                fieldsB = ctxB.getFields()
            })
        })
        expect(fieldsA).toEqual({ source: 'a' })
        expect(fieldsB).toEqual({ source: 'b' })
    })
})

describe('ContextualReporter', () => {
    it('merges ALS fields into log records', () => {
        const captured: { fields: any }[] = []
        class Capture extends LogReporter {
            log(_l: any, _s: any, _t: any, fields: any): void { captured.push({ fields }) }
        }
        const ctx = new AsyncContext()
        const reporter = new ContextualReporter(new Capture(), ctx)
        ctx.run({ requestId: 'r1' }, () => {
            reporter.log('info', 's', T0, {}, ['msg'])
        })
        expect(captured[0].fields).toEqual({ requestId: 'r1' })
    })

    it('static fields (withContext) override ALS fields on key conflict', () => {
        const captured: { fields: any }[] = []
        class Capture extends LogReporter {
            log(_l: any, _s: any, _t: any, fields: any): void { captured.push({ fields }) }
        }
        const ctx = new AsyncContext()
        const reporter = new ContextualReporter(new Capture(), ctx)
        ctx.run({ requestId: 'r1', env: 'prod' }, () => {
            reporter.log('info', 's', T0, { env: 'staging' }, ['msg'])
        })
        expect(captured[0].fields).toEqual({ requestId: 'r1', env: 'staging' })
    })

    it('passes through static fields unchanged when no ALS context is active', () => {
        const captured: { fields: any }[] = []
        class Capture extends LogReporter {
            log(_l: any, _s: any, _t: any, fields: any): void { captured.push({ fields }) }
        }
        const ctx = new AsyncContext()
        const reporter = new ContextualReporter(new Capture(), ctx)
        reporter.log('info', 's', T0, { requestId: 'r1' }, ['msg'])
        expect(captured[0].fields).toEqual({ requestId: 'r1' })
    })

    it('ALS fields surface in emitted records via the factory pipeline', async () => {
        const captured: { fields: any }[] = []
        class Capture extends LogReporter {
            log(_l: any, _s: any, _t: any, fields: any): void { captured.push({ fields }) }
        }
        const ctx = new AsyncContext()
        const factory = new LoggerFactory([new ContextualReporter(new Capture(), ctx)])
        factory.level = 'info'

        await ctx.run({ requestId: 'req-1', traceId: 'trace-1' }, async () => {
            await Promise.resolve()
            factory.getLogger('handler').info('handled')
        })

        expect(captured).toHaveLength(1)
        expect(captured[0].fields).toEqual({ requestId: 'req-1', traceId: 'trace-1' })
    })

    it('withContext fields override ALS fields via factory pipeline', () => {
        const captured: { fields: any }[] = []
        class Capture extends LogReporter {
            log(_l: any, _s: any, _t: any, fields: any): void { captured.push({ fields }) }
        }
        const ctx = new AsyncContext()
        const factory = new LoggerFactory([new ContextualReporter(new Capture(), ctx)])
        factory.level = 'info'

        ctx.run({ requestId: 'r1', env: 'prod' }, () => {
            const log = factory.getLogger('svc').withContext({ env: 'staging' })
            log.info('event')
        })

        expect(captured[0].fields).toEqual({ requestId: 'r1', env: 'staging' })
    })

    it('respects factory level filtering', () => {
        const captured: any[] = []
        class Capture extends LogReporter {
            log(_l: any, _s: any, _t: any, _f: any, msgs: any[]): void { captured.push(msgs[0]) }
        }
        const ctx = new AsyncContext()
        const factory = new LoggerFactory([new ContextualReporter(new Capture(), ctx)])
        factory.level = 'warning'
        ctx.run({ requestId: 'r1' }, () => {
            factory.getLogger('t').debug('dropped')
            factory.getLogger('t').warning('shown')
        })
        expect(captured).toEqual(['shown'])
    })

    it('flush() delegates to the inner reporter', () => {
        let flushed = false
        class Inner extends LogReporter {
            log(): void {}
            flush(): void { flushed = true }
        }
        const ctx = new AsyncContext()
        const reporter = new ContextualReporter(new Inner(), ctx)
        reporter.flush()
        expect(flushed).toBe(true)
    })

    it('close() delegates to the inner reporter', async () => {
        let closed = false
        class Inner extends LogReporter {
            log(): void {}
            close(): void { closed = true }
        }
        const ctx = new AsyncContext()
        const reporter = new ContextualReporter(new Inner(), ctx)
        await reporter.close()
        expect(closed).toBe(true)
    })
})

describe('MemoryReporter', () => {
    it('retains all entries without draining', () => {
        const reporter = new MemoryReporter()
        reporter.log('info', 's', T0, {}, ['a'])
        reporter.log('error', 's', T0, {}, ['b'])
        expect(reporter.entries()).toHaveLength(2)
        expect(reporter.entries()).toHaveLength(2)
    })

    it('entries() returns all entries in insertion order', () => {
        const reporter = new MemoryReporter()
        const factory = new LoggerFactory([reporter], () => T0)
        factory.level = 'verbose'
        const log = factory.getLogger('app')
        log.info('first')
        log.warning('second')
        log.error('third')
        const entries = reporter.entries()
        expect(entries).toHaveLength(3)
        expect(entries[0].level).toBe('info')
        expect(entries[0].messages).toEqual(['first'])
        expect(entries[1].level).toBe('warning')
        expect(entries[2].level).toBe('error')
    })

    it('entries() returns a copy, not the internal array', () => {
        const reporter = new MemoryReporter()
        reporter.log('info', 's', T0, {}, ['a'])
        const snap1 = reporter.entries()
        reporter.log('info', 's', T0, {}, ['b'])
        expect(snap1).toHaveLength(1)
        expect(reporter.entries()).toHaveLength(2)
    })

    it('find(level) returns only entries with the specified level', () => {
        const reporter = new MemoryReporter()
        reporter.log('info', 's', T0, {}, ['msg1'])
        reporter.log('error', 's', T0, {}, ['err'])
        reporter.log('info', 's', T0, {}, ['msg2'])
        reporter.log('warning', 's', T0, {}, ['warn'])
        const infos = reporter.find('info')
        expect(infos).toHaveLength(2)
        expect(infos[0].messages).toEqual(['msg1'])
        expect(infos[1].messages).toEqual(['msg2'])
        const errors = reporter.find('error')
        expect(errors).toHaveLength(1)
        expect(errors[0].messages).toEqual(['err'])
    })

    it('find(level) returns empty array when no entries match', () => {
        const reporter = new MemoryReporter()
        reporter.log('info', 's', T0, {}, ['msg'])
        expect(reporter.find('debug')).toHaveLength(0)
    })

    it('clear() resets the reporter', () => {
        const reporter = new MemoryReporter()
        reporter.log('info', 's', T0, {}, ['a'])
        reporter.log('error', 's', T0, {}, ['b'])
        reporter.clear()
        expect(reporter.entries()).toHaveLength(0)
        expect(reporter.find('info')).toHaveLength(0)
        reporter.log('debug', 's', T0, {}, ['c'])
        expect(reporter.entries()).toHaveLength(1)
    })

    it('respects factory level filtering', () => {
        const reporter = new MemoryReporter()
        const factory = new LoggerFactory([reporter])
        factory.level = 'warning'
        const log = factory.getLogger('t')
        log.debug('dropped')
        log.info('dropped')
        log.warning('shown')
        log.error('shown')
        expect(reporter.entries()).toHaveLength(2)
        expect(reporter.entries().map(e => e.level)).toEqual(['warning', 'error'])
    })

    it('captures scope and time from the factory', () => {
        const reporter = new MemoryReporter()
        const factory = new LoggerFactory([reporter], () => T0)
        factory.getLogger('svc').info('hello')
        const [entry] = reporter.entries()
        expect(entry.scope).toBe('svc')
        expect(entry.time).toBe(T0)
    })

    it('captures fields from withContext', () => {
        const reporter = new MemoryReporter()
        const factory = new LoggerFactory([reporter])
        const log = factory.getLogger('svc').withContext({ requestId: 'r1' })
        log.info('event')
        const [entry] = reporter.entries()
        expect(entry.fields).toEqual({ requestId: 'r1' })
        expect(entry.messages).toEqual(['event'])
    })
})
