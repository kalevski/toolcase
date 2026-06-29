// PURE docker-run / docker-compose renderer for a DockerSpec (planning §7.2,
// §7.3, §6.4). No I/O — given a spec + RenderOpts it returns the command text.
// The wharf-client injection (§7.3) and install.sh bootstrap (§6.4) are the only
// non-obvious bits; everything else is a straight flag-by-flag serialization of
// the structured spec (§7.1).

import type { DockerSpec, DockerLifecycle, DockerRenderFormat } from '@/server/domain/types'

export interface RenderOpts {
    lifecycle: DockerLifecycle // 'run' | 'recreate' (stop+rm+run)
    includeStop?: boolean // default true when recreate
    includeRm?: boolean // default true when recreate
    format?: DockerRenderFormat // 'sh' (default) | 'compose'
    agentBaseUrl?: string // WHARF_URL for envSource 'wharf'
    instance?: { id: string; environmentName: string } | null
    instanceEnv?: { key: string; value: string }[] | null
}

const DEFAULT_AGENT_URL = 'http://wharf-agent:4000'

/**
 * Shell-escape a value for safe inclusion in a `docker run` line. We single-quote
 * any value containing whitespace or shell metacharacters, escaping embedded
 * single quotes via the classic `'"'"'` close/quote/reopen trick (§7.2).
 */
function shEscape(value: string): string {
    if (value.length === 0) return "''"
    // Safe set: only escape when metacharacters/whitespace are present.
    if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value
    return "'" + value.replace(/'/g, `'"'"'`) + "'"
}

/** `KEY=value` with the value (only) shell-escaped — used for `-e` and `-l`. */
function kvArg(key: string, value: string): string {
    return `${key}=${shEscape(value)}`
}

/** `image[:tag]` — tag is optional/blank-safe. */
function imageRef(spec: DockerSpec): string {
    return spec.tag ? `${spec.image}:${spec.tag}` : spec.image
}

/**
 * Build the docker command text for a spec. `sh` (default) emits a backslash-
 * continued `docker run` (optionally preceded by stop/rm for the recreate
 * lifecycle); `compose` emits a docker-compose service block.
 */
export function buildDockerCommand(spec: DockerSpec, opts: RenderOpts): string {
    const format: DockerRenderFormat = opts.format ?? 'sh'
    if (format === 'compose') return buildCompose(spec, opts)
    return buildSh(spec, opts)
}

// ── sh format (§7.2) ──────────────────────────────────────────────────────────

function buildSh(spec: DockerSpec, opts: RenderOpts): string {
    const lines: string[] = []
    const name = spec.containerName

    // recreate lifecycle = stop + rm the existing container, ignoring failures.
    if (opts.lifecycle === 'recreate') {
        if (opts.includeStop !== false) {
            lines.push('# stop existing (if any)')
            lines.push(`docker stop ${shEscape(name)} 2>/dev/null || true`)
        }
        if (opts.includeRm !== false) {
            lines.push(`docker rm   ${shEscape(name)} 2>/dev/null || true`)
        }
    }

    // Each flag is one continuation line under `docker run`.
    const flags: string[] = []

    if (spec.detach) flags.push('-d')
    if (spec.tty) flags.push('-t')
    if (spec.removeOnExit) flags.push('--rm')
    flags.push(`--name ${shEscape(name)}`)
    flags.push(`--restart ${spec.restart}`)
    // --pull only carries weight for the non-default 'always'/'never' values.
    if (spec.pull === 'always' || spec.pull === 'never') flags.push(`--pull ${spec.pull}`)
    if (spec.network) flags.push(`--network ${shEscape(spec.network)}`)

    for (const p of spec.ports) {
        const suffix = p.protocol === 'udp' ? '/udp' : ''
        // Ports are validated as integers server-side (wharf S2); shEscape regardless
        // so the rendered text can never inject shell even if an unvalidated spec leaks in.
        flags.push(`-p ${shEscape(String(p.host))}:${shEscape(String(p.container))}${suffix}`)
    }
    for (const v of spec.volumes) {
        flags.push(`-v ${shEscape(v.host)}:${shEscape(v.container)}:${v.mode}`)
    }

    if (spec.memory) flags.push(`--memory ${shEscape(spec.memory)}`)
    if (spec.cpus) flags.push(`--cpus ${shEscape(spec.cpus)}`)
    if (spec.user) flags.push(`--user ${shEscape(spec.user)}`)
    if (spec.workdir) flags.push(`-w ${shEscape(spec.workdir)}`)

    for (const l of spec.labels) flags.push(`-l ${kvArg(l.key, l.value)}`)

    // Env injection per §7.3. 'wharf' takes over the entrypoint/command, so it
    // signals that here and we skip the spec's own entrypoint + command below.
    const wharf = buildEnvFlags(spec, opts, flags)

    if (!wharf && spec.entrypoint) flags.push(`--entrypoint ${shEscape(spec.entrypoint)}`)
    // extraArgs is a deliberate RAW shell escape-hatch (wharf S2): the devops author
    // types free-form flags (e.g. `--cap-add NET_ADMIN`) that must reach the shell as
    // multiple unescaped tokens. The injection-prone structured fields (restart,
    // protocol, ports) are validated/escaped above; this field is the author's own
    // responsibility and is intentionally emitted verbatim.
    if (spec.extraArgs) flags.push(spec.extraArgs)

    // Trailing positional: image then (for non-wharf) the command args.
    const trailing: string[] = [imageRef(spec)]
    if (wharf) {
        // wharf bootstrap: sh -c '...install.sh | sh -s -- exec -- <origCommand>'
        trailing.push(...wharf.command)
    } else if (spec.command.length) {
        trailing.push(...spec.command.map(shEscape))
    }

    // Assemble: `docker run \` then one flag per continuation line, image/command last.
    const body = [...flags, trailing.join(' ')]
    const runLines = ['docker run']
        .concat(body)
        .map((seg, i, arr) => (i < arr.length - 1 ? `    ${seg} \\` : `    ${seg}`))
    // First element is the bare `docker run` header line (no leading indent).
    runLines[0] = 'docker run \\'
    lines.push(...runLines)

    return lines.join('\n')
}

/**
 * Append the `-e` env flags for the spec's envSource (§7.3) and, when 'wharf',
 * return the entrypoint override + bootstrap command (§6.4). Returns null for
 * 'none'/'instance' (the spec's own entrypoint/command apply).
 */
function buildEnvFlags(
    spec: DockerSpec,
    opts: RenderOpts,
    flags: string[],
): { command: string[] } | null {
    // Inline literal env is always emitted first (real values).
    const inline = () => {
        for (const kv of spec.envInline) flags.push(`-e ${kvArg(kv.key, kv.value)}`)
    }

    switch (spec.envSource) {
        case 'none': {
            inline()
            return null
        }
        case 'wharf': {
            // §7.3 wharf-client: needs the owning instance for environment/id.
            if (!opts.instance) throw new Error('envSource wharf requires an instance')
            inline()
            const base = opts.agentBaseUrl ?? DEFAULT_AGENT_URL
            flags.push(`-e ${kvArg('WHARF_URL', base)}`)
            flags.push(`-e ${kvArg('WHARF_ENVIRONMENT', opts.instance.environmentName)}`)
            flags.push(`-e ${kvArg('WHARF_INSTANCE_ID', opts.instance.id)}`)
            // WHARF_SECRET must NOT be inlined — it arrives via a docker/orchestrator
            // secret so it never lands in shell history or this rendered text.
            flags.push('# WHARF_SECRET must be supplied via a docker/orchestrator secret (never inlined)')
            // §6.4 bootstrap: pull install.sh from the agent and re-exec the orig command.
            flags.push('--entrypoint sh')
            const orig = spec.command.length ? spec.command.join(' ') : ''
            const script = `wget -qO- "$WHARF_URL/install.sh" | sh -s -- exec -- ${orig}`.trimEnd()
            return { command: ['-c', shEscape(script)] }
        }
        case 'instance': {
            // §7.3 instance: inline the resolved instance env with REAL values.
            if (!opts.instance || !opts.instanceEnv) {
                throw new Error('envSource instance requires an instance and instanceEnv')
            }
            flags.push('# WARNING: real secret values are inlined below')
            inline()
            for (const kv of opts.instanceEnv) flags.push(`-e ${kvArg(kv.key, kv.value)}`)
            return null
        }
    }
}

// ── compose format (§7.2) ─────────────────────────────────────────────────────

/**
 * A faithful subset of the spec as a docker-compose service block. Not every
 * `docker run` flag has a compose analogue here; the omissions are noted inline.
 */
function buildCompose(spec: DockerSpec, opts: RenderOpts): string {
    const ind = '    '
    const lines: string[] = []
    lines.push('# docker-compose service (subset of the run spec)')
    lines.push('# omitted: --pull, --rm, -t, memory/cpus/user/workdir, extraArgs')
    lines.push('services:')
    lines.push(`${ind}${spec.containerName}:`)
    lines.push(`${ind}${ind}image: ${imageRef(spec)}`)
    lines.push(`${ind}${ind}container_name: ${spec.containerName}`)
    lines.push(`${ind}${ind}restart: ${spec.restart}`)

    if (spec.ports.length) {
        lines.push(`${ind}${ind}ports:`)
        for (const p of spec.ports) {
            const suffix = p.protocol === 'udp' ? '/udp' : ''
            lines.push(`${ind}${ind}${ind}- "${p.host}:${p.container}${suffix}"`)
        }
    }
    if (spec.volumes.length) {
        lines.push(`${ind}${ind}volumes:`)
        for (const v of spec.volumes) {
            lines.push(`${ind}${ind}${ind}- "${v.host}:${v.container}:${v.mode}"`)
        }
    }

    // environment mapping mirrors the sh env injection per envSource (§7.3).
    const env: [string, string][] = spec.envInline.map((kv) => [kv.key, kv.value])
    if (spec.envSource === 'wharf') {
        if (!opts.instance) throw new Error('envSource wharf requires an instance')
        env.push(['WHARF_URL', opts.agentBaseUrl ?? DEFAULT_AGENT_URL])
        env.push(['WHARF_ENVIRONMENT', opts.instance.environmentName])
        env.push(['WHARF_INSTANCE_ID', opts.instance.id])
        // WHARF_SECRET intentionally omitted — supply via compose `secrets:`.
    } else if (spec.envSource === 'instance') {
        if (!opts.instance || !opts.instanceEnv) {
            throw new Error('envSource instance requires an instance and instanceEnv')
        }
        for (const kv of opts.instanceEnv) env.push([kv.key, kv.value])
    }
    if (env.length) {
        lines.push(`${ind}${ind}environment:`)
        for (const [k, v] of env) lines.push(`${ind}${ind}${ind}${k}: ${composeScalar(v)}`)
    }

    if (spec.network) {
        lines.push(`${ind}${ind}networks:`)
        lines.push(`${ind}${ind}${ind}- ${spec.network}`)
    }

    return lines.join('\n')
}

/** Quote a compose scalar when it contains characters YAML would mis-parse. */
function composeScalar(value: string): string {
    if (value.length === 0) return '""'
    if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value
    return JSON.stringify(value)
}
