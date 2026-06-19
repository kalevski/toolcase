import React, { useEffect, useRef, useState } from 'react'

// tc-data-list is the generic, data-driven row list. Domain rendering lives at
// the call site via the `renderRow` hook — the four examples below reproduce the
// former tc-mute-list / tc-team-list / tc-credits-list / tc-achievement-list
// purely as renderRow functions over a single shared element.

function esc(s: unknown): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function deriveInitials(name: string): string {
    const w = name.trim().split(/\s+/).filter(Boolean)
    if (w.length === 0) return '?'
    if (w.length === 1) return w[0][0].toUpperCase()
    return (w[0][0] + w[1][0]).toUpperCase()
}

const MUTED = [
    { id: '1', name: 'ToxicWizard92', reason: 'Spam', mutedAt: '2d ago' },
    { id: '2', name: 'ChatBot_AFK', mutedAt: '1w ago' },
    { id: '3', name: 'Griefer404', reason: 'Harassment', mutedAt: '1mo ago' },
]

const TEAM = [
    { id: '1', name: 'Kate Moore', email: 'kate@example.com', role: 'Lead' },
    { id: '2', name: 'Liam Scott', initials: 'LS', email: 'liam@example.com', role: 'Backend' },
    {
        id: '3',
        name: 'Mia Chen',
        email: 'mia@example.com',
        avatarUrl: 'https://i.pravatar.cc/64?img=9',
        role: 'Frontend',
    },
    { id: '4', name: 'Noah Patel', email: 'noah@example.com', role: 'DevOps' },
]

const CREDITS = [
    { role: 'Game Director', names: ['Mira Calloway'] },
    { role: 'Lead Engineering', names: ['Tomas Reyes', 'Aiko Nakamura'] },
    { role: 'Art & Animation', names: ['Priya Anand', 'Lukas Berg', 'Sofia Marek'] },
    { role: 'Sound Design', names: ['Daniel Cho'] },
]

const ACHIEVEMENTS = [
    {
        id: 'first-blood',
        name: 'First Blood',
        description: 'Defeat your first enemy.',
        unlocked: true,
        points: 10,
    },
    {
        id: 'explorer',
        name: 'Explorer',
        description: 'Discover 25 hidden locations.',
        progress: 18,
        target: 25,
        points: 50,
    },
    {
        id: 'collector',
        name: 'Collector',
        description: 'Gather every rare artifact.',
        progress: 7,
        target: 40,
        points: 100,
    },
    {
        id: 'untouchable',
        name: 'Untouchable',
        description: 'Finish a boss without taking damage.',
        unlocked: false,
        points: 75,
    },
]

const STATUS_COLOR: Record<string, string> = {
    'in-game': '#a855f7',
    online: '#16a34a',
    busy: '#dc2626',
    away: '#d97706',
    offline: 'var(--tc-border-strong)',
}
const STATUS_ORDER = ['in-game', 'online', 'busy', 'away', 'offline']

const FRIENDS = [
    { id: '1', name: 'Aria', status: 'online' },
    { id: '2', name: 'Kestrel', status: 'in-game', activity: 'Ranked — Round 3' },
    { id: '3', name: 'Vesper', status: 'busy', activity: 'Do not disturb' },
    { id: '4', name: 'Lumen', status: 'away', activity: 'Idle 12m', rank: 'Gold' },
    { id: '5', name: 'Onyx', status: 'offline' },
].sort((a, b) => {
    const d = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    return d !== 0 ? d : a.name.localeCompare(b.name)
})

const SLOTS = [
    { id: 'auto', name: 'Auto Save', meta: 'Lv 24 · Ember Keep · 12h 04m', autosave: true },
    { id: 's1', name: 'The Long Road', meta: 'Lv 22 · Vale of Mist · 11h 02m' },
    { id: 's2', name: 'Before the Boss', meta: 'Lv 19 · Catacombs · 8h 41m' },
    { id: 's3', empty: true },
]

// ── renderRow hooks ──────────────────────────────────────────────────────────

const renderMuted = (p: any) =>
    `<li class="tc-data-list__row" data-id="${esc(p.id)}" role="listitem">` +
    `<div class="tc-data-list__text">` +
    `<span class="tc-data-list__primary">${esc(p.name)}</span>` +
    (p.reason ? `<span class="tc-data-list__secondary">${esc(p.reason)}</span>` : '') +
    `</div>` +
    (p.mutedAt ? `<span class="tc-data-list__trailing">${esc(p.mutedAt)}</span>` : '') +
    `<button type="button" class="tc-data-list__action" data-action="unmute">Unmute</button>` +
    `</li>`

const renderMember = (m: any) => {
    const avatar = m.avatarUrl
        ? `<img src="${esc(m.avatarUrl)}" alt="${esc(m.name)}" style="width:2.25rem;height:2.25rem;border-radius:50%;object-fit:cover;flex-shrink:0;" />`
        : `<span aria-hidden="true" style="width:2.25rem;height:2.25rem;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:600;color:#fff;background:linear-gradient(135deg,var(--tc-app-accent),#2b3a51);flex-shrink:0;">${esc(m.initials ?? deriveInitials(m.name))}</span>`
    return (
        `<li class="tc-data-list__row" data-id="${esc(m.id)}" role="listitem">` +
        avatar +
        `<div class="tc-data-list__text">` +
        `<span class="tc-data-list__primary">${esc(m.name)}</span>` +
        (m.email ? `<span class="tc-data-list__secondary">${esc(m.email)}</span>` : '') +
        `</div>` +
        (m.role ? `<span class="tc-data-list__trailing">${esc(m.role)}</span>` : '') +
        `</li>`
    )
}

const renderCredit = (s: any) =>
    `<li class="tc-data-list__row" data-id="${esc(s.role)}" role="listitem" style="align-items:flex-start;">` +
    `<div class="tc-data-list__text">` +
    `<span class="tc-data-list__trailing" style="text-transform:uppercase;letter-spacing:.05em;">${esc(s.role)}</span>` +
    (s.names as string[])
        .map((n) => `<span class="tc-data-list__primary">${esc(n)}</span>`)
        .join('') +
    `</div>` +
    `</li>`

const renderAchievement = (a: any) => {
    const hasProgress = !a.unlocked && typeof a.target === 'number'
    const pct = hasProgress ? Math.min(100, Math.round((a.progress / a.target) * 100)) : 0
    const dot = `<span aria-hidden="true" style="width:.625rem;height:.625rem;flex-shrink:0;margin-top:.375rem;background:${a.unlocked ? 'var(--tc-success,#16a34a)' : 'var(--tc-border-strong)'};"></span>`
    const progress = hasProgress
        ? `<div style="margin-top:.375rem;height:4px;background:var(--tc-surface-muted);"><div style="height:100%;width:${pct}%;background:var(--tc-app-accent);"></div></div>` +
          `<span class="tc-data-list__secondary">${a.progress}/${a.target}</span>`
        : ''
    return (
        `<li class="tc-data-list__row" data-id="${esc(a.id)}" role="listitem" style="align-items:flex-start;">` +
        dot +
        `<div class="tc-data-list__text">` +
        `<span class="tc-data-list__primary">${esc(a.name)}</span>` +
        (a.description
            ? `<span class="tc-data-list__secondary">${esc(a.description)}</span>`
            : '') +
        progress +
        `</div>` +
        (typeof a.points === 'number'
            ? `<span class="tc-data-list__trailing">${a.points} pts</span>`
            : '') +
        `</li>`
    )
}

const renderFriend = (f: any) => {
    const color = STATUS_COLOR[f.status] ?? STATUS_COLOR.offline
    const activity = f.activity ?? (f.status === 'offline' ? 'Offline' : '')
    return (
        `<li class="tc-data-list__row" data-id="${esc(f.id)}" role="listitem">` +
        `<span aria-hidden="true" title="${esc(f.status)}" style="width:.5rem;height:.5rem;border-radius:50%;flex-shrink:0;background:${color};"></span>` +
        `<div class="tc-data-list__text">` +
        `<span class="tc-data-list__primary">${esc(f.name)}</span>` +
        (activity ? `<span class="tc-data-list__secondary">${esc(activity)}</span>` : '') +
        `</div>` +
        (f.rank ? `<span class="tc-data-list__trailing">${esc(f.rank)}</span>` : '') +
        `<button type="button" class="tc-data-list__action" data-action="message" aria-label="Message ${esc(f.name)}">Msg</button>` +
        `<button type="button" class="tc-data-list__action" data-action="invite" aria-label="Invite ${esc(f.name)}">Invite</button>` +
        `</li>`
    )
}

// Selectable (listbox) row — note role="option" + tabindex so keyboard select works.
const renderSlot = (s: any) => {
    const primary = s.empty
        ? `<span class="tc-data-list__primary" style="color:var(--tc-text-faint);font-style:italic;">Empty Slot</span>`
        : `<span class="tc-data-list__primary">${esc(s.name)}</span>`
    const meta = s.meta ? `<span class="tc-data-list__secondary">${esc(s.meta)}</span>` : ''
    const actions = s.empty
        ? ''
        : `<button type="button" class="tc-data-list__action" data-action="load">Load</button>` +
          (s.autosave
              ? ''
              : `<button type="button" class="tc-data-list__action" data-action="delete">Delete</button>`)
    return (
        `<li class="tc-data-list__row" data-id="${esc(s.id)}" role="option" tabindex="0" aria-selected="false">` +
        `<div class="tc-data-list__text">` +
        primary +
        meta +
        `</div>` +
        (s.autosave ? `<span class="tc-data-list__trailing">Auto</span>` : '') +
        actions +
        `</li>`
    )
}

const DataListDemo: React.FC = () => {
    const muteRef = useRef<any>(null)
    const teamRef = useRef<any>(null)
    const creditsRef = useRef<any>(null)
    const achRef = useRef<any>(null)
    const friendsRef = useRef<any>(null)
    const slotsRef = useRef<any>(null)
    const emptyRef = useRef<any>(null)
    const [log, setLog] = useState<string[]>([])
    const [slotLog, setSlotLog] = useState<string[]>([])

    useEffect(() => {
        if (muteRef.current) {
            muteRef.current.renderRow = renderMuted
            muteRef.current.items = MUTED
            const handler = (e: any) =>
                setLog((l) =>
                    [`tc-action — action: "${e.detail.action}", id: "${e.detail.id}"`, ...l].slice(
                        0,
                        8,
                    ),
                )
            muteRef.current.addEventListener('tc-action', handler)
            return () => muteRef.current?.removeEventListener('tc-action', handler)
        }
    }, [])

    useEffect(() => {
        if (teamRef.current) {
            teamRef.current.renderRow = renderMember
            teamRef.current.items = TEAM
        }
    }, [])

    useEffect(() => {
        if (creditsRef.current) {
            creditsRef.current.renderRow = renderCredit
            creditsRef.current.items = CREDITS
        }
    }, [])

    useEffect(() => {
        if (achRef.current) {
            achRef.current.renderRow = renderAchievement
            achRef.current.items = ACHIEVEMENTS
        }
    }, [])

    useEffect(() => {
        const el = friendsRef.current
        if (!el) return
        const online = FRIENDS.filter((f) => f.status !== 'offline').length
        el.setAttribute('list-title', `Friends · ${online}/${FRIENDS.length}`)
        el.renderRow = renderFriend
        el.items = FRIENDS
    }, [])

    useEffect(() => {
        const el = slotsRef.current
        if (!el) return
        el.renderRow = renderSlot
        el.items = SLOTS
        const onAction = (e: any) =>
            setSlotLog((l) =>
                [`tc-action — "${e.detail.action}" id="${e.detail.id}"`, ...l].slice(0, 8),
            )
        const onSelect = (e: any) =>
            setSlotLog((l) => [`tc-select — id="${e.detail.id}"`, ...l].slice(0, 8))
        el.addEventListener('tc-action', onAction)
        el.addEventListener('tc-select', onSelect)
        return () => {
            el.removeEventListener('tc-action', onAction)
            el.removeEventListener('tc-select', onSelect)
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="DataList"
                            description="Generic data-driven row list. Assign items (array) plus a renderRow(item, index) hook returning each row's markup. Per-row buttons marked data-action fire tc-action with { action, id }; selectable mode adds listbox selection via tc-select. The four examples below reproduce the former mute / team / credits / achievement lists with no bespoke element."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Muted players — per-row action (tc-action)">
                                {/* @ts-ignore */}
                                <tc-data-list
                                    ref={muteRef}
                                    empty-text="No muted players."
                                    style={{ maxWidth: '480px' }}
                                />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">Click Unmute…</span>
                                    ) : (
                                        <ul className="mb-0">
                                            {log.map((line, i) => (
                                                <li key={i}>
                                                    <code>{line}</code>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Team members — avatars, emails, role chips">
                                {/* @ts-ignore */}
                                <tc-data-list ref={teamRef} style={{ maxWidth: '480px' }} />
                            </tc-section-card>

                            <tc-section-card title="Credits — grouped sections via renderRow">
                                {/* @ts-ignore */}
                                <tc-data-list
                                    ref={creditsRef}
                                    list-title="Credits"
                                    style={{ maxWidth: '480px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Achievements — progress bars + points trailing">
                                {/* @ts-ignore */}
                                <tc-data-list ref={achRef} style={{ maxWidth: '560px' }} />
                            </tc-section-card>

                            <tc-section-card title="Friends roster — status pips, count header, sorted, two actions">
                                {/* @ts-ignore */}
                                <tc-data-list ref={friendsRef} style={{ maxWidth: '440px' }} />
                            </tc-section-card>

                            <tc-section-card title="Save slots — selectable listbox + per-row actions (tc-select / tc-action)">
                                {/* @ts-ignore */}
                                <tc-data-list
                                    ref={slotsRef}
                                    selectable
                                    selected-id="s1"
                                    style={{ maxWidth: '560px' }}
                                />
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {slotLog.length === 0 ? (
                                        <span className="text-muted">
                                            Select a slot or click an action…
                                        </span>
                                    ) : (
                                        <ul className="mb-0 ps-0 list-unstyled">
                                            {slotLog.map((line, i) => (
                                                <li key={i}>
                                                    <code>{line}</code>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Empty state (empty-text)">
                                {/* @ts-ignore */}
                                <tc-data-list
                                    ref={emptyRef}
                                    empty-text="Nothing to show yet."
                                    style={{ maxWidth: '480px' }}
                                />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DataListDemo
