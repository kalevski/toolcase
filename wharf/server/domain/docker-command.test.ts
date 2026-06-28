import { describe, it, expect } from 'vitest'
import { buildDockerCommand, type RenderOpts } from '@/server/domain/docker-command'
import type { DockerSpec } from '@/server/domain/types'

// A minimal-but-complete spec; tests tweak fields per case.
function baseSpec(over: Partial<DockerSpec> = {}): DockerSpec {
    return {
        image: 'nginx',
        tag: '1.27',
        containerName: 'web',
        detach: true,
        tty: false,
        removeOnExit: false,
        pull: 'missing',
        restart: 'unless-stopped',
        ports: [],
        volumes: [],
        envInline: [],
        envSource: 'none',
        labels: [],
        command: [],
        ...over,
    }
}

describe('buildDockerCommand — sh lifecycle (§7.2)', () => {
    it('run-only has `docker run` and no stop/rm', () => {
        const out = buildDockerCommand(baseSpec(), { lifecycle: 'run' })
        expect(out).toContain('docker run')
        expect(out).not.toContain('docker stop')
        expect(out).not.toContain('docker rm')
    })

    it('recreate emits stop + rm before run', () => {
        const out = buildDockerCommand(baseSpec(), { lifecycle: 'recreate' })
        expect(out).toContain('docker stop web 2>/dev/null || true')
        expect(out).toContain('docker rm   web 2>/dev/null || true')
        // ordering: stop, then rm, then run
        expect(out.indexOf('docker stop')).toBeLessThan(out.indexOf('docker rm'))
        expect(out.indexOf('docker rm')).toBeLessThan(out.indexOf('docker run'))
    })

    it('includeStop/includeRm=false suppress the respective lines', () => {
        const out = buildDockerCommand(baseSpec(), {
            lifecycle: 'recreate',
            includeStop: false,
            includeRm: false,
        })
        expect(out).not.toContain('docker stop')
        expect(out).not.toContain('docker rm')
        expect(out).toContain('docker run')
    })
})

describe('buildDockerCommand — flags (§7.2)', () => {
    it('renders ports and volumes', () => {
        const out = buildDockerCommand(
            baseSpec({
                ports: [
                    { host: 8080, container: 80, protocol: 'tcp' },
                    { host: 5353, container: 53, protocol: 'udp' },
                ],
                volumes: [{ host: '/data', container: '/var/lib', mode: 'rw' }],
            }),
            { lifecycle: 'run' },
        )
        expect(out).toContain('-p 8080:80')
        expect(out).toContain('-p 5353:53/udp')
        expect(out).toContain('-v /data:/var/lib:rw')
    })

    it('emits -d/-t/--rm, --restart and conditional --pull', () => {
        const out = buildDockerCommand(
            baseSpec({ tty: true, removeOnExit: true, pull: 'always' }),
            { lifecycle: 'run' },
        )
        expect(out).toContain('-d')
        expect(out).toContain('-t')
        expect(out).toContain('--rm')
        expect(out).toContain('--restart unless-stopped')
        expect(out).toContain('--pull always')
    })

    it('omits --pull for the default `missing` value', () => {
        const out = buildDockerCommand(baseSpec({ pull: 'missing' }), { lifecycle: 'run' })
        expect(out).not.toContain('--pull')
    })

    it('shell-escapes values containing spaces', () => {
        const out = buildDockerCommand(
            baseSpec({
                envInline: [{ key: 'GREETING', value: 'hello world' }],
                labels: [{ key: 'com.example.desc', value: "it's mine" }],
            }),
            { lifecycle: 'run' },
        )
        expect(out).toContain("-e GREETING='hello world'")
        // embedded single quote escaped via the '"'"' trick
        expect(out).toContain(`-l com.example.desc='it'"'"'s mine'`)
    })

    it('renders image:tag and command args', () => {
        const out = buildDockerCommand(
            baseSpec({ command: ['nginx', '-g', 'daemon off;'] }),
            { lifecycle: 'run' },
        )
        expect(out).toContain('nginx:1.27')
        expect(out).toContain("'daemon off;'")
    })
})

describe('buildDockerCommand — env injection (§7.3, §6.4)', () => {
    it("'none' inlines only envInline", () => {
        const out = buildDockerCommand(
            baseSpec({ envInline: [{ key: 'FOO', value: 'bar' }] }),
            { lifecycle: 'run' },
        )
        expect(out).toContain('-e FOO=bar')
        expect(out).not.toContain('WHARF_URL')
    })

    it("'wharf' injects WHARF_* + install.sh entrypoint and inlines no secret", () => {
        const out = buildDockerCommand(
            baseSpec({ envSource: 'wharf', command: ['node', 'server.js'] }),
            {
                lifecycle: 'run',
                instance: { id: 'inst-1', environmentName: 'prod' },
                agentBaseUrl: 'http://agent:4000',
            },
        )
        expect(out).toContain('-e WHARF_URL=http://agent:4000')
        expect(out).toContain('-e WHARF_ENVIRONMENT=prod')
        expect(out).toContain('-e WHARF_INSTANCE_ID=inst-1')
        expect(out).toContain('--entrypoint sh')
        expect(out).toContain('install.sh')
        expect(out).toContain('exec -- node server.js')
        // never inline the secret value
        expect(out).not.toContain('-e WHARF_SECRET=')
    })

    it("'wharf' uses the default agent URL when none supplied", () => {
        const out = buildDockerCommand(baseSpec({ envSource: 'wharf' }), {
            lifecycle: 'run',
            instance: { id: 'i', environmentName: 'dev' },
        })
        expect(out).toContain('-e WHARF_URL=http://wharf-agent:4000')
    })

    it("'wharf' without an instance throws", () => {
        expect(() =>
            buildDockerCommand(baseSpec({ envSource: 'wharf' }), { lifecycle: 'run' }),
        ).toThrow(/envSource wharf requires an instance/)
    })

    it("'instance' inlines the resolved instance env (real values)", () => {
        const out = buildDockerCommand(baseSpec({ envSource: 'instance' }), {
            lifecycle: 'run',
            instance: { id: 'i', environmentName: 'dev' },
            instanceEnv: [{ key: 'DB_PASS', value: 's3cr3t' }],
        })
        expect(out).toContain('-e DB_PASS=s3cr3t')
        expect(out).toContain('# WARNING: real secret values are inlined')
    })

    it("'instance' without instanceEnv throws", () => {
        expect(() =>
            buildDockerCommand(baseSpec({ envSource: 'instance' }), {
                lifecycle: 'run',
                instance: { id: 'i', environmentName: 'dev' },
            }),
        ).toThrow(/requires an instance and instanceEnv/)
    })
})

describe('buildDockerCommand — compose format (§7.2)', () => {
    it('emits an image: line and the service block', () => {
        const out = buildDockerCommand(
            baseSpec({
                ports: [{ host: 8080, container: 80, protocol: 'tcp' }],
                volumes: [{ host: '/d', container: '/c', mode: 'ro' }],
            }),
            { lifecycle: 'run', format: 'compose' },
        )
        expect(out).toContain('image: nginx:1.27')
        expect(out).toContain('container_name: web')
        expect(out).toContain('- "8080:80"')
        expect(out).toContain('- "/d:/c:ro"')
    })

    it('compose wharf injects WHARF_* without the secret', () => {
        const out = buildDockerCommand(baseSpec({ envSource: 'wharf' }), {
            lifecycle: 'run',
            format: 'compose',
            instance: { id: 'i9', environmentName: 'staging' },
        })
        expect(out).toContain('WHARF_INSTANCE_ID: i9')
        expect(out).toContain('WHARF_ENVIRONMENT: staging')
        expect(out).not.toContain('WHARF_SECRET')
    })
})
