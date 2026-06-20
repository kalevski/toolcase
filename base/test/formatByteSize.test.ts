import { describe, it, expect } from 'vitest'
import formatByteSize from '../src/formatByteSize'

describe('formatByteSize', () => {
    it('returns 0 Bytes for zero', () => {
        expect(formatByteSize(0)).toBe('0 Bytes')
    })

    it('formats bytes', () => {
        expect(formatByteSize(500)).toBe('500 Bytes')
    })

    it('formats kilobytes', () => {
        expect(formatByteSize(1024)).toBe('1 KB')
    })

    it('formats megabytes', () => {
        expect(formatByteSize(1048576)).toBe('1 MB')
    })

    it('formats gigabytes', () => {
        expect(formatByteSize(1073741824)).toBe('1 GB')
    })

    it('respects decimal places', () => {
        expect(formatByteSize(1536, 1)).toBe('1.5 KB')
    })

    it('treats negative decimals as 0', () => {
        expect(formatByteSize(1536, -1)).toBe('2 KB')
    })

    it('returns 0 Bytes for negative input', () => {
        expect(formatByteSize(-5)).toBe('0 Bytes')
    })

    it('returns 0 Bytes for NaN', () => {
        expect(formatByteSize(NaN)).toBe('0 Bytes')
    })

    it('returns 0 Bytes for sub-1 input', () => {
        expect(formatByteSize(0.5)).toBe('0 Bytes')
    })

    it('clamps huge values to YB', () => {
        expect(formatByteSize(1e30)).toMatch(/ YB$/)
    })
})
