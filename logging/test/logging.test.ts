import { describe, it, expect, vi } from 'vitest'
import { default as Level, getLevelOrder, getLevel } from '../src/Level'
import Logger from '../src/Logger'
import LoggerFactory from '../src/LoggerFactory'
import ConsoleLogReporter from '../src/ConsoleLogReporter'
import LogReporter from '../src/LogReporter'
import JSONLineReporter from '../src/JSONLineReporter'
import FileLogReporter from '../src/FileLogReporter'
import BufferedReporter from '../src/BufferedReporter'

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
            log(level: string, scope: string, time: string, msgs: any[]): void {
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

describe('Logger', () => {
    it('passes scope, time, and args through dispatch fn', () => {
        const captures: any[] = []
        const logger = new Logger('billing', (level, scope, time, messages) => {
            captures.push({ level, scope, time, messages })
        })
        logger.info('hello', 42)
        expect(captures).toHaveLength(1)
        expect(captures[0].level).toBe('info')
        expect(captures[0].scope).toBe('billing')
        expect(captures[0].messages).toEqual(['hello', 42])
        expect(typeof captures[0].time).toBe('string')
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

    it('log() accepts arbitrary level token', () => {
        const captures: string[] = []
        const logger = new Logger('s', (level) => { captures.push(level) })
        logger.log('verbose', 'msg')
        expect(captures).toEqual(['verbose'])
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
    it('returns a child logger that injects context as the first message arg', () => {
        const captured: any[][] = []
        class R extends LogReporter { log(_l: any, _s: any, _t: any, msgs: any[]) { captured.push(msgs) } }
        const factory = new LoggerFactory([new R()])
        const log = factory.getLogger('svc')
        const req = log.withContext({ requestId: 'r1' })
        req.info('start')
        req.info('done', 42)
        expect(captured).toEqual([
            [{ requestId: 'r1' }, 'start'],
            [{ requestId: 'r1' }, 'done', 42]
        ])
    })

    it('does not mutate the parent logger', () => {
        const captured: any[][] = []
        class R extends LogReporter { log(_l: any, _s: any, _t: any, msgs: any[]) { captured.push(msgs) } }
        const factory = new LoggerFactory([new R()])
        const parent = factory.getLogger('svc')
        parent.withContext({ x: 1 })
        parent.info('hi')
        expect(captured).toEqual([['hi']])
    })

    it('nested withContext merges context, child wins on key conflict', () => {
        const captured: any[][] = []
        class R extends LogReporter { log(_l: any, _s: any, _t: any, msgs: any[]) { captured.push(msgs) } }
        const factory = new LoggerFactory([new R()])
        const log = factory.getLogger('svc')
        const a = log.withContext({ requestId: 'r1', userId: 7 })
        const b = a.withContext({ userId: 9, sessionId: 's' })
        b.info('event')
        expect(captured).toEqual([
            [{ requestId: 'r1', userId: 9, sessionId: 's' }, 'event']
        ])
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
    it('does not invoke toISOString or the dispatch fn for a disabled level', () => {
        const factory = new LoggerFactory([])
        factory.level = 'info'
        const log = factory.getLogger('perf')
        const child = log.withContext({ requestId: 'r1' })

        const isoSpy = vi.spyOn(Date.prototype, 'toISOString')
        child.debug('expensive payload')
        expect(isoSpy).not.toHaveBeenCalled()
        isoSpy.mockRestore()
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

    it('still dispatches enabled levels after the short-circuit is wired', () => {
        const factory = new LoggerFactory([])
        factory.level = 'debug'
        const log = factory.getLogger('enabled')
        const isoSpy = vi.spyOn(Date.prototype, 'toISOString')
        log.debug('this should pass')
        expect(isoSpy).toHaveBeenCalledTimes(1)
        isoSpy.mockRestore()
    })

    it('short-circuits context array allocation when level is disabled', () => {
        const received: any[][] = []
        class R extends LogReporter { log(_l: any, _s: any, _t: any, msgs: any[]) { received.push(msgs) } }
        const factory = new LoggerFactory([new R()])
        factory.level = 'info'
        const log = factory.getLogger('ctx')
        const child = log.withContext({ userId: 42 })
        child.debug('nope')
        expect(received).toHaveLength(0)
        child.info('yes')
        expect(received).toHaveLength(1)
        expect(received[0][0]).toEqual({ userId: 42 })
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
        reporter.log('error', 'svc', '2026-01-01T00:00:00Z', ['boom'])
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
        reporter.log('warning', 'svc', 't', ['heads up'])
        expect(spy).toHaveBeenCalledTimes(1)
        spy.mockRestore()
    })

    it('routes info/debug/verbose to console.log', () => {
        const reporter = new ConsoleLogReporter()
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
        reporter.log('info', 's', 't', ['x'])
        reporter.log('debug', 's', 't', ['x'])
        reporter.log('verbose', 's', 't', ['x'])
        expect(spy).toHaveBeenCalledTimes(3)
        spy.mockRestore()
    })
})

describe('JSONLineReporter', () => {
    it('emits a JSON line with level/scope/time/messages', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        reporter.log('info', 'auth', '2026-01-01T00:00:00Z', ['ok', { id: 7 }])
        expect(lines).toHaveLength(1)
        const parsed = JSON.parse(lines[0])
        expect(parsed).toEqual({
            level: 'info',
            scope: 'auth',
            time: '2026-01-01T00:00:00Z',
            messages: ['ok', { id: 7 }]
        })
    })

    it('serializes Error instances with stack', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        reporter.log('error', 's', 't', [new Error('boom')])
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
        reporter.log('info', 's', 't', ['ok'])
        const parsed = JSON.parse(lines[0])
        expect(parsed.service).toBe('api')
        expect(parsed.region).toBe('eu')
    })

    it('replaces a circular ref field with [Circular] and keeps siblings', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        const cyc: any = {}
        cyc.self = cyc
        reporter.log('info', 's', 't', ['ok', cyc])
        expect(lines).toHaveLength(1)
        const parsed = JSON.parse(lines[0])
        expect(parsed.messages[0]).toBe('ok')
        expect(parsed.messages[1]).toEqual({ self: '[Circular]' })
    })

    it('serializes a nested Error with name/message/stack', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        reporter.log('error', 's', 't', [{ err: new Error('x') }])
        const parsed = JSON.parse(lines[0])
        expect(parsed.messages[0].err.name).toBe('Error')
        expect(parsed.messages[0].err.message).toBe('x')
        expect(typeof parsed.messages[0].err.stack).toBe('string')
    })

    it('serializes BigInt messages as strings', () => {
        const lines: string[] = []
        const reporter = new JSONLineReporter({ write: line => lines.push(line) })
        reporter.log('info', 's', 't', [42n])
        const parsed = JSON.parse(lines[0])
        expect(parsed.messages[0]).toBe('42')
    })
})

describe('BufferedReporter', () => {
    it('flushes when maxSize is reached', () => {
        const captured: string[][] = []
        class R extends LogReporter { log(level: any) { captured.push([level]) } }
        const buf = new BufferedReporter(new R(), { maxSize: 3, flushInterval: 0 })
        buf.log('info', 's', 't', ['a'])
        buf.log('info', 's', 't', ['b'])
        expect(captured).toHaveLength(0)
        buf.log('info', 's', 't', ['c'])
        expect(captured).toHaveLength(3)
    })

    it('flushes after flushInterval ms', () => {
        vi.useFakeTimers()
        const captured: number[] = []
        class R extends LogReporter { log() { captured.push(1) } }
        const buf = new BufferedReporter(new R(), { maxSize: 100, flushInterval: 500 })
        buf.log('info', 's', 't', ['a'])
        buf.log('info', 's', 't', ['b'])
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
        buf.log('info', 's', 't', ['a'])
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
        buf.log('info', 's', 't', ['a'])
        buf.log('info', 's', 't', ['b'])
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
        buf.log('info', 's', 't', ['a'])
        buf.log('warning', 's', 't', ['b'])
        expect(batches).toHaveLength(1)
        expect(batches[0]).toHaveLength(2)
        expect(batches[0][0].level).toBe('info')
        expect(batches[0][1].level).toBe('warning')
    })

    it('throws when neither inner reporter nor onFlush is provided', () => {
        expect(() => new BufferedReporter(null, {})).toThrow(/inner reporter or an onFlush/)
    })

    it('size() reports buffered entry count', () => {
        const buf = new BufferedReporter(null, { onFlush: () => {}, maxSize: 100, flushInterval: 0 })
        expect(buf.size()).toBe(0)
        buf.log('info', 's', 't', ['a'])
        buf.log('info', 's', 't', ['b'])
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
            log(level: any, _s: any, _t: any, msgs: any[]): void { received.push(msgs[0]) }
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
        buf.log('info', 's', 't', ['a'])
        expect(() => buf.log('info', 's', 't', ['b'])).not.toThrow()
    })

    it('does not throw when the inner reporter throws during flush', () => {
        class ThrowingReporter extends LogReporter {
            log(): void { throw new Error('inner failure') }
        }
        const buf = new BufferedReporter(new ThrowingReporter(), { maxSize: 2, flushInterval: 0 })
        buf.log('info', 's', 't', ['a'])
        expect(() => buf.log('info', 's', 't', ['b'])).not.toThrow()
    })

    it('buffer is cleared even when onFlush throws', () => {
        const buf = new BufferedReporter(null, {
            maxSize: 2,
            flushInterval: 0,
            onFlush: () => { throw new Error('flush failure') }
        })
        buf.log('info', 's', 't', ['a'])
        buf.log('info', 's', 't', ['b'])
        expect(buf.size()).toBe(0)
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
        reporter.log('info', 'svc', '2026-01-01T00:00:00Z', ['hello', { k: 1 }])
        reporter.log('error', 'svc', '2026-01-01T00:00:01Z', [new Error('boom')])
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
        reporter.log('info', 'svc', 't', ['msg'])
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
            formatter: (level, _scope, _time, messages) => `[${level}] ${messages.join('|')}`
        })
        reporter.log('warning', 's', 't', ['a', 'b'])
        await reporter.close()
        const content = readFileSync(file, 'utf8').trim()
        expect(content).toBe('[warning] a|b')
    })
})
