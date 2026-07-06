// Pure docker-run snippet domain (the Snippets page): the persisted
// `DockerRunSpec` shape, its normalization + validation, and the `docker run`
// command renderer — including the optional Quaykeeper-variable injection that
// rewrites the container entrypoint inline (`--entrypoint /bin/sh … -c '…'`) to
// pull the instance's resolved env from the agent server at boot and `exec` the
// real command.
//
// PURE and isomorphic (no `server-only`, no I/O): the client imports it for the
// live command preview + inline form validation, the service for the
// authoritative save-time validation. Quaykeeper never executes the generated
// command — it only renders text for the user to copy — so validation here is
// about catching mistakes and keeping the output shell-safe, not sandboxing.

// ── spec shape (persisted as JSON in docker_snippet.spec) ────────────────────

/** `--restart` policy; '' = omit the flag (docker's default `no`). */
export type RestartPolicy = '' | 'no' | 'on-failure' | 'always' | 'unless-stopped'

export const RESTART_POLICIES: readonly RestartPolicy[] = ['', 'no', 'on-failure', 'always', 'unless-stopped']

/** `--pull` policy; '' = omit the flag (docker's default `missing`). */
export type PullPolicy = '' | 'always' | 'missing' | 'never'

export const PULL_POLICIES: readonly PullPolicy[] = ['', 'always', 'missing', 'never']

/** Which HTTP client the injection bootstrap uses — curl images vs busybox/alpine (wget). */
export type InjectTool = 'curl' | 'wget'

/** One `-p` publish mapping. `host` may be empty (docker picks a random host port)
 *  or `port` / `ip:port`; `container` is the container port. */
export interface PortMapping {
    host: string
    container: string
    protocol: 'tcp' | 'udp'
}

/** One `-v` bind/volume mapping: named volume or absolute host path → absolute
 *  container path. */
export interface VolumeMapping {
    source: string
    target: string
    readOnly: boolean
}

/** One literal `-e KEY=value` pair baked into the snippet. */
export interface EnvEntry {
    key: string
    value: string
}

/** Quaykeeper-variable injection settings. The target instance is NOT part of the
 *  spec — it lives on the snippet row (`instance_id`, FK'd so deletes degrade
 *  gracefully); this only carries how the bootstrap fetches. */
export interface InjectOptions {
    /** HTTP client available inside the image. */
    tool: InjectTool
}

/** The full form-built `docker run` recipe. Every string field is trimmed by
 *  {@link normalizeSpec}; '' consistently means "unset / omit the flag". */
export interface DockerRunSpec {
    /** Image reference without the tag (e.g. `redis`, `ghcr.io/acme/api`). */
    image: string
    /** Tag or `sha256:…` digest; '' = docker's `latest`. */
    tag: string
    /** `--name`; '' = docker-generated name. */
    containerName: string
    /** `-d` — run detached. */
    detach: boolean
    /** `--rm` — remove the container when it exits. Conflicts with a restart policy. */
    autoRemove: boolean
    restart: RestartPolicy
    pull: PullPolicy
    /** `--network`; '' = default bridge. */
    network: string
    /** `-w` working directory (absolute); '' = image default. */
    workdir: string
    /** `-u` user (`name`, `uid`, or `uid:gid`); '' = image default. */
    user: string
    ports: PortMapping[]
    volumes: VolumeMapping[]
    env: EnvEntry[]
    /** `--entrypoint` override; '' = image default. Mutually exclusive with `inject`
     *  (injection IS an entrypoint override). */
    entrypoint: string
    /** Command + args appended after the image, verbatim (the user writes shell
     *  text, so their own quoting is preserved). Required when injecting — it is
     *  what the bootstrap `exec`s after loading the variables. */
    command: string
    /** Extra raw `docker run` flags appended verbatim (e.g. `--memory 512m --cap-add NET_ADMIN`). */
    extraArgs: string
    /** Quaykeeper-variable injection; null = plain docker run. */
    inject: InjectOptions | null
}

/** A blank spec — the editor's starting draft and the normalization fallback. */
export function emptySpec(): DockerRunSpec {
    return {
        image: '',
        tag: '',
        containerName: '',
        detach: true,
        autoRemove: false,
        restart: '',
        pull: '',
        network: '',
        workdir: '',
        user: '',
        ports: [],
        volumes: [],
        env: [],
        entrypoint: '',
        command: '',
        extraArgs: '',
        inject: null,
    }
}

// ── normalization (unknown JSON → a well-shaped, trimmed spec) ───────────────

function str(v: unknown): string {
    return typeof v === 'string' ? v.trim() : ''
}

function bool(v: unknown, fallback: boolean): boolean {
    return typeof v === 'boolean' ? v : fallback
}

/**
 * Coerce an untrusted/aged JSON value into a well-shaped {@link DockerRunSpec}:
 * unknown fields dropped, missing fields defaulted, every string trimmed, enum
 * fields snapped back to '' when out of range. Shared by the service (request
 * bodies) and the client (stored specs from before a shape change), so a spec
 * read back from the DB is always safe to render.
 */
export function normalizeSpec(input: unknown): DockerRunSpec {
    const raw = (input ?? {}) as Record<string, unknown>
    const base = emptySpec()

    const restart = str(raw.restart)
    const pull = str(raw.pull)

    const ports: PortMapping[] = Array.isArray(raw.ports)
        ? raw.ports.map((p) => {
              const m = (p ?? {}) as Record<string, unknown>
              return {
                  host: str(m.host),
                  container: str(m.container),
                  protocol: m.protocol === 'udp' ? ('udp' as const) : ('tcp' as const),
              }
          })
        : []
    const volumes: VolumeMapping[] = Array.isArray(raw.volumes)
        ? raw.volumes.map((v) => {
              const m = (v ?? {}) as Record<string, unknown>
              return { source: str(m.source), target: str(m.target), readOnly: bool(m.readOnly, false) }
          })
        : []
    const env: EnvEntry[] = Array.isArray(raw.env)
        ? raw.env.map((e) => {
              const m = (e ?? {}) as Record<string, unknown>
              // Values keep inner whitespace; only the key is trimmed.
              return { key: str(m.key), value: typeof m.value === 'string' ? m.value : '' }
          })
        : []

    const injectRaw = raw.inject as Record<string, unknown> | null | undefined
    const inject: InjectOptions | null =
        injectRaw && typeof injectRaw === 'object'
            ? { tool: injectRaw.tool === 'wget' ? 'wget' : 'curl' }
            : null

    return {
        image: str(raw.image),
        tag: str(raw.tag),
        containerName: str(raw.containerName),
        detach: bool(raw.detach, base.detach),
        autoRemove: bool(raw.autoRemove, base.autoRemove),
        restart: (RESTART_POLICIES as readonly string[]).includes(restart) ? (restart as RestartPolicy) : '',
        pull: (PULL_POLICIES as readonly string[]).includes(pull) ? (pull as PullPolicy) : '',
        network: str(raw.network),
        workdir: str(raw.workdir),
        user: str(raw.user),
        ports,
        volumes,
        env,
        entrypoint: str(raw.entrypoint),
        command: str(raw.command),
        extraArgs: str(raw.extraArgs),
        inject,
    }
}

// ── validation ───────────────────────────────────────────────────────────────

// Pragmatic shapes: strict enough to catch typos and keep the rendered command
// shell-clean, loose enough for registries-with-port, digests, and uid:gid forms.
const IMAGE_PATTERN = /^[a-z0-9][a-z0-9._/:-]*$/
const TAG_PATTERN = /^(?:[A-Za-z0-9_][A-Za-z0-9._-]{0,127}|sha256:[0-9a-f]{64})$/
const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/
const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const USER_PATTERN = /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*(?::[a-zA-Z0-9_][a-zA-Z0-9_.-]*)?$/
const IPV4_PATTERN = /^(?:\d{1,3})(?:\.\d{1,3}){3}$/

function validPort(value: string): boolean {
    if (!/^\d{1,5}$/.test(value)) return false
    const n = Number(value)
    return n >= 1 && n <= 65535
}

/** `host` side of a `-p` mapping: '' (random), `port`, or `ip:port`. */
function validHostPort(value: string): boolean {
    if (value === '') return true
    const colon = value.lastIndexOf(':')
    if (colon === -1) return validPort(value)
    return IPV4_PATTERN.test(value.slice(0, colon)) && validPort(value.slice(colon + 1))
}

/**
 * Validate a normalized spec (run {@link normalizeSpec} first). Returns human
 * error strings, empty when the spec is saveable. `hasInstance` tells the
 * validator whether the snippet row carries an injection target — the instance
 * itself is not part of the spec.
 */
export function validateSpec(spec: DockerRunSpec, hasInstance: boolean): string[] {
    const errors: string[] = []

    if (!spec.image) errors.push('An image is required.')
    else if (!IMAGE_PATTERN.test(spec.image)) {
        errors.push('Image must be a lowercase reference like redis or ghcr.io/acme/api (put the tag in the Tag field).')
    }
    if (spec.tag && !TAG_PATTERN.test(spec.tag)) {
        errors.push('Tag must be a valid image tag (letters/digits/._-) or a sha256:… digest.')
    }
    if (spec.containerName && !NAME_PATTERN.test(spec.containerName)) {
        errors.push('Container name may only contain letters, digits, _ . - and must start alphanumeric.')
    }
    if (spec.network && !NAME_PATTERN.test(spec.network)) {
        errors.push('Network name may only contain letters, digits, _ . - and must start alphanumeric.')
    }
    if (spec.workdir && !spec.workdir.startsWith('/')) {
        errors.push('Working directory must be an absolute path (start with /).')
    }
    if (spec.user && !USER_PATTERN.test(spec.user)) {
        errors.push('User must be a name, uid, or uid:gid.')
    }

    spec.ports.forEach((p, i) => {
        if (!validPort(p.container)) errors.push(`Port mapping ${i + 1}: container port must be 1–65535.`)
        if (!validHostPort(p.host)) errors.push(`Port mapping ${i + 1}: host side must be empty, a port, or ip:port.`)
    })
    spec.volumes.forEach((v, i) => {
        if (!v.source || v.source.includes(':') || /\s/.test(v.source)) {
            errors.push(`Volume ${i + 1}: source must be a named volume or host path (no spaces or colons).`)
        }
        if (!v.target.startsWith('/') || v.target.includes(':')) {
            errors.push(`Volume ${i + 1}: target must be an absolute container path (no colons).`)
        }
    })
    spec.env.forEach((e, i) => {
        if (!ENV_KEY_PATTERN.test(e.key)) {
            errors.push(`Env var ${i + 1}: key must be a valid env name (letters, digits, _; not starting with a digit).`)
        }
    })

    if (spec.autoRemove && spec.restart && spec.restart !== 'no') {
        errors.push('“Remove on exit” (--rm) conflicts with a restart policy — pick one.')
    }
    if (spec.inject) {
        if (!hasInstance) errors.push('Variable injection needs a target instance.')
        if (spec.entrypoint) {
            errors.push('Variable injection overrides the entrypoint itself — clear the custom entrypoint or disable injection.')
        }
        if (!spec.command) {
            errors.push('Variable injection needs the command to exec after loading the variables (the image default CMD is bypassed).')
        }
    }

    return errors
}

// ── rendering ────────────────────────────────────────────────────────────────

/** POSIX-shell single-quote `value` (`'` → `'\''`). Safe for any content. */
export function shQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`
}

/** Quote only when needed — bare-safe tokens stay bare so the command reads clean. */
function shToken(value: string): string {
    return /^[A-Za-z0-9_@%+=:,./-]+$/.test(value) ? value : shQuote(value)
}

/** The full image reference: `image[:tag]` or `image@sha256:…`. */
export function imageRef(spec: DockerRunSpec): string {
    if (!spec.tag) return spec.image
    return spec.tag.startsWith('sha256:') ? `${spec.image}@${spec.tag}` : `${spec.image}:${spec.tag}`
}

/** Everything the renderer needs beyond the spec itself. */
export interface BuildContext {
    /** Injection target's instance name (required to render an injecting snippet). */
    instanceName?: string
    /** Agent-server base URL (the admin "Instance config URL" setting). */
    agentUrl?: string
}

/**
 * The inline bootstrap the injecting variant runs as PID 1: fetch the instance's
 * resolved env from the agent server as shell `export` lines (`?format=shell` —
 * single-quoted, so values never re-expand), source it, then `exec` the real
 * command. Fails closed: `set -e` aborts the container if the fetch fails, so an
 * app never boots half-configured.
 */
function injectScript(spec: DockerRunSpec): string {
    const url = '"$QUAYKEEPER_URL/v1/env?format=shell"'
    const fetchCmd =
        spec.inject?.tool === 'wget'
            ? `wget -q --header "X-Quaykeeper-Instance: $QUAYKEEPER_INSTANCE" --header "Authorization: Bearer $QUAYKEEPER_SECRET" -O "$f" ${url}`
            : `curl -fsSL -H "X-Quaykeeper-Instance: $QUAYKEEPER_INSTANCE" -H "Authorization: Bearer $QUAYKEEPER_SECRET" -o "$f" ${url}`
    return `set -e; f=$(mktemp); ${fetchCmd}; . "$f"; rm -f "$f"; exec ${spec.command}`
}

/**
 * Render the multi-line `docker run` command for a (normalized, valid) spec.
 * With injection, the entrypoint is overridden inline: the three QUAYKEEPER_* env
 * vars point the bootstrap at the agent server, and `QUAYKEEPER_SECRET` is
 * rendered as `"$QUAYKEEPER_SECRET"` — resolved by the OPERATOR'S shell at paste
 * time, so the fetch secret is never stored in the snippet or the command text.
 */
export function buildDockerRun(spec: DockerRunSpec, ctx: BuildContext = {}): string {
    const args: string[] = []

    if (spec.detach) args.push('-d')
    if (spec.autoRemove) args.push('--rm')
    if (spec.containerName) args.push(`--name ${shToken(spec.containerName)}`)
    if (spec.restart && spec.restart !== 'no') args.push(`--restart ${spec.restart}`)
    if (spec.pull) args.push(`--pull ${spec.pull}`)
    if (spec.network) args.push(`--network ${shToken(spec.network)}`)
    if (spec.workdir) args.push(`-w ${shToken(spec.workdir)}`)
    if (spec.user) args.push(`-u ${shToken(spec.user)}`)

    for (const p of spec.ports) {
        const proto = p.protocol === 'udp' ? '/udp' : ''
        args.push(p.host ? `-p ${p.host}:${p.container}${proto}` : `-p ${p.container}${proto}`)
    }
    for (const v of spec.volumes) {
        args.push(`-v ${v.source}:${v.target}${v.readOnly ? ':ro' : ''}`)
    }
    for (const e of spec.env) {
        args.push(`-e ${e.key}=${shToken(e.value)}`)
    }
    if (spec.extraArgs) args.push(spec.extraArgs)

    if (spec.inject) {
        const agentUrl = ctx.agentUrl || 'https://config.example.com'
        args.push(`-e QUAYKEEPER_URL=${shToken(agentUrl)}`)
        args.push(`-e QUAYKEEPER_INSTANCE=${shToken(ctx.instanceName ?? '')}`)
        args.push(`-e QUAYKEEPER_SECRET="$QUAYKEEPER_SECRET"`)
        args.push('--entrypoint /bin/sh')
    } else if (spec.entrypoint) {
        args.push(`--entrypoint ${shToken(spec.entrypoint)}`)
    }

    const tail: string[] = [imageRef(spec)]
    if (spec.inject) {
        tail.push(`-c ${shQuote(injectScript(spec))}`)
    } else if (spec.command) {
        tail.push(spec.command)
    }

    return ['docker run', ...args, ...tail].join(' \\\n    ')
}
