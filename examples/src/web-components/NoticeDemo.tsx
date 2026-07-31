import React, { useState } from 'react'

// Five of the twelve JADI.mk phone screens carry a notice; `1h` carries the banner.
// 390px is the width they were composed at.
const phone: React.CSSProperties = {
    width: '390px',
    maxWidth: '100%',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    background: 'var(--sun-bg-2, var(--tc-surface-hover))',
    border: '1px solid var(--tc-border)',
}

const label: React.CSSProperties = { fontWeight: 700, marginBottom: '0.5rem' }

const note: React.CSSProperties = {
    padding: '10px 0',
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
}

// ── The four the design actually draws ────────────────────────────────────────

const DesignExample: React.FC = () => (
    <div>
        <div style={label}>The design's own four</div>
        <div style={phone}>
            {/* 1e — the cooking tip. size="lg": read at arm's length from a counter. */}
            <tc-notice
                tone="accent"
                size="lg"
                label="Совет"
                text="Тетовскиот грав бара долго потопување — водата треба да го покрие за два прста."
            />
            {/* 1f — comments held for moderation. */}
            <tc-notice tone="info" text="Коментарите се објавуваат по одобрување од модератор." />
            {/* 1i — the medical disclaimer. */}
            <tc-notice
                tone="muted"
                text="Пресметките се проценка и не заменуваат медицински совет."
            />
            {/* 1k — the payment notice. */}
            <tc-notice
                tone="warning"
                text="Плаќањето се договара директно со нутриционистот. Платформата не обработува плаќања."
            />
        </div>
        <div style={note}>
            Each fill is `color-mix(in srgb, &lt;tone&gt; N%, transparent)`, which IS the hue at
            alpha N — so every wash here is bit-exact against the design's own rgba() while staying
            one value away from a re-skin.
        </div>
    </div>
)

// ── All six tones ─────────────────────────────────────────────────────────────

const TONES = [
    ['info', '#9c4a7a · 8%', 'Коментарите се објавуваат по одобрување од модератор.'],
    ['muted', '#9aa189 · 12%', 'Сите бројки ги пресметува платформата — ништо не е самопријавено.'],
    ['warning', '#d49a00 · 12%', 'Платформата не обработува плаќања.'],
    ['accent', '#a4472f · 7%', 'Солете дури на крај — солта во почеток ја стврднува лушпата.'],
    ['success', '#5f8a2e · 12%', 'Планот е зачуван и испратен на клиентот.'],
    ['danger', '#f2604b · 14%', 'Не успеавме да ја зачуваме листата. Обидете се повторно.'],
] as const

const TonesExample: React.FC = () => (
    <div>
        <div style={label}>Six tones</div>
        <div style={phone}>
            {TONES.map(([tone, hue, text]) => (
                <tc-notice key={tone} tone={tone} label={hue} text={text} />
            ))}
        </div>
        <div style={note}>
            `success` and `danger` are not drawn in the design — completed from the system's own
            semantics, with the deeper leaf / hard error red so 11px prose clears 4.5:1 on its own
            wash.
        </div>
    </div>
)

// ── 1h's offline banner ───────────────────────────────────────────────────────

const BannerExample: React.FC = () => {
    const [offline, setOffline] = useState(true)
    return (
        <div>
            <div style={label}>1h — the offline strip · variant="banner"</div>
            <div
                style={{
                    width: '390px',
                    maxWidth: '100%',
                    border: '1px solid var(--tc-border)',
                    background: 'var(--sun-bg-2, var(--tc-surface-hover))',
                }}
            >
                <tc-app-bar
                    variant="back"
                    heading="Пазар за среда"
                    subheading="3 од 7 купено"
                    back-label="Назад"
                    elevated
                />
                {/* A SIBLING of the bar, not in its `below` region — see the note. */}
                {offline && (
                    <tc-notice
                        tone="warning"
                        variant="banner"
                        live
                        icon="wifi-off"
                        text="Нема интернет — вашите штиклирања се зачувани на телефонот"
                    />
                )}
                <div style={{ padding: '14px', fontSize: '0.8125rem' }}>
                    <button
                        className="btn btn-sm btn-outline-secondary"
                        type="button"
                        onClick={() => setOffline((v) => !v)}
                    >
                        {offline ? 'Врати интернет' : 'Симулирај offline'}
                    </button>
                </div>
            </div>
            <div style={note}>
                The banner drops the rule and the radius and takes a bottom hairline at 30% of its
                own hue, which for `warning` is exactly the design's rgba(212,154,0,.3). `live`
                makes it a `role="status"` — a screen-reader user who cannot see the strip appear is
                the one who most needs to be told the app went offline.
            </div>
            <div style={note}>
                It is a <strong>sibling</strong> of the app bar, which is how screen `1h` draws it:
                the bar's <code>below</code> region is a 100% flex basis of the bar's{' '}
                <em>content</em> box, so a banner placed there is inset by the bar's 14px gutter and
                sits above its bottom rule instead of below it. Full-bleed is the whole point of the
                variant.
            </div>
        </div>
    )
}

// ── tc-notice vs tc-alert ─────────────────────────────────────────────────────

const VsAlertExample: React.FC = () => (
    <div>
        <div style={label}>tc-notice is not tc-alert</div>
        <div style={{ ...phone, gap: '14px' }}>
            <tc-alert variant="success" dismissible>
                Листата е зачувана.
            </tc-alert>
            <tc-notice tone="muted" text="Листите се чуваат локално додека нема интернет." />
        </div>
        <div style={note}>
            An ALERT announces something that just happened and is meant to be read and closed — it
            has a heading, a dismiss button and a lifecycle. A NOTICE is permanent explanatory prose
            belonging to the surface it sits on: no heading, no dismiss, no state. If it can be
            closed, it is an alert.
        </div>
    </div>
)

const NoticeDemo: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <DesignExample />
        <TonesExample />
        <BannerExample />
        <VsAlertExample />
    </div>
)

export default NoticeDemo
