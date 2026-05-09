import { describe, it, expect } from 'vitest'
import { parseStandardOIDCProfile, parseGitHubProfile, parseDiscordProfile } from '../../src/oauth2/profiles'
import type { OAuth2Tokens } from '../../src/oauth2/types'

const baseTokens: OAuth2Tokens = {
	accessToken: 'at',
	tokenType: 'Bearer',
	raw: {}
}

describe('parseStandardOIDCProfile', () => {

	it('maps userinfo claims', () => {
		const profile = parseStandardOIDCProfile({
			tokens: baseTokens,
			userinfo: { sub: 'u-1', email: 'a@x', email_verified: true, name: 'A', picture: 'https://img.test/a.png' }
		})
		expect(profile.subject).toBe('u-1')
		expect(profile.email).toBe('a@x')
		expect(profile.emailVerified).toBe(true)
		expect(profile.avatarUrl).toBe('https://img.test/a.png')
	})

	it('id_token claims override userinfo', () => {
		const profile = parseStandardOIDCProfile({
			tokens: { ...baseTokens, raw: { sub: 'tok-sub' } },
			userinfo: { sub: 'ui-sub' }
		})
		expect(profile.subject).toBe('tok-sub')
	})

	it('throws on missing sub', () => {
		expect(() => parseStandardOIDCProfile({ tokens: baseTokens })).toThrow(/missing sub/)
	})
})

describe('parseGitHubProfile', () => {

	it('picks primary verified email', () => {
		const profile = parseGitHubProfile({
			user: { id: 42, login: 'octo', name: 'Octo Cat', avatar_url: 'https://gh.test/a.png' },
			emails: [
				{ email: 'a@x', primary: false, verified: true },
				{ email: 'b@x', primary: true, verified: true }
			]
		})
		expect(profile.subject).toBe('42')
		expect(profile.email).toBe('b@x')
		expect(profile.name).toBe('Octo Cat')
	})

	it('falls back to login when name missing', () => {
		const profile = parseGitHubProfile({
			user: { id: 1, login: 'foo' },
			emails: []
		})
		expect(profile.name).toBe('foo')
	})
})

describe('parseDiscordProfile', () => {

	it('builds avatar URL', () => {
		const profile = parseDiscordProfile({
			user: { id: '123', username: 'foo', global_name: 'Foo', email: 'a@x', verified: true, avatar: 'abc' }
		})
		expect(profile.subject).toBe('123')
		expect(profile.email).toBe('a@x')
		expect(profile.avatarUrl).toBe('https://cdn.discordapp.com/avatars/123/abc.png')
		expect(profile.name).toBe('Foo')
	})

	it('animated avatar uses gif', () => {
		const profile = parseDiscordProfile({
			user: { id: '1', username: 'u', avatar: 'a_xyz' }
		})
		expect(profile.avatarUrl).toBe('https://cdn.discordapp.com/avatars/1/a_xyz.gif')
	})

	it('no avatar → undefined', () => {
		const profile = parseDiscordProfile({ user: { id: '1', username: 'u' } })
		expect(profile.avatarUrl).toBeUndefined()
	})
})
