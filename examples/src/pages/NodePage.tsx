import { Breadcrumbs, CategorySection, CodeBlock, ExampleGrid, InstallBlock, PackageIntro, SkillInstall } from './_chrome'
import { nodeExamples } from '../node/index'

const peerInstall = `# RouteHandler / HttpServer
npm install fastify @fastify/cors

# BaseRepository / EntityService
npm install kysely

# KVService
npm install redis @toolcase/serializer`

const subpathTable = `// One entrypoint — peers are optional, install only what you use
import {
    createAPISanitizer, NotFoundError, ValidationError, // utils + errors
    RouteHandler, HttpServer,                           // peers: fastify, @fastify/cors
    BaseRepository, EntityService,                      // peer:  kysely
    KVService,                                          // peers: redis, @toolcase/serializer
} from '@toolcase/node'`

export const NodePage = () => {
    return (
        <main className="site-container">
            <Breadcrumbs current="@toolcase/node" />
            <PackageIntro
                meta={{
                    pkg: '@toolcase/node',
                    name: 'node',
                    eyebrow: 'Library · Backend · Node',
                    tagline:
                        'Backend helpers — Fastify endpoints, Kysely repositories, Redis KV service, isomorphic sanitize / pagination / domain-error helpers. One entrypoint, peers are optional so you only pay for what you import.',
                    version: '1.0.0',
                    examples: nodeExamples.length,
                    chips: ['Fastify', 'Kysely', 'Redis', 'ESM + CJS'],
                }}
            />
            <InstallBlock pkg="@toolcase/node" />

            <div className="section-head">
                <h2>Peer dependencies</h2>
                <span className="count">install only what you use</span>
            </div>
            <CodeBlock file="install-peers.sh" code={peerInstall} />

            <div className="section-head">
                <h2>Imports</h2>
                <span className="count">single entrypoint</span>
            </div>
            <CodeBlock file="example.ts" code={subpathTable} />

            <SkillInstall slug="node" pkg="@toolcase/node" />

            <CategorySection title="Examples" count={nodeExamples.length}>
                <ExampleGrid
                    basePath="/node"
                    items={nodeExamples.map((e) => ({ key: e.key, label: e.label }))}
                />
            </CategorySection>
        </main>
    )
}
