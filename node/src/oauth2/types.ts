export type ClientAuthMethod = 'client_secret_basic' | 'client_secret_post' | 'none'

export interface OAuth2ProviderConfig {
	id?: string
	authorizationEndpoint: string
	tokenEndpoint: string
	revocationEndpoint?: string
	introspectionEndpoint?: string
	deviceAuthorizationEndpoint?: string
	userinfoEndpoint?: string
	issuer?: string
	jwksUri?: string
	endSessionEndpoint?: string
	defaultScope?: readonly string[]
	clientId: string
	clientSecret?: string
	clientAuthMethod?: ClientAuthMethod
	pkceMethod?: 'S256' | 'plain'
}

export interface OAuth2Tokens {
	accessToken: string
	refreshToken?: string
	idToken?: string
	tokenType: string
	scope?: readonly string[]
	expiresAt?: Date
	raw: Record<string, unknown>
}

export interface OAuth2Profile {
	subject: string
	email?: string
	emailVerified?: boolean
	name?: string
	avatarUrl?: string
	/** OIDC-standard `groups` claim — flat list of group identifiers. */
	groups?: readonly string[]
	/** OIDC-standard `roles` claim — flat list of role identifiers. */
	roles?: readonly string[]
	raw: Record<string, unknown>
}

export interface OAuth2FlowState {
	state: string
	nonce?: string
	codeVerifier: string
	redirectUri: string
	scope?: readonly string[]
	returnTo?: string
	/** Epoch milliseconds. Stable across JSON / KV serialization round-trips. */
	createdAt: number
}

export function defineOAuth2Provider(opts: OAuth2ProviderConfig): OAuth2ProviderConfig {
	if (!opts.tokenEndpoint || typeof opts.tokenEndpoint !== 'string') {
		throw new Error('defineOAuth2Provider: tokenEndpoint is required')
	}
	if (!opts.authorizationEndpoint || typeof opts.authorizationEndpoint !== 'string') {
		throw new Error('defineOAuth2Provider: authorizationEndpoint is required')
	}
	if (!opts.clientId || typeof opts.clientId !== 'string') {
		throw new Error('defineOAuth2Provider: clientId is required')
	}
	// Explicit `clientAuthMethod` always wins (including 'none' even when a
	// secret is set). Otherwise infer from secret presence.
	const clientAuthMethod = opts.clientAuthMethod !== undefined
		? opts.clientAuthMethod
		: (opts.clientSecret ? 'client_secret_basic' : 'none')
	// Public clients (no client secret) should always use PKCE; default to S256.
	const pkceMethod = opts.pkceMethod ?? (clientAuthMethod === 'none' ? 'S256' : undefined)
	if (pkceMethod === 'plain') {
		console.warn('defineOAuth2Provider: pkceMethod "plain" provides no protection if the code_challenge is intercepted; use "S256" instead')
	}
	return {
		...opts,
		authorizationEndpoint: stripTrailingSlash(opts.authorizationEndpoint),
		tokenEndpoint: stripTrailingSlash(opts.tokenEndpoint),
		revocationEndpoint: opts.revocationEndpoint ? stripTrailingSlash(opts.revocationEndpoint) : undefined,
		introspectionEndpoint: opts.introspectionEndpoint ? stripTrailingSlash(opts.introspectionEndpoint) : undefined,
		deviceAuthorizationEndpoint: opts.deviceAuthorizationEndpoint ? stripTrailingSlash(opts.deviceAuthorizationEndpoint) : undefined,
		userinfoEndpoint: opts.userinfoEndpoint ? stripTrailingSlash(opts.userinfoEndpoint) : undefined,
		jwksUri: opts.jwksUri ? stripTrailingSlash(opts.jwksUri) : undefined,
		endSessionEndpoint: opts.endSessionEndpoint ? stripTrailingSlash(opts.endSessionEndpoint) : undefined,
		clientAuthMethod,
		pkceMethod
	}
}

function stripTrailingSlash(url: string): string {
	return url.endsWith('/') ? url.slice(0, -1) : url
}
