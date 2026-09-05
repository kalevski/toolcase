'use client'

import { useEffect, useMemo, useState } from 'react'
import type {
    ExtendedSelectItem,
    FormWizardStep,
    SingleCardSelectOption,
} from '@toolcase/web-components'
import { useTc, detailValue, targetValue } from '@/lib/tc'
import { useBranding } from '@/lib/branding-context'
import { useMe } from '@/lib/me-context'
import { SelectField, SwitchField, TextAreaField, TextField } from './fields'
import type { BaseDomain } from '@/server/domain/types'

// Create-site wizard (§9, §10, §14). A guided three-step flow built on
// `tc-form-wizard`: pick repo + branch (+ build subdir) → choose hostname →
// review and submit. Every `tc-*` element is driven through the `lib/tc.ts`
// bridge — object data (`items`/`options`/`steps`) flows in as element
// *properties* and `tc-change`/`tc-complete` come back as CustomEvents — because
// React can't set rich props or bind custom events through JSX alone.
//
// Step content is supplied as `data-step="N"` light-DOM children; the wizard
// relocates each step's subtree into its body as the user navigates. The wrappers
// are structurally stable (no conditional mount/unmount inside a step — sub-modes
// toggle via `hidden`) so React never reparents a node the wizard has moved.

// ── request / response shapes (mirror server/services/sites.ts, kept local so a
//    client component never imports a `server-only` module) ─────────────────────

interface RepoSummary {
    name: string
    owner: string
    defaultBranch: string
    private: boolean
}

interface BranchSummary {
    name: string
}

type HostnameSpec =
    | { kind: 'subdomain'; label: string; baseDomain: string }
    | { kind: 'custom'; domain: string }

type SiteRouting = 'static' | 'spa' | 'clean-urls'

interface CreateSiteRequest {
    repoOwner?: string
    repoName?: string
    branch?: string
    subdir?: string | null
    sourceType?: string
    sourceUrl?: string
    authMethod?: string
    authUsername?: string
    authHeaderName?: string
    checksumUrl?: string
    stripComponents?: number
    allowInsecure?: boolean
    sourceSecret?: string
    hostname: HostnameSpec
    realmId?: string
    routing?: SiteRouting
    notFound?: string
    cacheAssets?: boolean
    gzip?: boolean
    blockExploits?: boolean
    requireFile?: string[]
}

/** Source kinds a site can be created with. */
const SOURCE_TYPE_OPTIONS = [
    { value: 'git', label: 'Git repository' },
    { value: 'http-zip', label: 'Published archive (zip)' },
]

// Auth methods, labelled for what they are rather than by their engine name. Which set
// applies depends on the source kind and URL scheme; the server enforces the same rules.
const GIT_HTTPS_AUTH = [
    { value: 'none', label: 'None — public repository' },
    { value: 'github-token', label: 'GitHub token' },
    { value: 'https-token', label: 'Username + access token' },
]
const GIT_SSH_AUTH = [{ value: 'ssh-key', label: 'Deploy key (SSH private key)' }]
const ARCHIVE_AUTH = [
    { value: 'none', label: 'None — public archive' },
    { value: 'bearer', label: 'Bearer token' },
    { value: 'basic', label: 'Username + password' },
    { value: 'header', label: 'Custom header' },
]

/** What a method's secret actually is, for the credential field's label. */
const SECRET_LABEL: Record<string, string> = {
    'ssh-key': 'Deploy key (private key)',
    'https-token': 'Access token',
    'github-token': 'GitHub token',
    'bearer': 'Bearer token',
    'basic': 'Password',
    'header': 'Header value',
}

/** Whether a git URL speaks SSH — mirrors `isSshGitUrl` on the server. */
function looksLikeSsh(url: string): boolean {
    const u = url.trim()
    return u.startsWith('git@') || u.startsWith('ssh://')
}

/** Copy for the routing modes, shared by the step-1 select and the review panel. */
const ROUTING_LABEL: Record<SiteRouting, string> = {
    static: 'Static files (404 for unknown paths)',
    spa: 'Single-page app (fallback to index.html)',
    'clean-urls': 'Clean URLs (/about serves about.html)',
}

/** The created `Site` row fields the success panel surfaces (POST /api/sites → 201). */
interface CreatedSite {
    id: string
    hostname: string
    status: string
}

// ── wizard chrome ──────────────────────────────────────────────────────────────

const STEPS: FormWizardStep[] = [
    { label: 'Repository', icon: 'folder-git-2' },
    { label: 'Hostname', icon: 'globe' },
    { label: 'Review', icon: 'clipboard-check' },
]

// API error `code` → human copy. Codes come from services/sites.ts, services/quota.ts,
// and services/domains.ts (`httpErrorFor`); anything unmapped falls back to the code so
// nothing is ever silently swallowed.
const ERROR_COPY: Record<string, string> = {
    unauthorized: 'Your session expired. Sign in again to continue.',
    account_not_found: 'Your account could not be found. Sign in again.',
    site_limit_reached: "You've reached your site limit. Delete a site or ask an owner to raise your limit.",
    custom_domains_not_allowed: 'Custom domains aren’t enabled for your account. Use a Quaykeeper subdomain instead, or ask an owner.',
    unknown_base_domain: 'That base domain is no longer available. Pick another.',
    hostname_taken: 'That hostname is already taken. Choose a different one.',
    use_subdomain: "That domain is one of Quaykeeper's — attach it as a subdomain instead.",
    label_empty: 'Enter a subdomain label.',
    label_too_long: 'That subdomain label is too long.',
    label_charset: 'Use only lowercase letters, digits, and hyphens in the subdomain label.',
    label_reserved: 'That subdomain label is reserved. Choose another.',
    domain_empty: 'Enter a custom domain.',
    domain_too_long: 'That custom domain is too long.',
    domain_charset: 'Enter a valid domain, e.g. www.example.com.',
    invalid_empty: 'A required field is missing.',
    invalid_charset: 'One of the fields contains characters that are not allowed.',
    invalid_traversal: 'The build subdirectory must be a relative path without "..".',
    invalid_too_long: 'One of the fields is too long.',
    invalid_request: 'The request was incomplete. Check your selections and try again.',
    invalid_enum: 'Pick one of the offered routing modes.',
    invalid_count: 'Too many entries in the required-files list.',
    invalid_type: 'One of the values is the wrong kind.',
    invalid_range: 'One of the numbers is outside the range your plan allows.',
    source_secret_required: 'This source needs a credential — paste the deploy key, token, or password.',
    private_repos_not_allowed:
        'Deploying a private source isn’t enabled for your account. Use a public source, or ask an owner.',
    routing_conflict: 'A custom 404 page can’t be combined with single-page-app routing — the SPA fallback serves index.html for every path.',
    realm_not_found: 'That deploy instance no longer exists. Pick another.',
    realm_not_granted: 'You aren’t granted that deploy instance. Pick one of yours.',
    github_error: "Couldn't reach GitHub. Try again in a moment.",
    nginxpilot_error: 'The deploy engine is unavailable right now. Try again shortly.',
    nginx_error: 'The serving layer is unavailable right now. Try again shortly.',
    internal_error: 'Something went wrong creating the site. Try again.',
}

function errorMessage(code: unknown, status: number): string {
    if (typeof code === 'string' && ERROR_COPY[code]) return ERROR_COPY[code]
    if (typeof code === 'string' && code) return code
    return `The site could not be created (HTTP ${status}).`
}

export function CreateSiteWizard() {
    const branding = useBranding()
    const me = useMe()

    // ── deploy target (nginxpilot instance / realm) ──
    // The full realm list is owner-only (`me.realms`); everyone else deploys to their
    // assigned realm exactly as before. The picker only appears when there is a real
    // choice to make, and only then is `realmId` sent with the request — the server
    // grant-checks it regardless.
    const realmChoices = useMemo(() => me.realms ?? [], [me.realms])
    const showRealmPicker = realmChoices.length >= 2
    const [realmId, setRealmId] = useState(me.activeRealm?.id ?? '')
    // ── step 1: where the content comes from ──
    // `github` is the repo picker (the common case); `external` covers every other git
    // host and the published-archive kind, which have no repo list to browse.
    const [sourceKind, setSourceKind] = useState<'github' | 'external'>('github')
    const [sourceType, setSourceType] = useState<'git' | 'http-zip'>('git')
    const [sourceUrl, setSourceUrl] = useState('')
    const [externalBranch, setExternalBranch] = useState('main')
    const [authMethod, setAuthMethod] = useState('none')
    const [authUsername, setAuthUsername] = useState('')
    const [authHeaderName, setAuthHeaderName] = useState('')
    const [sourceSecret, setSourceSecret] = useState('')
    const [checksumUrl, setChecksumUrl] = useState('')
    const [stripComponents, setStripComponents] = useState('')
    const [allowInsecure, setAllowInsecure] = useState(false)

    // ── step 1: repository ──
    const [repos, setRepos] = useState<RepoSummary[]>([])
    const [reposLoading, setReposLoading] = useState(true)
    const [selectedRepo, setSelectedRepo] = useState<RepoSummary | null>(null)

    // ── step 2: branch + subdir ──
    const [branches, setBranches] = useState<BranchSummary[]>([])
    const [branchesLoading, setBranchesLoading] = useState(false)
    const [branch, setBranch] = useState('')
    const [subdir, setSubdir] = useState('')

    // ── step 1: serving settings (routing / 404 page / caching / compression) ──
    const [routing, setRouting] = useState<SiteRouting>('static')
    const [notFound, setNotFound] = useState('')
    const [cacheAssets, setCacheAssets] = useState(false)
    const [gzip, setGzip] = useState(true)
    const [blockExploits, setBlockExploits] = useState(false)
    // The post-fetch gate. Pre-filled with the default so the field states the rule it
    // enforces rather than hiding it — a docs or SPA build whose entry point isn't
    // index.html would otherwise never go live, with nothing on screen explaining why.
    const [requireFile, setRequireFile] = useState('index.html')

    // ── step 3: hostname ──
    const [baseDomains, setBaseDomains] = useState<BaseDomain[]>([])
    const [hostKind, setHostKind] = useState<'subdomain' | 'custom'>('subdomain')
    const [label, setLabel] = useState('')
    const [baseDomain, setBaseDomain] = useState('')
    const [customDomain, setCustomDomain] = useState('')

    // ── submission ──
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [created, setCreated] = useState<CreatedSite | null>(null)

    // Repos load once on mount.
    useEffect(() => {
        let cancelled = false
        setReposLoading(true)
        fetch('/api/github/repos', { cache: 'no-store' })
            .then((res) => (res.ok ? (res.json() as Promise<RepoSummary[]>) : Promise.reject(res)))
            .then((list) => {
                if (!cancelled) setRepos(list)
            })
            .catch((res: unknown) => {
                if (cancelled) return
                // 401 = no usable GitHub credential on the server (a session from
                // before token persistence, or a revoked token) — only a fresh
                // sign-in mints a new one. Anything else is transient.
                if (res instanceof Response && res.status === 401) {
                    setError('Your GitHub connection needs a refresh. Sign out and sign back in, then try again.')
                } else {
                    setError("Couldn't load your repositories from GitHub. Try refreshing.")
                }
            })
            .finally(() => {
                if (!cancelled) setReposLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [])

    // The base-domain pool is realm-scoped, so it reloads whenever the deploy target
    // changes (and once on mount for everyone else — the server falls back to the
    // caller's active/assigned realm when no `realmId` is passed).
    useEffect(() => {
        let cancelled = false
        const query = showRealmPicker && realmId ? `?realmId=${encodeURIComponent(realmId)}` : ''
        fetch(`/api/base-domains${query}`, { cache: 'no-store' })
            .then((res) => (res.ok ? (res.json() as Promise<BaseDomain[]>) : Promise.reject(res)))
            .then((list) => {
                if (cancelled) return
                setBaseDomains(list)
                // Reset the selection to the new pool; no subdomain pool on this
                // instance → the custom-domain path is the only one left.
                setBaseDomain(list[0]?.domain ?? '')
                if (list.length === 0) setHostKind('custom')
            })
            .catch(() => {
                /* base domains are optional chrome; the custom-domain path still works */
            })
        return () => {
            cancelled = true
        }
    }, [showRealmPicker, realmId])

    // Branches load whenever the selected repo changes; the repo's default branch
    // is preselected when present.
    useEffect(() => {
        if (!selectedRepo) {
            setBranches([])
            setBranch('')
            return
        }
        let cancelled = false
        setBranchesLoading(true)
        setBranches([])
        const url = `/api/github/repos/${encodeURIComponent(selectedRepo.owner)}/${encodeURIComponent(selectedRepo.name)}/branches`
        fetch(url, { cache: 'no-store' })
            .then((res) => (res.ok ? (res.json() as Promise<BranchSummary[]>) : Promise.reject(res)))
            .then((list) => {
                if (cancelled) return
                setBranches(list)
                const def = list.find((b) => b.name === selectedRepo.defaultBranch)
                setBranch(def ? def.name : (list[0]?.name ?? ''))
            })
            .catch(() => {
                if (!cancelled) setError("Couldn't load branches for that repository. Try another.")
            })
            .finally(() => {
                if (!cancelled) setBranchesLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [selectedRepo])

    // ── derived select data (memoised so useTc only re-applies on real changes) ──

    const repoItems = useMemo<ExtendedSelectItem[]>(
        () =>
            repos.map((r) => ({
                key: `${r.owner}/${r.name}`,
                label: `${r.owner}/${r.name}`,
                description: `default branch: ${r.defaultBranch}${r.private ? ' · private' : ''}`,
            })),
        [repos],
    )

    const branchItems = useMemo<ExtendedSelectItem[]>(
        () =>
            branches.map((b) => ({
                key: b.name,
                label: b.name,
                description: selectedRepo && b.name === selectedRepo.defaultBranch ? 'default branch' : undefined,
            })),
        [branches, selectedRepo],
    )

    // Every base domain is offered to every user — no audience tier, no badge.
    const baseDomainItems = useMemo<ExtendedSelectItem[]>(
        () => baseDomains.map((b) => ({ key: b.domain, label: b.domain })),
        [baseDomains],
    )

    // Auth methods legal for the chosen kind + URL scheme. The server enforces the same
    // pairing, so a stale selection is corrected here rather than rejected on submit.
    const authOptions = useMemo(() => {
        if (sourceType !== 'git') return ARCHIVE_AUTH
        return looksLikeSsh(sourceUrl) ? GIT_SSH_AUTH : GIT_HTTPS_AUTH
    }, [sourceType, sourceUrl])

    useEffect(() => {
        if (!authOptions.some((o) => o.value === authMethod)) setAuthMethod(authOptions[0].value)
    }, [authOptions, authMethod])

    const sourceKindOptions = useMemo<SingleCardSelectOption[]>(
        () => [
            {
                key: 'github',
                title: 'GitHub repository',
                description: 'Pick from the repositories your account can see.',
            },
            {
                key: 'external',
                title: 'Another source',
                description: 'Any git host by URL, or a published archive built elsewhere.',
            },
        ],
        [],
    )

    const realmOptions = useMemo(
        () =>
            realmChoices.map((r) => ({
                value: r.id,
                label: r.isDefault ? `${r.name} (default)` : r.name,
            })),
        [realmChoices],
    )
    const realmName = realmChoices.find((r) => r.id === realmId)?.name

    const hostKindOptions = useMemo<SingleCardSelectOption[]>(
        () => [
            {
                key: 'subdomain',
                title: 'Quaykeeper subdomain',
                description: 'Instant hosting on a Quaykeeper domain — no DNS setup.',
            },
            {
                key: 'custom',
                title: 'Custom domain',
                description: 'Bring your own domain via DNS A-records.',
            },
        ],
        [],
    )

    // The A-record copy for the custom-domain path (§10). The ingress IP comes from
    // the instance settings (owner-set, else the env default); the Verify action lives
    // on the site dashboard after the site is created. Falls back to a documented
    // placeholder when no server IP is configured yet.
    const dnsInstructions = useMemo(() => {
        const host = customDomain.trim() || 'www.example.com'
        const ipv4 = branding.ingressIpv4 || '<server IP not configured>'
        const lines = [
            `; DNS records for ${host} — then create the site and click Verify on its dashboard.`,
            `A      @      ${ipv4}`,
            `A      www    ${ipv4}`,
        ]
        if (branding.ingressIpv6) {
            lines.push('; optional, for IPv6:', `AAAA   @      ${branding.ingressIpv6}`)
        }
        return lines.join('\n')
    }, [customDomain, branding.ingressIpv4, branding.ingressIpv6])

    // ── element refs (every tc-* element is wired through lib/tc.ts) ─────────────

    const wizardRef = useTc<HTMLElement>(
        useMemo(() => ({ steps: STEPS, loading: submitting }), [submitting]),
        {
            'tc-complete': () => void submit(),
            'tc-step-change': () => setError(null),
        },
    )

    const sourceKindRef = useTc<HTMLElement>(
        useMemo(() => ({ options: sourceKindOptions, value: sourceKind }), [sourceKindOptions, sourceKind]),
        {
            'tc-change': (event: Event) => setSourceKind(detailValue<string>(event) as 'github' | 'external'),
        },
    )

    const repoSelectRef = useTc<HTMLElement>(
        useMemo(() => ({ items: repoItems, loading: reposLoading }), [repoItems, reposLoading]),
        {
            'tc-change': (event: Event) => {
                const key = detailValue<string>(event)
                const repo = repos.find((r) => `${r.owner}/${r.name}` === key) ?? null
                setSelectedRepo(repo)
            },
        },
    )

    const branchSelectRef = useTc<HTMLElement>(
        useMemo(
            () => ({ items: branchItems, value: branch, loading: branchesLoading }),
            [branchItems, branch, branchesLoading],
        ),
        { 'tc-change': (event: Event) => setBranch(detailValue<string>(event)) },
    )

    const subdirRef = useTc<HTMLElement>(undefined, {
        input: (event: Event) => setSubdir(targetValue(event)),
    })

    const routingRef = useTc<HTMLElement>(useMemo(() => ({ value: routing }), [routing]), {
        'tc-change': (event: Event) => setRouting(detailValue<SiteRouting>(event)),
    })

    const notFoundRef = useTc<HTMLElement>(undefined, {
        input: (event: Event) => setNotFound(targetValue(event)),
    })

    const cacheAssetsRef = useTc<HTMLElement>(useMemo(() => ({ checked: cacheAssets }), [cacheAssets]), {
        'tc-change': (event: Event) => setCacheAssets(detailValue<boolean>(event)),
    })

    const gzipRef = useTc<HTMLElement>(useMemo(() => ({ checked: gzip }), [gzip]), {
        'tc-change': (event: Event) => setGzip(detailValue<boolean>(event)),
    })

    const blockExploitsRef = useTc<HTMLElement>(useMemo(() => ({ checked: blockExploits }), [blockExploits]), {
        'tc-change': (event: Event) => setBlockExploits(detailValue<boolean>(event)),
    })

    const requireFileRef = useTc<HTMLElement>(useMemo(() => ({ value: requireFile }), [requireFile]), {
        input: (event: Event) => setRequireFile(targetValue(event)),
    })

    const hostKindRef = useTc<HTMLElement>(
        useMemo(() => ({ options: hostKindOptions, value: hostKind }), [hostKindOptions, hostKind]),
        { 'tc-change': (event: Event) => setHostKind(detailValue<string>(event) as 'subdomain' | 'custom') },
    )

    const baseDomainRef = useTc<HTMLElement>(
        useMemo(() => ({ items: baseDomainItems, value: baseDomain }), [baseDomainItems, baseDomain]),
        { 'tc-change': (event: Event) => setBaseDomain(detailValue<string>(event)) },
    )

    const labelRef = useTc<HTMLElement>(undefined, {
        input: (event: Event) => setLabel(targetValue(event)),
    })

    const customDomainRef = useTc<HTMLElement>(undefined, {
        input: (event: Event) => setCustomDomain(targetValue(event)),
    })

    const dnsSnippetRef = useTcCodeSnippet(dnsInstructions)

    // ── submit (POST /api/sites) ─────────────────────────────────────────────────

    async function submit() {
        setError(null)

        const external = sourceKind === 'external'
        if (!external) {
            if (!selectedRepo) return setError('Pick a repository to deploy.')
            if (!branch) return setError('Pick a branch to deploy.')
        } else {
            if (!sourceUrl.trim()) {
                return setError(sourceType === 'git' ? 'Enter the repository URL.' : 'Enter the archive URL.')
            }
            if (sourceType === 'git' && !externalBranch.trim()) return setError('Enter the branch to deploy.')
            if (authMethod !== 'none' && !sourceSecret.trim()) {
                return setError('Paste the credential this source needs, or set authentication to None.')
            }
        }

        let hostname: HostnameSpec
        if (hostKind === 'subdomain') {
            if (!baseDomain) return setError('No Quaykeeper base domain is available — use a custom domain instead.')
            if (!label.trim()) return setError('Enter a subdomain label.')
            hostname = { kind: 'subdomain', label: label.trim(), baseDomain }
        } else {
            if (!customDomain.trim()) return setError('Enter a custom domain.')
            hostname = { kind: 'custom', domain: customDomain.trim() }
        }

        // Two shapes: the GitHub path sends repo coordinates and no URL (the server
        // derives it); the external path sends the URL and lets the server derive the
        // display labels from it.
        const sourceFields: Partial<CreateSiteRequest> = external
            ? {
                  sourceType,
                  sourceUrl: sourceUrl.trim(),
                  branch: sourceType === 'git' ? externalBranch.trim() : undefined,
                  subdir: sourceType === 'git' ? subdir.trim() || undefined : undefined,
                  authMethod,
                  authUsername: authUsername.trim() || undefined,
                  authHeaderName: authMethod === 'header' ? authHeaderName.trim() || undefined : undefined,
                  sourceSecret: sourceSecret.trim() || undefined,
                  checksumUrl: sourceType === 'http-zip' ? checksumUrl.trim() || undefined : undefined,
                  stripComponents:
                      sourceType === 'http-zip' && stripComponents !== '' ? Number(stripComponents) : undefined,
                  allowInsecure: sourceType === 'http-zip' && allowInsecure ? true : undefined,
              }
            : {
                  repoOwner: selectedRepo?.owner,
                  repoName: selectedRepo?.name,
                  branch,
                  subdir: subdir.trim() || undefined,
              }

        const payload: CreateSiteRequest = {
            ...sourceFields,
            hostname,
            realmId: showRealmPicker && realmId ? realmId : undefined,
            routing: routing !== 'static' ? routing : undefined,
            // SPA routing serves index.html for every path — a 404 page can never
            // trigger there, so it's dropped (the field is hidden in that mode too).
            notFound: routing !== 'spa' && notFound.trim() ? notFound.trim() : undefined,
            cacheAssets: cacheAssets || undefined,
            gzip: gzip || undefined,
            blockExploits: blockExploits || undefined,
            requireFile: parseCsv(requireFile),
        }

        setSubmitting(true)
        try {
            const res = await fetch('/api/sites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (res.status === 201) {
                const site = (await res.json()) as CreatedSite
                setCreated(site)
                return
            }
            const data = (await res.json().catch(() => ({}))) as { error?: unknown }
            setError(errorMessage(data.error, res.status))
        } catch {
            setError('Network error while creating the site. Check your connection and try again.')
        } finally {
            setSubmitting(false)
        }
    }

    function reset() {
        setCreated(null)
        setError(null)
        setRealmId(me.activeRealm?.id ?? '')
        setSourceKind('github')
        setSourceType('git')
        setSourceUrl('')
        setExternalBranch('main')
        setAuthMethod('none')
        setAuthUsername('')
        setAuthHeaderName('')
        setSourceSecret('')
        setChecksumUrl('')
        setStripComponents('')
        setAllowInsecure(false)
        setSelectedRepo(null)
        setBranch('')
        setSubdir('')
        setRouting('static')
        setNotFound('')
        setCacheAssets(false)
        setGzip(true)
        setBlockExploits(false)
        setRequireFile('index.html')
        setLabel('')
        setCustomDomain('')
        setHostKind(baseDomains.length > 0 ? 'subdomain' : 'custom')
    }

    // ── success panel ────────────────────────────────────────────────────────────

    if (created) {
        return (
            <div className="quaykeeper-wizard-success" role="status">
                <h2 className="quaykeeper-wizard-success-title">Site created</h2>
                <p className="quaykeeper-wizard-success-host">{created.hostname}</p>
                <p className="quaykeeper-wizard-success-body">
                    Your site is <strong>{created.status}</strong>. Quaykeeper is fetching the branch and
                    deploying it — follow its progress on the site dashboard.
                </p>
                <tc-button variant="primary" onClick={reset}>
                    Create another site
                </tc-button>
            </div>
        )
    }

    const previewHost =
        hostKind === 'subdomain'
            ? `${(label.trim() || 'your-label').toLowerCase()}.${baseDomain || 'basedomain'}`
            : customDomain.trim() || 'www.example.com'

    return (
        <div className="quaykeeper-wizard">
            {error && (
                <div className="quaykeeper-wizard-error" role="alert">
                    {error}
                </div>
            )}

            <tc-form-wizard ref={wizardRef} complete-label="Create site" complete-icon="rocket">
                {/* Step 1 — repository, branch + build subdir */}
                <div slot="step-0" className="quaykeeper-wizard-step">
                    <h3 className="quaykeeper-wizard-heading">Source</h3>
                    <p className="quaykeeper-wizard-hint">
                        Quaykeeper deploys pre-built static content — point it at a branch that already holds the
                        built site (e.g. a <code>gh-pages</code> or <code>dist</code> branch), or at an archive
                        your build publishes.
                    </p>
                    <tc-single-card-select ref={sourceKindRef} columns="2" aria-label="Source kind" />

                    {/* Sub-modes toggle via `hidden` rather than mounting/unmounting, so the
                        wizard never has a step child reparented out from under it. */}
                    <div className="quaykeeper-wizard-host-mode" hidden={sourceKind !== 'external'}>
                        <SelectField
                            label="Source type"
                            value={sourceType}
                            options={SOURCE_TYPE_OPTIONS}
                            onValue={(v) => setSourceType(v as 'git' | 'http-zip')}
                            help="A git repository is cloned and served. An archive is downloaded and unpacked — for content built elsewhere, like a CI-published zip."
                        />
                        <TextField
                            label={sourceType === 'git' ? 'Repository URL' : 'Archive URL'}
                            value={sourceUrl}
                            onValue={setSourceUrl}
                            placeholder={
                                sourceType === 'git'
                                    ? 'https://gitlab.com/acme/site.git'
                                    : 'https://ci.example.com/site.zip'
                            }
                            help={
                                sourceType === 'git'
                                    ? 'Any git host. Use git@host:owner/repo.git to authenticate with a deploy key.'
                                    : 'The archive to download and unpack on each check.'
                            }
                        />
                        <div hidden={sourceType !== 'git' || undefined}>
                            <TextField
                                label="Branch"
                                value={externalBranch}
                                onValue={setExternalBranch}
                                placeholder="main"
                                help="The branch whose contents are published."
                            />
                        </div>
                        <div hidden={sourceType !== 'http-zip' || undefined}>
                            <TextField
                                label="Checksum URL (optional)"
                                value={checksumUrl}
                                onValue={setChecksumUrl}
                                placeholder="https://ci.example.com/site.zip.sha256"
                                help="A checksum file the archive is verified against before anything is published. Strongly recommended."
                            />
                            <TextField
                                label="Strip leading folders"
                                type="number"
                                min="0"
                                max="16"
                                value={stripComponents}
                                onValue={setStripComponents}
                                placeholder="0"
                                help="Set to 1 when the archive wraps everything in a single top-level folder, so that folder isn't part of every URL."
                            />
                            <SwitchField
                                label="Allow an insecure (http://) URL"
                                checked={allowInsecure}
                                onChecked={setAllowInsecure}
                                help="Only for an archive on a trusted internal network. Over plain http the download can be read and altered in transit — pair it with a checksum URL at minimum."
                            />
                        </div>
                        <SelectField
                            label="Authentication"
                            value={authMethod}
                            options={authOptions}
                            onValue={setAuthMethod}
                            help="How Quaykeeper proves it may fetch this source. An ssh URL always uses a deploy key."
                        />
                        <div hidden={!(authMethod === 'https-token' || authMethod === 'basic') || undefined}>
                            <TextField
                                label="Username"
                                value={authUsername}
                                onValue={setAuthUsername}
                                help="The account the token or password belongs to."
                            />
                        </div>
                        <div hidden={authMethod !== 'header' || undefined}>
                            <TextField
                                label="Header name"
                                value={authHeaderName}
                                onValue={setAuthHeaderName}
                                placeholder="X-Api-Key"
                                help="The request header the credential is sent in."
                            />
                        </div>
                        <div hidden={authMethod === 'none' || undefined}>
                            <TextAreaField
                                label={SECRET_LABEL[authMethod] ?? 'Credential'}
                                value={sourceSecret}
                                onValue={setSourceSecret}
                                rows={authMethod === 'ssh-key' ? 6 : 2}
                                placeholder={
                                    authMethod === 'ssh-key' ? '-----BEGIN OPENSSH PRIVATE KEY-----' : undefined
                                }
                                help="Stored encrypted and never shown again. Quaykeeper passes it to the deploy engine as a file it reads at fetch time."
                            />
                        </div>
                    </div>

                    <div className="quaykeeper-wizard-host-mode" hidden={sourceKind !== 'github'}>
                        <tc-extended-select
                            ref={repoSelectRef}
                            placeholder="Select a repository…"
                            search-placeholder="Search repositories…"
                            no-results-text="No repositories found"
                        />
                    </div>
                    {(sourceKind === 'external' || selectedRepo) && (
                        <>
                            <div hidden={sourceKind !== 'github' || undefined}>
                                <tc-extended-select
                                    ref={branchSelectRef}
                                    placeholder="Select a branch…"
                                    search-placeholder="Search branches…"
                                    no-results-text="No branches found"
                                />
                            </div>
                            <div hidden={sourceType !== 'git' || undefined}>
                                <tc-input
                                    ref={subdirRef}
                                    label="Build subdirectory (optional)"
                                    placeholder="dist/"
                                    help="The folder inside the branch that holds index.html. Leave blank if the site is at the repo root. Quaykeeper only publishes once the required files exist (see below)."
                                />
                            </div>
                            <tc-select
                                ref={routingRef}
                                label="Routing"
                                help="How request paths map to files. Pick the single-page-app mode for client-side routers (React, Vue, Angular); clean URLs suit pre-rendered sites exporting about.html-style pages."
                            >
                                <option value="static">{ROUTING_LABEL.static}</option>
                                <option value="spa">{ROUTING_LABEL.spa}</option>
                                <option value="clean-urls">{ROUTING_LABEL['clean-urls']}</option>
                            </tc-select>
                            <tc-input
                                ref={notFoundRef}
                                label="Custom 404 page (optional)"
                                placeholder="/404.html"
                                help="A page in the build served for unknown paths instead of the plain nginx 404."
                                hidden={routing === 'spa' || undefined}
                            />
                            <tc-switch
                                ref={cacheAssetsRef}
                                label="Long-lived asset caching"
                                help="Serve fingerprinted assets (CSS, JS, fonts, images) with an immutable Cache-Control header. Use when the build hashes its asset filenames."
                            />
                            <tc-switch
                                ref={gzipRef}
                                label="Compress responses (gzip)"
                                help="Gzip text responses (HTML, CSS, JS, JSON) on the way out. Worth having on for almost any static site."
                            />
                            <tc-switch
                                ref={blockExploitsRef}
                                label="Block common exploit probes"
                                help="Reject the request patterns automated scanners use (SQL injection, file traversal, known-vulnerable paths) before they reach your files."
                            />
                            <tc-input
                                ref={requireFileRef}
                                label="Required files"
                                placeholder="index.html"
                                help="Comma-separated. A build only goes live once all of them exist, so a broken build leaves the previous release serving. Change it if your entry point isn't index.html; clear it to publish whatever the build produces."
                            />
                        </>
                    )}
                </div>

                {/* Step 2 — hostname */}
                <div slot="step-1" className="quaykeeper-wizard-step">
                    <h3 className="quaykeeper-wizard-heading">Hostname</h3>

                    {/* Deploy target: only when more than one instance is registered.
                        Toggled via `hidden` (not mount/unmount) like the other sub-modes
                        so the wizard never has a step child reparented under it. */}
                    <div hidden={!showRealmPicker || undefined}>
                        <SelectField
                            label="Deploy to instance"
                            value={realmId}
                            options={realmOptions}
                            onValue={setRealmId}
                            help="The nginxpilot instance this site is deployed to. Available subdomains depend on it."
                        />
                    </div>

                    <tc-single-card-select ref={hostKindRef} columns="2" aria-label="Hostname type" />

                    <div className="quaykeeper-wizard-host-mode" hidden={hostKind !== 'subdomain'}>
                        {baseDomains.length > 0 ? (
                            <>
                                <label className="quaykeeper-wizard-field-label">Subdomain</label>
                                <div className="quaykeeper-wizard-subdomain">
                                    <tc-input ref={labelRef} placeholder="alice" aria-label="Subdomain label" />
                                    <span className="quaykeeper-wizard-dot">.</span>
                                    <tc-extended-select
                                        ref={baseDomainRef}
                                        placeholder="Base domain…"
                                        search-placeholder="Search domains…"
                                    />
                                </div>
                                <p className="quaykeeper-wizard-preview">
                                    Your site will be served at <strong>{previewHost}</strong>
                                </p>
                            </>
                        ) : (
                            <tc-empty-state icon="globe">
                                No Quaykeeper subdomains are available yet. Use a custom domain below.
                            </tc-empty-state>
                        )}
                    </div>

                    <div className="quaykeeper-wizard-host-mode" hidden={hostKind !== 'custom'}>
                        <tc-input ref={customDomainRef} label="Custom domain" placeholder="www.example.com" />
                        <p className="quaykeeper-wizard-hint">
                            Add these DNS records at your registrar, then create the site and verify it from its
                            dashboard:
                        </p>
                        <tc-code-snippet ref={dnsSnippetRef} title="DNS records" />
                    </div>
                </div>

                {/* Step 3 — review */}
                <div slot="step-2" className="quaykeeper-wizard-step">
                    <h3 className="quaykeeper-wizard-heading">Review</h3>
                    <dl className="quaykeeper-wizard-review">
                        <dt>Source</dt>
                        <dd>
                            {sourceKind === 'github'
                                ? selectedRepo
                                    ? `${selectedRepo.owner}/${selectedRepo.name}`
                                    : '—'
                                : sourceUrl.trim() || '—'}
                        </dd>
                        {sourceKind === 'external' && (
                            <>
                                <dt>Type</dt>
                                <dd>{sourceType === 'git' ? 'Git repository' : 'Published archive'}</dd>
                                <dt>Authentication</dt>
                                <dd>{authOptions.find((o) => o.value === authMethod)?.label ?? authMethod}</dd>
                            </>
                        )}
                        {(sourceKind === 'github' || sourceType === 'git') && (
                            <>
                                <dt>Branch</dt>
                                <dd>{(sourceKind === 'github' ? branch : externalBranch.trim()) || '—'}</dd>
                                <dt>Build directory</dt>
                                <dd>{subdir.trim() || '(source root)'}</dd>
                            </>
                        )}
                        <dt>Routing</dt>
                        <dd>{ROUTING_LABEL[routing]}</dd>
                        <dt>404 page</dt>
                        <dd>{routing !== 'spa' && notFound.trim() ? notFound.trim() : '(default)'}</dd>
                        <dt>Asset caching</dt>
                        <dd>{cacheAssets ? 'Immutable Cache-Control' : 'Off'}</dd>
                        <dt>Compression</dt>
                        <dd>{gzip ? 'gzip' : 'Off'}</dd>
                        <dt>Exploit blocking</dt>
                        <dd>{blockExploits ? 'On' : 'Off'}</dd>
                        <dt>Required files</dt>
                        <dd>{parseCsv(requireFile).join(', ') || '(publish any build)'}</dd>
                        <dt>Hostname</dt>
                        <dd>{previewHost}</dd>
                        {showRealmPicker && (
                            <>
                                <dt>Deploys to</dt>
                                <dd>{realmName ?? '—'}</dd>
                            </>
                        )}
                    </dl>
                    <p className="quaykeeper-wizard-hint">
                        Press <strong>Create site</strong> to provision it. Quaykeeper writes the deploy config and
                        starts the first sync.
                    </p>
                </div>
            </tc-form-wizard>
        </div>
    )
}

/** Split a comma- (or newline-) separated field into a trimmed, blank-free list. */
function parseCsv(text: string): string[] {
    return text
        .split(/[,\n]/)
        .map((part) => part.trim())
        .filter((part) => part !== '')
}

// `tc-code-snippet` takes its body via the `code` attribute (a string), but it's
// cleaner to drive it as a property through the same bridge as everything else.
function useTcCodeSnippet(code: string) {
    return useTc<HTMLElement>(useMemo(() => ({ code }), [code]), undefined)
}
