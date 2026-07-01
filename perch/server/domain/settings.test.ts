// Unit coverage for the pure global-settings decisions behind `services/settings.ts`
// (the `server-only` service can't be imported under vitest). Validates the branding
// + custom-domain-ingress field rules and the stored-string decoding. See §10, §13.

import { describe, it, expect } from 'vitest'
import {
    DEFAULT_SETTINGS,
    SETTING_KEYS,
    THEME_NAMES,
    decodeStored,
    isHexColor,
    isIpv4,
    isIpv6,
    isThemeName,
    parseSettingsUpdate,
} from './settings'

describe('isThemeName (tracks the bundled web-components skins)', () => {
    it('accepts every bundled theme and rejects anything else', () => {
        for (const t of THEME_NAMES) expect(isThemeName(t)).toBe(true)
        expect(THEME_NAMES).toEqual(['default', 'dungeon', 'aurora', 'sunshine', 'neon', 'blueprint'])
        expect(isThemeName('midnight')).toBe(false)
        expect(isThemeName('')).toBe(false)
        expect(isThemeName(42)).toBe(false)
    })
})

describe('isIpv4', () => {
    it('accepts valid dotted quads', () => {
        expect(isIpv4('203.0.113.10')).toBe(true)
        expect(isIpv4('0.0.0.0')).toBe(true)
        expect(isIpv4('255.255.255.255')).toBe(true)
    })
    it('rejects out-of-range, leading-zero, and malformed input', () => {
        expect(isIpv4('256.0.0.1')).toBe(false)
        expect(isIpv4('01.2.3.4')).toBe(false) // leading zero
        expect(isIpv4('1.2.3')).toBe(false)
        expect(isIpv4('1.2.3.4.5')).toBe(false)
        expect(isIpv4('a.b.c.d')).toBe(false)
        expect(isIpv4('')).toBe(false)
    })
})

describe('isIpv6', () => {
    it('accepts full + compressed forms', () => {
        expect(isIpv6('2001:db8::10')).toBe(true)
        expect(isIpv6('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(true)
        expect(isIpv6('::1')).toBe(true)
    })
    it('rejects non-IPv6', () => {
        expect(isIpv6('203.0.113.10')).toBe(false)
        expect(isIpv6('not-an-ip')).toBe(false)
        expect(isIpv6('')).toBe(false)
    })
})

describe('isHexColor', () => {
    it('accepts #rgb and #rrggbb, rejects the rest', () => {
        expect(isHexColor('#0ea5e9')).toBe(true)
        expect(isHexColor('#fff')).toBe(true)
        expect(isHexColor('0ea5e9')).toBe(false) // missing #
        expect(isHexColor('#12345')).toBe(false) // wrong length
        expect(isHexColor('rgb(1,2,3)')).toBe(false)
    })
})

describe('parseSettingsUpdate (the PUT body)', () => {
    it('rejects a non-object body', () => {
        expect(parseSettingsUpdate(null).ok).toBe(false)
        expect(parseSettingsUpdate('x').ok).toBe(false)
        const r = parseSettingsUpdate(42)
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.reason).toBe('not_object')
    })

    it('accepts a partial patch and returns only the present fields (trimmed)', () => {
        const r = parseSettingsUpdate({ appName: '  MyHost  ', theme: 'aurora' })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.patch).toEqual({ appName: 'MyHost', theme: 'aurora' })
    })

    it('lowercases the brand colour', () => {
        const r = parseSettingsUpdate({ brandColor: '#0EA5E9' })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.patch.brandColor).toBe('#0ea5e9')
    })

    it('allows an empty ingress IP (clear back to env default)', () => {
        const r = parseSettingsUpdate({ ingressIpv4: '', ingressIpv6: '' })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.patch).toEqual({ ingressIpv4: '', ingressIpv6: '' })
    })

    it('rejects a bad theme / app name / colour / IP with the right reason', () => {
        expect((parseSettingsUpdate({ theme: 'midnight' }) as any).reason).toBe('theme')
        expect((parseSettingsUpdate({ appName: '' }) as any).reason).toBe('app_name')
        expect((parseSettingsUpdate({ appName: 'x'.repeat(61) }) as any).reason).toBe('app_name')
        expect((parseSettingsUpdate({ brandColor: 'blue' }) as any).reason).toBe('brand_color')
        expect((parseSettingsUpdate({ ingressIpv4: '999.1.1.1' }) as any).reason).toBe('ingress_ipv4')
        expect((parseSettingsUpdate({ ingressIpv6: 'nope' }) as any).reason).toBe('ingress_ipv6')
    })
})

describe('decodeStored', () => {
    it('decodes a valid stored map and drops invalid values', () => {
        const decoded = decodeStored({
            [SETTING_KEYS.appName]: 'MyHost',
            [SETTING_KEYS.theme]: 'neon',
            [SETTING_KEYS.brandColor]: '#abcdef',
            [SETTING_KEYS.ingressIpv4]: '203.0.113.10',
            // invalid theme below must be ignored, not throw:
        })
        expect(decoded).toEqual({
            appName: 'MyHost',
            theme: 'neon',
            brandColor: '#abcdef',
            ingressIpv4: '203.0.113.10',
        })
    })

    it('ignores an invalid stored theme', () => {
        const decoded = decodeStored({ [SETTING_KEYS.theme]: 'removed-skin' })
        expect(decoded.theme).toBeUndefined()
    })

    it('keeps an empty stored ingress IP (an explicit clear)', () => {
        const decoded = decodeStored({ [SETTING_KEYS.ingressIpv4]: '' })
        expect(decoded.ingressIpv4).toBe('')
    })

    it('DEFAULT_SETTINGS is a complete record', () => {
        expect(DEFAULT_SETTINGS.appName).toBe('Perch')
        expect(DEFAULT_SETTINGS.theme).toBe('default')
        expect(isThemeName(DEFAULT_SETTINGS.theme)).toBe(true)
    })
})
