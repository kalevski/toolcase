import { describe, it, expect, vi } from 'vitest'
import { default as Level, getLevelOrder, getLevel, isKnownLevel, KNOWN_LEVELS } from '../src/Level'
import Logger from '../src/Logger'
import LoggerFactory from '../src/LoggerFactory'
import ConsoleLogReporter from '../src/ConsoleLogReporter'
import LogReporter from '../src/LogReporter'
import JSONLineReporter from '../src/JSONLineReporter'
import FileLogReporter from '../src/FileLogReporter'
import BufferedReporter from '../src/BufferedReporter'

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
