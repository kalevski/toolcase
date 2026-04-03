import { describe, it, expect } from 'vitest'
import { default as Level, getLevelOrder, getLevel } from '../src/Level.js'
import LoggerFactory from '../src/LoggerFactory.js'
import ConsoleLogReporter from '../src/ConsoleLogReporter.js'

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

    it('getLevelOrder returns -1 for unknown level', () => {
        expect(getLevelOrder('unknown')).toBe(-1)
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

    it('filters messages below configured level', () => {
        const messages = []
        const reporter = {
            log: (level, scope, time, msgs) => messages.push({ level, msgs })
        }
        const factory = new LoggerFactory([reporter])
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

describe('ConsoleLogReporter', () => {
    it('can be instantiated', () => {
        const reporter = new ConsoleLogReporter()
        expect(reporter).toBeDefined()
        expect(typeof reporter.log).toBe('function')
    })
})
