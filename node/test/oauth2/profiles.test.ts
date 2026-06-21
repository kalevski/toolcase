import { describe, it, expect } from 'vitest'
import { parseStandardOIDCProfile, parseGitHubProfile, parseDiscordProfile } from '../../src/oauth2/profiles'

describe('parseStandardOIDCProfile', () => {

	it('maps userinfo claims', () => {
		const profile = parseStandardOIDCProfile({
			userinfo: { sub: 'u-1', email: 'a@x', email_verified: true, name: 'A', picture: 'https://img.test/a.png' }
		})
		expect(profile.subject).toBe('u-1')
		expect(profile.email).toBe('a@x')
		expect(profile.emailVerified).toBe(true)
		expect(profile.avatarUrl).toBe('https://img.test/a.png')
	})

	it('idTokenClaims override userinfo', () => {
		const profile = parseStandardOIDCProfile({
			idTokenClaims: { sub: 'tok-sub' },
			userinfo: { sub: 'ui-sub' }
		})
		expect(profile.subject).toBe('tok-sub')
	})

	it('does not trust unverified tokens.raw — only idTokenClaims and userinfo are accepted', () => {
		// Passing only idTokenClaims with no email yields no email in the profile;
		// callers must pass verified claims explicitly rather than raw token responses.
		const profile = parseStandardOIDCProfile({ idTokenClaims: { sub: 'u1' } })
		expect(profile.email).toBeUndefined()
		expect(profile.emailVerified).toBeUndefined()
	})

	it('idTokenClaims email takes precedence over userinfo email', () => {
		const profile = parseStandardOIDCProfile({
			idTokenClaims: { sub: 'u1', email: 'verified@idp', email_verified: true },
			userinfo: { sub: 'u1', email: 'attacker@evil', email_verified: false }
		})
		expect(profile.email).toBe('verified@idp')
		expect(profile.emailVerified).toBe(true)
	})

	it('throws on missing sub', () => {
		expect(() => parseStandardOIDCProfile({})).toThrow(/missing sub/)
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

	it('falls back to any verified email when no primary verified email exists', () => {
		const profile = parseGitHubProfile({
			user: { id: 1, login: 'octo' },
			emails: [
				{ email: 'unverified@x', primary: true, verified: false },
				{ email: 'verified@x', primary: false, verified: true }
			]
		})
		expect(profile.email).toBe('verified@x')
		expect(profile.emailVerified).toBe(true)
	})

	it('does not include email when no verified email exists — prevents account-linking takeover', () => {
		const profile = parseGitHubProfile({
			user: { id: 1, login: 'octo' },
			emails: [{ email: 'unverified@x', primary: true, verified: false }]
		})
		expect(profile.email).toBeUndefined()
		expect(profile.emailVerified).toBeUndefined()
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
