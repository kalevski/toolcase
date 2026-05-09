import type { OAuth2Profile, OAuth2Tokens } from './types'

export interface ParseStandardOIDCProfileInput {
	tokens: OAuth2Tokens
	userinfo?: Record<string, unknown>
}

export function parseStandardOIDCProfile(input: ParseStandardOIDCProfileInput): OAuth2Profile {
	const claims: Record<string, unknown> = { ...(input.userinfo ?? {}), ...(input.tokens.raw ?? {}) }
	const subject = pickString(claims.sub)
	if (!subject) {
		throw new Error('parseStandardOIDCProfile: missing sub claim')
	}
	return {
		subject,
		email: pickString(claims.email),
		emailVerified: typeof claims.email_verified === 'boolean' ? claims.email_verified : undefined,
		name: pickString(claims.name),
		avatarUrl: pickString(claims.picture),
		groups: pickStringArray(claims.groups),
		roles: pickStringArray(claims.roles),
		raw: claims
	}
}

export interface ParseGitHubProfileInput {
	user: Record<string, unknown>
	emails: ReadonlyArray<{ email: string; primary: boolean; verified: boolean }>
}

export function parseGitHubProfile(input: ParseGitHubProfileInput): OAuth2Profile {
	const id = input.user.id
	if (typeof id !== 'number' && typeof id !== 'string') {
		throw new Error('parseGitHubProfile: missing user.id')
	}
	const subject = String(id)
	const primary = input.emails.find(e => e.primary && e.verified) ?? input.emails.find(e => e.verified) ?? input.emails[0]
	return {
		subject,
		email: primary?.email,
		emailVerified: primary?.verified,
		name: pickString(input.user.name) ?? pickString(input.user.login),
		avatarUrl: pickString(input.user.avatar_url),
		raw: { user: input.user, emails: input.emails }
	}
}

export interface ParseDiscordProfileInput {
	user: Record<string, unknown>
}

export function parseDiscordProfile(input: ParseDiscordProfileInput): OAuth2Profile {
	const id = pickString(input.user.id)
	if (!id) {
		throw new Error('parseDiscordProfile: missing user.id')
	}
	const username = pickString(input.user.global_name) ?? pickString(input.user.username)
	const avatarHash = pickString(input.user.avatar)
	const avatarUrl = avatarHash
		? `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.${avatarHash.startsWith('a_') ? 'gif' : 'png'}`
		: undefined
	return {
		subject: id,
		email: pickString(input.user.email),
		emailVerified: typeof input.user.verified === 'boolean' ? input.user.verified : undefined,
		name: username,
		avatarUrl,
		raw: input.user
	}
}

function pickString(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined
}

function pickStringArray(value: unknown): readonly string[] | undefined {
	if (!Array.isArray(value)) return undefined
	const out: string[] = []
	for (const v of value) {
		if (typeof v === 'string' && v.length > 0) out.push(v)
	}
	return out.length > 0 ? out : undefined
}
