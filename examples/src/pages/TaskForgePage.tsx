import { Link as RouterLink } from 'react-router'
import { CodeBlock, CopyLine } from './_chrome'

const archDiagram = `GitHub OAuth ──► TaskForge (Next.js, single process)
                        │
                        │ per-project queue of *.md task files
                        ▼
                 execution engine ──spawns──► claude CLI ──edits──► repo/ (git)
                        │                          │
                        │ live stdout             commit · push
                        ▼                          │
                   SSE stream ──────────────────► browser UI`

const fsContract = `/workspace
├── projects/<name>/
│   ├── repo/            managed git repository (cloned from a git URL)
│   ├── tasks/           *.md task files + .status + logs/ (hourly-rotated)
│   ├── knowledge/       durable project notes the agent reads/writes
│   ├── CLAUDE.md        project-root instructions for the agent
│   └── .claude/skills   symlink → bundled app skills (read-only)
├── skills/<skill>/      user-level skills
└── .auth/roles.json     GitHub user → role map`

const envExample = `# required — GitHub OAuth2 + session signing
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
AUTH_SECRET=...                  # random secret for session cookies

# the claude CLI authenticates itself — no API key env

# git push needs a container-level credential (NOT the OAuth login):
GIT_REMOTE_TOKEN=...             # HTTPS, GitHub scope: repo
# …or a mounted SSH deploy key with GIT_SSH_CONFIGURED=1`

const features = [
    {
        title: 'Project-centric workspace',
        body: 'Each project bundles its git repo, a task queue, and a knowledge store under /workspace/projects/<name>. The agent runs at the project root, so every path it touches stays inside the sandbox. Create a project by cloning a git URL.',
    },
    {
        title: 'One task at a time, streamed live',
        body: 'The engine runs claude over queued *.md task files sequentially, streaming stdout to the browser over Server-Sent Events. Logs rotate hourly on disk; the UI reconnects to the live run.',
    },
    {
        title: 'Survives the usage wall',
        body: 'When claude hits a usage-limit reset, the engine sleeps until the window reopens and resumes — no lost queue. Transient failures retry; runs can be stopped gracefully or forced.',
    },
    {
        title: 'GitHub OAuth + roles',
        body: 'Auth is GitHub OAuth2. The first user to sign in becomes admin; everyone else lands as guest until promoted. A thin edge middleware gates routes; the full verify happens in the Node layer.',
    },
    {
        title: 'Git built in',
        body: 'Branch, commit, and push straight from the UI. Push requires a container-level credential — GIT_REMOTE_TOKEN or a mounted SSH deploy key — deliberately decoupled from the OAuth login.',
    },
    {
        title: 'Database-free',
        body: 'All durable state lives on the filesystem under WORKSPACE_DIR. Ships read-only app skills the agent uses: task-creator, knowledge-writer, commit-message.',
    },
]

export const TaskForgePage = () => {
    return (
        <main className="site-container">
            <div className="breadcrumbs">
                <RouterLink to="/apps">Apps</RouterLink>
                <span className="sep">/</span>
                <span className="current mono">taskforge</span>
            </div>

            <section className="page-intro">
                <div>
                    <div className="eyebrow">App · Next.js · Claude Code</div>
                    <h1 className="page-title mono">TaskForge</h1>
                    <p className="page-lead">
                        A self-hosted, single-process Next.js control panel that drives the Claude Code
                        CLI over a set of local git repositories. Each project has a queue of Markdown
                        task files; TaskForge runs <code>claude</code> over them one at a time, streams
                        the output live, survives usage-limit walls, retries transient failures, and
                        can commit and push the result.
                    </p>
                    <div className="chip-row">
                        {['Next.js 14', 'Claude Code CLI', 'GitHub OAuth', 'SSE', 'Docker', 'database-free', '@toolcase/react-components'].map((chip) => (
                            <span key={chip} className="tag">{chip}</span>
                        ))}
                    </div>
                </div>
                <dl className="page-meta">
                    <div>
                        <dt>Framework</dt>
                        <dd>Next.js 14</dd>
                    </div>
                    <div>
                        <dt>Durable state</dt>
                        <dd>Filesystem</dd>
                    </div>
                    <div>
                        <dt>Auth</dt>
                        <dd>GitHub OAuth2</dd>
                    </div>
                    <div>
                        <dt>License</dt>
                        <dd>MIT</dd>
                    </div>
                </dl>
            </section>

            <div className="section-head">
                <h2>How it works</h2>
                <span className="count">queue → claude → stream → commit</span>
            </div>
            <CodeBlock file="architecture" code={archDiagram} />

            <div className="lib-grid">
                {features.map((f) => (
                    <div key={f.title} className="lib-card">
                        <div className="lib-card-head">
                            <div>
                                <h3 className="lib-name">{f.title}</h3>
                                <p className="lib-tagline">{f.body}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="section-head">
                <h2>Filesystem contract</h2>
                <span className="count">no database — state on disk under WORKSPACE_DIR</span>
            </div>
            <CodeBlock file="/workspace" code={fsContract} />

            <div className="section-head">
                <h2>Configuration</h2>
                <span className="count">GitHub OAuth + session secret; claude CLI self-authenticates</span>
            </div>
            <CodeBlock file=".env" code={envExample} />

            <div className="section-head">
                <h2>Run it</h2>
                <span className="count">Docker, or local dev</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
                <CopyLine cmd="cp .env.example .env   # fill in GitHub OAuth + AUTH_SECRET" />
                <CopyLine cmd="docker compose up --build" />
                <CopyLine cmd="npm install && npm run dev   # local dev on http://localhost:3000" />
            </div>

            <div className="section-head">
                <h2>Source</h2>
                <span className="count">lives in the toolcase monorepo</span>
            </div>
            <div className="lib-grid">
                <a
                    href="https://github.com/kalevski/toolcase/tree/main/taskforge"
                    target="_blank"
                    rel="noreferrer"
                    className="lib-card"
                >
                    <div className="lib-card-head">
                        <div>
                            <h3 className="lib-name">kalevski/toolcase</h3>
                            <p className="lib-tagline">taskforge/ — Next.js app, engine, README, Dockerfile, bundled skills</p>
                        </div>
                        <span className="lib-arrow">→</span>
                    </div>
                </a>
            </div>
        </main>
    )
}
