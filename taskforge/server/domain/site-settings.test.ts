// Unit coverage for the pure instance-settings decisions behind `services/site-settings.ts`
// (the `server-only` service can't be imported under vitest). Validates the branding +
// theme field rules and the stored-string decoding.

import { describe, it, expect } from 'vitest'
import {
    DEFAULT_SETTINGS,
    SETTING_KEYS,
    THEME_NAMES,
    decodeStored,
    isThemeName,
    parseSettingsUpdate,
} from './site-settings'

describe('isThemeName (tracks the bundled web-components skins)', () => {
    it('accepts every bundled theme and rejects anything else', () => {
        for (const t of THEME_NAMES) expect(isThemeName(t)).toBe(true)
        expect(THEME_NAMES).toEqual(['default', 'dungeon', 'aurora', 'sunshine', 'neon', 'blueprint'])
        expect(isThemeName('midnight')).toBe(false)
        expect(isThemeName('')).toBe(false)
        expect(isThemeName(42)).toBe(false)
    })
})

describe('parseSettingsUpdate', () => {
    it('accepts a valid theme', () => {
        const r = parseSettingsUpdate({ theme: 'blueprint' })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.patch.theme).toBe('blueprint')
    })
    it('rejects an unknown theme with the theme reason', () => {
        const r = parseSettingsUpdate({ theme: 'midnight' })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toBe('theme')
    })
    it('trims secondaryText and leaves absent fields out of the patch', () => {
        const r = parseSettingsUpdate({ secondaryText: '  cloud  ' })
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.patch.secondaryText).toBe('cloud')
            expect(r.patch.theme).toBeUndefined()
        }
    })
    it('rejects a non-object body', () => {
        expect(parseSettingsUpdate(null).ok).toBe(false)
    })
})

describe('decodeStored', () => {
    it('has a complete default record and decodes a stored theme', () => {
        expect(DEFAULT_SETTINGS.theme).toBe('default')
        const decoded = decodeStored({
            [SETTING_KEYS.theme]: 'neon',
            [SETTING_KEYS.secondaryText]: 'cloud',
        })
        expect(decoded.theme).toBe('neon')
        expect(decoded.secondaryText).toBe('cloud')
    })
    it('ignores an invalid stored theme (falls back to default on merge)', () => {
        const decoded = decodeStored({ [SETTING_KEYS.theme]: 'bogus' })
        expect(decoded.theme).toBeUndefined()
    })
})
