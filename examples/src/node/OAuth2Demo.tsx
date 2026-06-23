import { useState } from 'react'
import {
    defineOAuth2Provider,
    buildAuthorizeURL,
    parseGitHubProfile,
    parseStandardOIDCProfile,
} from '@toolcase/node'
import { captureLogs, NodeDemoCard, type LogEntry } from './_demo/NodeDemo'

const providerCode = `import { defineOAuth2Provider, buildAuthorizeURL } from '@toolcase/node'

// Define a static provider once at app startup.
// For OIDC providers use oidcProvider() instead — it auto-fills
// endpoints from the discovery document (server-side; needs network).
const github = defineOAuth2Provider({
    clientId: 'Iv1.abc123',
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint:         'https://github.com/login/oauth/access_token',
    defaultScope: ['read:user', 'user:email'],
})

// Build the authorization redirect URL.
// state + codeVerifier are generated server-side via generateState() / generatePKCE()
// and stored in session/KV before the redirect.
const url = buildAuthorizeURL(github, {
    state:       'csrf-token-abc',
    redirectUri: 'https://app.example.com/auth/callback',
    scope:       ['read:user', 'user:email'],
})
// → https://github.com/login/oauth/authorize?response_type=code&client_id=Iv1.abc123&...`

const profileCode = `import { parseGitHubProfile, parseStandardOIDCProfile } from '@toolcase/node'

// GitHub: two-call API — /user + /user/emails.
// Parser selects the verified primary email and maps to the common OAuth2Profile shape.
const ghProfile = parseGitHubProfile({
    user:   { id: 1234567, login: 'alice', name: 'Alice Dev',
              avatar_url: 'https://avatars.githubusercontent.com/u/1234567' },
    emails: [
        { email: 'alice@personal.com', primary: false, verified: true },
        { email: 'alice@company.com',  primary: true,  verified: true },
    ],
})
// → { subject: '1234567', email: 'alice@company.com', emailVerified: true, ... }

// Standard OIDC: merge verified ID-token claims over userinfo.
// ID-token claims win for security-sensitive fields (sub, email, email_verified)
// because they are cryptographically signed; userinfo is not.
const oidcProfile = parseStandardOIDCProfile({
    idTokenClaims: { sub: 'user-uuid', email: 'alice@idp.example', email_verified: true, name: 'Alice' },
    userinfo:      { picture: 'https://photos.example/alice.jpg', groups: ['admin', 'dev'] },
})
// → { subject: 'user-uuid', email: 'alice@idp.example', emailVerified: true,
//     name: 'Alice', avatarUrl: 'https://...', groups: ['admin', 'dev'], ... }`

const serverCode = `// Everything below runs on the server — requires Node.js + network.

import {
    oidcProvider, generateState, generatePKCE,
    buildAuthorizeURL, verifyCallback,
    exchangeCode, refreshToken, verifyIdToken,
    type OAuth2Tokens,
} from '@toolcase/node'

// ── 1. Boot ──────────────────────────────────────────────────────────────
// oidcProvider() hits the OIDC discovery document once and auto-fills
// authorizationEndpoint, tokenEndpoint, jwksUri, issuer, etc.
const google = await oidcProvider({
    issuer:       'https://accounts.google.com',
    clientId:     process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    defaultScope: ['openid', 'email', 'profile'],
})

// ── 2. Login initiation handler ───────────────────────────────────────────
// Generate state + PKCE pair; persist them in session/KV before redirecting.
const state = generateState()                   // crypto-random, base64url
const { codeVerifier, codeChallenge } = generatePKCE()  // S256 by default
const redirectUri = 'https://app.example.com/auth/callback'
await kv.set(\`oauth:\${state}\`, { state, codeVerifier, redirectUri }, { ttlMs: 10 * 60_000 })

reply.redirect(buildAuthorizeURL(google, { state, redirectUri, codeChallenge }))

// ── 3. Callback handler (/auth/callback?code=…&state=…) ──────────────────
const ctx = await kv.get(\`oauth:\${req.query.state}\`)

// Constant-time CSRF check — throws OAuth2CallbackError on mismatch.
verifyCallback({ stored: ctx.state, received: req.query.state })

const tokens: OAuth2Tokens = await exchangeCode(google, {
    code:         req.query.code,
    redirectUri:  ctx.redirectUri,
    codeVerifier: ctx.codeVerifier,   // proves this server initiated the flow
})

// ── 4. Verify the OIDC ID token (JWKS fetched + cached automatically) ────
const verified = await verifyIdToken(tokens.idToken!, {
    issuer:   google.issuer!,
    audience: google.clientId,
    jwksUri:  google.jwksUri!,
})
// verified.payload → { sub, email, email_verified, iat, exp, ... }

// ── 5. Refresh when the access token expires ──────────────────────────────
const refreshed = await refreshToken(google, { refreshToken: tokens.refreshToken! })`

export const OAuth2Demo = () => {
    const [providerLogs, setProviderLogs] = useState<LogEntry[]>([])
    const [profileLogs, setProfileLogs] = useState<LogEntry[]>([])

    const runProvider = () => setProviderLogs(captureLogs(() => {
        const github = defineOAuth2Provider({
            clientId: 'Iv1.abc123',
            clientSecret: 'secret',
            authorizationEndpoint: 'https://github.com/login/oauth/authorize',
            tokenEndpoint: 'https://github.com/login/oauth/access_token',
            defaultScope: ['read:user', 'user:email'],
        })
        console.log('provider.clientId:', github.clientId)
        console.log('provider.clientAuthMethod:', github.clientAuthMethod)
        console.log('provider.pkceMethod:', github.pkceMethod)

        const url = buildAuthorizeURL(github, {
            state: 'csrf-token-abc',
            redirectUri: 'https://app.example.com/auth/callback',
            scope: ['read:user', 'user:email'],
        })
        console.log('authorize URL ->', url)

        const params = Object.fromEntries(new URL(url).searchParams)
        console.log('params ->', params)
    }))

    const runProfiles = () => setProfileLogs(captureLogs(() => {
        const ghProfile = parseGitHubProfile({
            user: {
                id: 1234567,
                login: 'alice',
                name: 'Alice Dev',
                avatar_url: 'https://avatars.githubusercontent.com/u/1234567',
            },
            emails: [
                { email: 'alice@personal.com', primary: false, verified: true },
                { email: 'alice@company.com',  primary: true,  verified: true },
            ],
        })
        console.log('GitHub profile ->', ghProfile)

        const oidcProfile = parseStandardOIDCProfile({
            idTokenClaims: {
                sub: 'user-uuid',
                email: 'alice@idp.example',
                email_verified: true,
                name: 'Alice',
            },
            userinfo: {
                picture: 'https://photos.example/alice.jpg',
                groups: ['admin', 'dev'],
            },
        })
        console.log('OIDC profile ->', oidcProfile)
    }))

    return (
        <div className="vstack gap-3">
            <NodeDemoCard
                title="Provider Config + Authorize URL"
                description="defineOAuth2Provider validates and normalises provider endpoints, infers clientAuthMethod, and defaults public clients to PKCE S256. buildAuthorizeURL assembles the redirect URL from provider defaults + per-request overrides. Both are browser-safe."
                code={providerCode}
                onRun={runProvider}
                logs={providerLogs}
            />
            <NodeDemoCard
                title="Profile Parsers"
                description="parseGitHubProfile maps the GitHub /user + /user/emails pair to the common OAuth2Profile shape, selecting only the verified primary email. parseStandardOIDCProfile merges userinfo over ID-token claims, with ID-token winning on security-sensitive fields. Both are browser-safe."
                code={profileCode}
                onRun={runProfiles}
                logs={profileLogs}
            />
            <NodeDemoCard
                title="Full Server-Side Flow"
                description="oidcProvider auto-discovers endpoints. generateState + generatePKCE produce the CSRF token and PKCE pair to store before the redirect. verifyCallback performs a constant-time CSRF check on return. exchangeCode redeems the authorization code, verifyIdToken validates the ID token against JWKS, and refreshToken extends the session. Server-side only."
                code={serverCode}
            />
        </div>
    )
}

export default OAuth2Demo
