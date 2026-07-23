import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const sampleCommands = [
    {
        name: 'init',
        usage: 'init [directory]',
        description:
            'Initialise a new project in the given directory, or the current directory if omitted.',
        aliases: ['i', 'create'],
        flags: [
            {
                flag: '--template <name>',
                description: 'Starter template to use (default: "blank").',
            },
            { flag: '--yes', description: 'Skip prompts and accept all defaults.' },
            { flag: '--typescript', description: 'Generate TypeScript configuration files.' },
        ],
    },
    {
        name: 'build',
        usage: 'build [options]',
        description: 'Compile and bundle the project for production.',
        aliases: ['b'],
        flags: [
            { flag: '--watch', description: 'Rebuild on file changes.' },
            {
                flag: '--minify',
                description: 'Enable output minification (default: true in production).',
            },
            { flag: '--out-dir <path>', description: 'Override the output directory.' },
            { flag: '--sourcemap', description: 'Emit source maps alongside the bundle.' },
        ],
    },
    {
        name: 'dev',
        usage: 'dev [port]',
        description: 'Start the development server with HMR.',
        flags: [
            { flag: '--port <number>', description: 'Port to listen on (default: 5173).' },
            { flag: '--host', description: 'Expose the server on the local network.' },
            { flag: '--open', description: 'Open the browser automatically on start.' },
        ],
    },
    {
        name: 'lint',
        usage: 'lint [files...]',
        description:
            'Run the linter on source files. Exits with a non-zero code if issues are found.',
        aliases: ['check'],
        flags: [
            { flag: '--fix', description: 'Auto-fix fixable issues.' },
            { flag: '--quiet', description: 'Report errors only, suppress warnings.' },
        ],
    },
    {
        name: 'test',
        usage: 'test [pattern]',
        description:
            'Execute the test suite. An optional glob pattern narrows which files are run.',
        aliases: ['t', 'vitest'],
        flags: [
            { flag: '--watch', description: 'Re-run tests on file changes.' },
            { flag: '--coverage', description: 'Collect and report code coverage.' },
            { flag: '--reporter <name>', description: 'Output reporter (dot, verbose, json).' },
        ],
    },
    {
        name: 'publish',
        usage: 'publish [version]',
        description: 'Bump the version, build, and publish to the registry.',
        flags: [
            { flag: '--tag <tag>', description: 'NPM dist-tag (default: "latest").' },
            { flag: '--dry-run', description: 'Run all steps without actually publishing.' },
            { flag: '--access <public|restricted>', description: 'Package access level.' },
        ],
    },
]

const minimalCommands = [
    {
        name: 'help',
        description: 'Display usage information for a command.',
    },
    {
        name: 'version',
        description: 'Print the current CLI version.',
        aliases: ['--version', '-v'],
    },
]

const CommandReferenceDemo: React.FC = () => {
    const fullRef = useTc<HTMLElement>({ commands: sampleCommands })
    const noSearchRef = useTc<HTMLElement>({ commands: sampleCommands })
    const titledRef = useTc<HTMLElement>({ commands: sampleCommands })
    const slottedRef = useTc<HTMLElement>({ commands: minimalCommands })
    const minimalRef = useTc<HTMLElement>({ commands: minimalCommands })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="CommandReference"
                            description="Searchable reference guide for commands with usage, descriptions, flags, and aliases. Filters results by name, description, aliases, and flag text."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Full — searchable with flags and aliases">
                                {/* @ts-ignore */}
                                <tc-command-reference
                                    ref={fullRef}
                                    search-placeholder="Filter commands…"
                                />
                            </tc-section-card>

                            <tc-section-card title="Non-searchable (searchable=false)">
                                {/* @ts-ignore */}
                                <tc-command-reference ref={noSearchRef} searchable="false" />
                            </tc-section-card>

                            <tc-section-card title="With title attribute">
                                {/* @ts-ignore */}
                                <tc-command-reference
                                    ref={titledRef}
                                    title="CLI Reference"
                                    search-placeholder="Search commands…"
                                />
                            </tc-section-card>

                            <tc-section-card title="With slotted title (React node)">
                                {/* @ts-ignore */}
                                <tc-command-reference ref={slottedRef}>
                                    <span
                                        style={{
                                            fontFamily: 'var(--tc-font-mono)',
                                            fontSize: '0.9375rem',
                                            fontWeight: 600,
                                        }}
                                    >
                                        my-cli{' '}
                                        <span
                                            style={{
                                                color: 'var(--tc-text-muted)',
                                                fontWeight: 400,
                                            }}
                                        >
                                            — command reference
                                        </span>
                                    </span>
                                </tc-command-reference>
                            </tc-section-card>

                            <tc-section-card title="Minimal commands (no flags, some aliases)">
                                {/* @ts-ignore */}
                                <tc-command-reference ref={minimalRef} title="Quick Reference" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CommandReferenceDemo
