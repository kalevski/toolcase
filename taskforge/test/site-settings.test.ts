// Unit coverage for the pure instance-settings decisions behind `services/site-settings.ts`
// (the `server-only` service can't be imported under vitest). Validates the branding +
// theme field rules and the stored-string decoding.

import { describe, it, expect } from 'vitest'
import {
    DEFAULT_SETTINGS,
    SETTING_KEYS,
    THEME_NAMES,
    VARIANT_NAMES,
    decodeStored,
    isThemeName,
    isVariantName,
    parseSettingsUpdate,
} from '../server/domain/site-settings'

describe('isThemeName (tracks the bundled web-components skins)', () => {
    it('accepts every bundled theme and rejects anything else', () => {
        for (const t of THEME_NAMES) expect(isThemeName(t)).toBe(true)
        expect(THEME_NAMES).toEqual(['default', 'dungeon', 'aurora', 'sunshine', 'neon', 'blueprint'])
        expect(isThemeName('midnight')).toBe(false)
        expect(isThemeName('')).toBe(false)
        expect(isThemeName(42)).toBe(false)
    })
})

describe('isVariantName (tracks the bundled accent variants)', () => {
    it('accepts every variant including the base-accents empty string', () => {
        for (const v of VARIANT_NAMES) expect(isVariantName(v)).toBe(true)
        expect(VARIANT_NAMES).toEqual(['', 'ocean', 'forest', 'ember', 'royal'])
        expect(isVariantName('pastel')).toBe(false)
        expect(isVariantName(42)).toBe(false)
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
    it('accepts a variant and the empty base-accents value', () => {
        const r = parseSettingsUpdate({ themeVariant: 'ember' })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.patch.themeVariant).toBe('ember')
        const base = parseSettingsUpdate({ themeVariant: '' })
        expect(base.ok).toBe(true)
        if (base.ok) expect(base.patch.themeVariant).toBe('')
    })
    it('rejects an unknown variant with the theme_variant reason', () => {
        const r = parseSettingsUpdate({ themeVariant: 'pastel' })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toBe('theme_variant')
    })
    it('trims the brand text fields and leaves absent fields out of the patch', () => {
        const r = parseSettingsUpdate({ primaryText: '  Acme Bot  ', secondaryText: '  cloud  ', brandLabel: ' beta ' })
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.patch.primaryText).toBe('Acme Bot')
            expect(r.patch.secondaryText).toBe('cloud')
            expect(r.patch.brandLabel).toBe('beta')
            expect(r.patch.theme).toBeUndefined()
        }
    })
    it('allows clearing primaryText (falls back to the default on decode)', () => {
        const r = parseSettingsUpdate({ primaryText: '' })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.patch.primaryText).toBe('')
    })
    it('rejects over-long brand text', () => {
        const r = parseSettingsUpdate({ primaryText: 'x'.repeat(41) })
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toBe('primary_text')
        const l = parseSettingsUpdate({ brandLabel: 'x'.repeat(21) })
        expect(l.ok).toBe(false)
        if (!l.ok) expect(l.reason).toBe('brand_label')
    })
    it('normalizes a valid brand color and rejects a malformed one', () => {
        const r = parseSettingsUpdate({ brandColor: ' #A1B2C3 ' })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.patch.brandColor).toBe('#a1b2c3')
        for (const bad of ['#fff', 'red', '6c5ce7', '#12345g']) {
            const b = parseSettingsUpdate({ brandColor: bad })
            expect(b.ok).toBe(false)
            if (!b.ok) expect(b.reason).toBe('brand_color')
        }
    })
    it('rejects a non-object body', () => {
        expect(parseSettingsUpdate(null).ok).toBe(false)
    })
})

describe('decodeStored', () => {
    it('has a complete default record and decodes stored values', () => {
        expect(DEFAULT_SETTINGS.theme).toBe('default')
        expect(DEFAULT_SETTINGS.primaryText).toBe('Task Forge')
        expect(DEFAULT_SETTINGS.brandColor).toBe('#6c5ce7')
        const decoded = decodeStored({
            [SETTING_KEYS.theme]: 'neon',
            [SETTING_KEYS.themeVariant]: 'ocean',
            [SETTING_KEYS.primaryText]: 'Acme Bot',
            [SETTING_KEYS.secondaryText]: 'cloud',
            [SETTING_KEYS.brandLabel]: 'beta',
            [SETTING_KEYS.brandColor]: '#a1b2c3',
        })
        expect(decoded.theme).toBe('neon')
        expect(decoded.themeVariant).toBe('ocean')
        expect(decoded.primaryText).toBe('Acme Bot')
        expect(decoded.secondaryText).toBe('cloud')
        expect(decoded.brandLabel).toBe('beta')
        expect(decoded.brandColor).toBe('#a1b2c3')
    })
    it('ignores invalid stored values (falls back to defaults on merge)', () => {
        const decoded = decodeStored({
            [SETTING_KEYS.theme]: 'bogus',
            [SETTING_KEYS.themeVariant]: 'pastel',
            [SETTING_KEYS.primaryText]: '',
            [SETTING_KEYS.brandColor]: 'red',
        })
        expect(decoded.theme).toBeUndefined()
        expect(decoded.themeVariant).toBeUndefined()
        expect(decoded.primaryText).toBeUndefined()
        expect(decoded.brandColor).toBeUndefined()
    })
    it('keeps an empty stored secondaryText/brandLabel as an explicit clear', () => {
        const decoded = decodeStored({ [SETTING_KEYS.secondaryText]: '', [SETTING_KEYS.brandLabel]: '' })
        expect(decoded.secondaryText).toBe('')
        expect(decoded.brandLabel).toBe('')
    })
})
