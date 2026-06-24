import { describe, it, expect } from 'vitest'
import { verifyCallback } from '../../src/oauth2/callback'
import { OAuth2CallbackError } from '../../src/errors'

describe('verifyCallback', () => {

    it('passes when stored and received are identical', () => {
        expect(() => verifyCallback({ stored: 'abc123', received: 'abc123' })).not.toThrow()
    })

    it('throws OAuth2CallbackError on value mismatch (same length)', () => {
        expect(() => verifyCallback({ stored: 'aaaaaa', received: 'bbbbbb' }))
            .toThrow(OAuth2CallbackError)
    })

    it('throws OAuth2CallbackError on length mismatch', () => {
        expect(() => verifyCallback({ stored: 'short', received: 'longer-value' }))
            .toThrow(OAuth2CallbackError)
    })

    it('error message identifies state mismatch', () => {
        expect(() => verifyCallback({ stored: 'x', received: 'y' }))
            .toThrow('state mismatch')
    })

    it('passes with long opaque state strings', () => {
        const state = 'eyJhbGciOiJIUzI1NiJ9.dGVzdA.abc123XYZ'
        expect(() => verifyCallback({ stored: state, received: state })).not.toThrow()
    })

    it('throws when received has one extra character', () => {
        expect(() => verifyCallback({ stored: 'state123', received: 'state1234' }))
            .toThrow(OAuth2CallbackError)
    })

    it('throws on empty vs non-empty', () => {
        expect(() => verifyCallback({ stored: '', received: 'x' }))
            .toThrow(OAuth2CallbackError)
    })

    it('passes when both are empty strings', () => {
        expect(() => verifyCallback({ stored: '', received: '' })).not.toThrow()
    })
})
