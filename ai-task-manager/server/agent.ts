// Backend-neutral agent adapter (§6.4, §6.11).
// Reproduces lib/agent.sh + agent_build_argv + agent_resolve_model.
// Default backend is `claude`; `cursor` is supported via the same shape.

import 'server-only'
import { spawn, type ChildProcess } from 'node:child_process'
import { config } from './config'

// ── model resolution (alias → backend slug) ─────────────────────────────────

const CLAUDE_ALIASES: Record<string, string> = {
    fast: 'claude-haiku-4-5',
    mid: 'claude-sonnet-4-6',
    deep: 'claude-opus-4-8',
}

const CURSOR_ALIASES: Record<string, string> = {
    fast: 'cursor-small',
    mid: 'cursor-medium',
    deep: 'cursor-large',
}

export function resolveModel(model: string): string {
    const table = config.agent === 'cursor' ? CURSOR_ALIASES : CLAUDE_ALIASES
    return table[model] ?? model
}

// ── argv construction ────────────────────────────────────────────────────────

export interface AgentArgvOptions {
    model: string
    prompt: string
    /** warm-session id to `--resume` into, if any */
    resumeSessionId?: string
    /** override the centralized extra args (rarely needed) */
    extraArgs?: string
}

/** Tokenize AGENT_EXTRA_ARGS respecting simple whitespace separation. */
function splitArgs(s: string): string[] {
    return s
        .trim()
        .split(/\s+/)
        .filter(Boolean)
}

export function buildArgv(opts: AgentArgvOptions): string[] {
    const argv: string[] = []
    argv.push(...splitArgs(opts.extraArgs ?? config.agentExtraArgs))
    argv.push('--model', resolveModel(opts.model))
    if (opts.resumeSessionId) {
        argv.push('--resume', opts.resumeSessionId)
    }
    // Prompt is the final positional argument — never concatenated into a shell.
    argv.push(opts.prompt)
    return argv
}

function agentEnv(): NodeJS.ProcessEnv {
    return {
        ...process.env,
        ANTHROPIC_API_KEY: config.anthropicApiKey,
    }
}

// ── streaming spawn (used by the run loop) ───────────────────────────────────

export interface SpawnAgentOptions extends AgentArgvOptions {
    cwd: string
}

/**
 * Spawn the agent for a single task. `detached: true` so the whole process
 * group can be killed on force-stop (§6.3). No `shell` — argv is an array.
 */
export function spawnAgent(opts: SpawnAgentOptions): ChildProcess {
    const argv = buildArgv(opts)
    return spawn(config.agentBin, argv, {
        cwd: opts.cwd,
        detached: true,
        env: agentEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
    })
}

// ── headless one-shot (task-creator §7, commit-message §6.15) ────────────────

export interface RunOnceOptions {
    cwd: string
    model: string
    prompt: string
    timeoutMs: number
    /** extra args, e.g. a different output mode for one-shot text capture */
    extraArgs?: string
    /** forwarded into the child env (e.g. a temp skills dir) */
    env?: Record<string, string>
}

export interface RunOnceResult {
    stdout: string
    stderr: string
    code: number | null
    timedOut: boolean
}

export function runAgentOnce(opts: RunOnceOptions): Promise<RunOnceResult> {
    return new Promise((resolve) => {
        const argv = buildArgv({ model: opts.model, prompt: opts.prompt, extraArgs: opts.extraArgs })
        const child = spawn(config.agentBin, argv, {
            cwd: opts.cwd,
            detached: true,
            env: { ...agentEnv(), ...(opts.env ?? {}) },
            stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stdout = ''
        let stderr = ''
        let timedOut = false
        child.stdout?.on('data', (d) => (stdout += d.toString()))
        child.stderr?.on('data', (d) => (stderr += d.toString()))
        const timer = setTimeout(() => {
            timedOut = true
            if (child.pid) {
                try {
                    process.kill(-child.pid, 'SIGKILL')
                } catch {
                    child.kill('SIGKILL')
                }
            }
        }, opts.timeoutMs)
        child.on('close', (code) => {
            clearTimeout(timer)
            resolve({ stdout, stderr, code, timedOut })
        })
        child.on('error', () => {
            clearTimeout(timer)
            resolve({ stdout, stderr, code: null, timedOut })
        })
    })
}
