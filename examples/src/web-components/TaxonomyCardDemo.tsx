import React, { useEffect, useRef, useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

// Screens `1b` („Дома"), `1c` („Рецепти"), `1f` („Истражи") and `1g` („Филтри") of the
// JADI.mk phone design, at the width they were composed: 390px. Every hue, title and
// number below is the design's own.
const phone: React.CSSProperties = {
    width: '390px',
    maxWidth: '100%',
    padding: '12px 14px',
    background: 'var(--sun-bg-2, var(--tc-surface-hover))',
    border: '1px solid var(--tc-border)',
    display: 'flex',
    flexDirection: 'column',
    // --m-gap-stack — cards in a scrolling list (1c, 1f)
    gap: 'var(--m-gap-stack, 11px)',
}

const label: React.CSSProperties = { fontWeight: 700, marginBottom: '0.5rem' }

const note: React.CSSProperties = {
    padding: '10px 0',
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
}

const eyebrow: React.CSSProperties = {
    font: 'var(--m-font-eyebrow-lg, 700 10px var(--m-body))',
    letterSpacing: 'var(--m-track-eyebrow, 0.13em)',
    textTransform: 'uppercase',
    color: '#a4472f',
    marginBottom: '9px',
}

// The chip row is the CONSUMER's — the card lays it out, it does not build it. These are
// the design's three chip shapes (season fill, plain, dietary tint) at --m-pad-chip.
const chipBase: React.CSSProperties = {
    borderRadius: 'var(--m-radius-pill, 999px)',
    padding: 'var(--m-pad-chip, 3px 9px)',
    font: 'var(--m-font-chip, 400 10px var(--m-body))',
}
const chip: React.CSSProperties = {
    ...chipBase,
    background: '#fff',
    border: '1px solid #e5e2dc',
    color: '#7d766c',
}
const seasonChip = (color: string): React.CSSProperties => ({
    ...chipBase,
    background: color,
    color: '#fff',
    fontWeight: 700,
})
const dietChip: React.CSSProperties = {
    ...chipBase,
    background: 'rgba(94, 138, 46, 0.14)',
    border: '1px solid rgba(94, 138, 46, 0.3)',
    color: '#4c7122',
    fontWeight: 600,
}

const counter: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--m-gap-tight, 5px)',
    font: 'var(--m-font-meta-strong, 600 11px var(--m-body))',
    fontSize: '12px',
    color: '#6b6459',
}

// Category → accent hue. THIS MAP IS THE APP'S, not the library's — it is the whole
// reason the card takes a hue instead of a category. Verbatim from
// web/src/components/RecipeCard.tsx.
const CATEGORY_ACCENT: Record<string, string> = {
    Предјадење: '#8a6d2f',
    Салата: '#4e6b3c',
    Супа: '#3c5d6b',
    'Главно јадење': '#a4472f',
    Прилог: '#7a6a3c',
    Десерт: '#6b3c5f',
    Зимница: '#94502e',
    Пијалак: '#3c6b64',
}

const Heart: React.FC<{ filled?: boolean }> = ({ filled }) => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={filled ? '#f2604b' : 'none'}
        stroke={filled ? 'none' : '#9aa189'}
        strokeWidth="1.7"
    >
        <path d="M12 20s-7.5-4.7-7.5-9.5A4.5 4.5 0 0 1 12 7.6a4.5 4.5 0 0 1 7.5 2.9C19.5 15.3 12 20 12 20z" />
    </svg>
)

const Star: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#f2b705" stroke="none">
        <path d="m12 3.5 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9z" />
    </svg>
)

const Bowl: React.FC = () => (
    <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#8a6d2f"
        strokeWidth="1.7"
        strokeLinecap="round"
    >
        <path d="M4 11h16a8 8 0 0 1-16 0z" />
        <path d="M9 6.5c0-1 1-1.5 1-2.5M13 6.5c0-1 1-1.5 1-2.5" />
    </svg>
)

// ── 1c: the cookbook list ─────────────────────────────────────────────────────

const CookbookExample: React.FC = () => {
    const [opened, setOpened] = useState<string>('—')
    // `tc-taxonomy-card-activate` is cancelable; cancelling it suppresses the anchor's
    // own navigation, which is exactly how an SPA router adopts these cards.
    const ref = useTc<HTMLElement>({
        'tc-taxonomy-card-activate': (e) => {
            e.preventDefault()
            const detail = (e as CustomEvent<{ href: string | null }>).detail
            setOpened(detail.href ?? '(button)')
        },
    })

    return (
        <div>
            <div style={label}>1c — Рецепти, three cards in three category hues</div>
            <div ref={ref} style={phone}>
                <tc-taxonomy-card
                    accent={CATEGORY_ACCENT['Главно јадење']}
                    eyebrow="Главно јадење"
                    heading="Тавче гравче"
                    heading-level={3}
                    description="Тенџере грав во рерна со црвен пипер, лук и малку сув вратник."
                    metric-value="486"
                    metric-unit="ккал"
                    metric-spoken="486 килокалории по порција"
                    href="/recipes/tavce-gravce"
                >
                    <div slot="chips">
                        <span style={seasonChip('#c24914')}>Есен</span>
                        <span style={chip}>4 порции</span>
                        <span style={chip}>1 ч 20 мин</span>
                        <span style={dietChip}>Посно</span>
                    </div>
                </tc-taxonomy-card>

                <tc-taxonomy-card
                    accent={CATEGORY_ACCENT['Салата']}
                    eyebrow="Салата"
                    heading="Шопска салата"
                    heading-level={3}
                    description="Домат, краставица, пиперка и настрган сирење."
                    metric-value="142"
                    metric-unit="ккал"
                    metric-spoken="142 килокалории по порција"
                    href="/recipes/sopska"
                >
                    <div slot="chips">
                        <span style={seasonChip('#dd9a10')}>Лето</span>
                        <span style={chip}>2 порции</span>
                        <span style={chip}>10 мин</span>
                    </div>
                </tc-taxonomy-card>

                {/* No chip row at all — the description is the last run and its gap
                    collapses with it. */}
                <tc-taxonomy-card
                    accent={CATEGORY_ACCENT['Зимница']}
                    eyebrow="Зимница"
                    heading="Ајвар од печени пиперки"
                    heading-level={3}
                    description="Бавно печен, без конзерванси. Адаптирано од Билјана С."
                    metric-value="64"
                    metric-unit="ккал"
                    metric-spoken="64 килокалории по порција"
                    href="/recipes/ajvar"
                />
            </div>
            <div style={note}>
                Opened: <strong>{opened}</strong>. Each card is one tab stop — a real{' '}
                <code>&lt;a href&gt;</code> around the title, with a stretched overlay making the
                whole card the hit target. Long-press it on a phone and you get the OS context menu;
                the router adopts the tap by cancelling <code>tc-taxonomy-card-activate</code>.
            </div>
        </div>
    )
}

// ── 1f: the community feed, with a button inside a tappable card ───────────────

const FeedExample: React.FC = () => {
    const [log, setLog] = useState<string[]>([])
    const push = (line: string) => setLog((l) => [line, ...l].slice(0, 4))
    const ref = useTc<HTMLElement>({
        'tc-taxonomy-card-activate': (e) => {
            e.preventDefault()
            push(`card → ${(e as CustomEvent<{ href: string | null }>).detail.href}`)
        },
    })

    return (
        <div>
            <div style={label}>1f — Истражи, а „Додади" button inside a tappable card</div>
            <div ref={ref} style={phone}>
                <tc-taxonomy-card
                    accent={CATEGORY_ACCENT['Супа']}
                    eyebrow="Супа · Марија П."
                    heading="Чорба од леќа"
                    heading-level={3}
                    description="Густа зимска чорба со морков и целер."
                    metric-value="212"
                    metric-unit="ккал"
                    metric-spoken="212 килокалории по порција"
                    href="/explore/corba"
                >
                    <div slot="social">
                        <span style={counter}>
                            <Heart filled /> 48
                        </span>
                        <span style={counter}>
                            <Bowl /> 21
                        </span>
                        <span style={counter}>
                            <Star /> 4.6
                        </span>
                        {/* .ms-auto pushes the trailing action right. The card does NOT do
                            this for the last child: a strip whose last child is a counter
                            must not have it shoved to the far edge. */}
                        <tc-button
                            className="ms-auto"
                            variant="primary"
                            size="small"
                            onClick={() => push('button → Додади')}
                        >
                            Додади
                        </tc-button>
                    </div>
                </tc-taxonomy-card>

                <tc-taxonomy-card
                    accent={CATEGORY_ACCENT['Десерт']}
                    eyebrow="Десерт · JADI.mk"
                    heading="Тиквеник"
                    heading-level={3}
                    description="Кори, тиква и ореви — есенска класика."
                    metric-value="318"
                    metric-unit="ккал"
                    metric-spoken="318 килокалории по порција"
                    href="/explore/tikvenik"
                >
                    <div slot="social">
                        <span style={counter}>
                            <Heart /> 132
                        </span>
                        <span style={counter}>
                            <Star /> 4.9
                        </span>
                        <tc-button
                            className="ms-auto"
                            variant="secondary"
                            outline
                            size="small"
                            disabled
                        >
                            Додадено
                        </tc-button>
                    </div>
                </tc-taxonomy-card>
            </div>
            <div style={note}>
                Tap „Додади" and only the button fires; tap the gap beside it and the card opens.
                That is the whole nested-interactive answer: the stretched overlay sits at{' '}
                <code>z-index: 1</code> and every focusable thing inside a slotted region is raised
                to <code>2</code> — so the button wins the hit test while the row's empty space
                still belongs to the card.
                <br />
                {log.length === 0
                    ? 'No taps yet.'
                    : log.map((l) => <div key={l + Math.random()}>{l}</div>)}
            </div>
        </div>
    )
}

// ── 1b: the hero card, and 1g's skeleton ──────────────────────────────────────

const HeroAndSkeletonExample: React.FC = () => (
    <div>
        <div style={label}>1b — Рецепт на неделата · 1g — the blurred skeleton</div>
        <div style={{ ...phone, gap: 'var(--m-gap-section, 14px)' }}>
            <div>
                <div style={eyebrow}>Рецепт на неделата</div>
                {/* 1b's card is the same element at a tighter scale: 13px/14px/11px padding,
                    a 19px title and no drop shadow (the bevel alone). Three cosmetic
                    properties, not a variant — the design draws it once. */}
                <tc-taxonomy-card
                    accent={CATEGORY_ACCENT['Главно јадење']}
                    eyebrow="Главно јадење"
                    heading="Тавче гравче"
                    description="Тенџере грав во рерна со црвен пипер и лук."
                    metric-value="486"
                    metric-unit="ккал"
                    metric-spoken="486 килокалории по порција"
                    href="/recipes/tavce-gravce"
                    style={
                        {
                            '--bs-taxonomy-card-padding': '13px 14px 11px',
                            '--bs-taxonomy-card-heading-font': '600 19px/1.12 var(--m-display)',
                            '--bs-taxonomy-card-shadow': 'var(--m-bevel-top)',
                        } as React.CSSProperties
                    }
                />
            </div>

            {/* 1g draws three of these behind the filter sheet: 112px tall, flat, the
                category hue still on the top rule. `static` drops the activation region
                entirely, so a skeleton is not a tab stop. */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--m-gap-stack, 11px)',
                }}
            >
                {['#a4472f', '#4e6b3c', '#3c5d6b'].map((hue) => (
                    <tc-taxonomy-card
                        key={hue}
                        static
                        accent={hue}
                        style={
                            {
                                height: '112px',
                                '--bs-taxonomy-card-tint': '0%',
                                '--bs-taxonomy-card-shadow': 'none',
                            } as React.CSSProperties
                        }
                    />
                ))}
            </div>
        </div>
        <div style={note}>
            <code>static</code> is the opt-out because interactive is the default — an HTML boolean
            attribute cannot say „true unless you say otherwise". The three skeletons carry no text
            at all, so the card hides its own text block rather than leaving its gap behind.
        </div>
    </div>
)

// ── The float, which is the point ─────────────────────────────────────────────

const WrapExample: React.FC = () => {
    const [long, setLong] = useState(true)
    return (
        <div>
            <div style={label}>The title wraps AROUND the kcal box</div>
            <div style={phone}>
                <tc-taxonomy-card
                    accent={CATEGORY_ACCENT['Предјадење']}
                    eyebrow="Предјадење"
                    heading={long ? 'Американски палачинки со нутела и вишни' : 'Палачинки'}
                    description="Дебели палачинки со прашок за печење, полнети со нутела и кисели вишни од зимница."
                    metric-value="486"
                    metric-unit="ккал"
                    metric-spoken="486 килокалории по порција"
                    href="/recipes/palacinki"
                />
            </div>
            <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={() => setLong((v) => !v)}
            >
                {long ? 'Shorten the title' : 'Restore the long title'}
            </button>
            <div style={note}>
                The metric box is <code>float: right</code>, which shortens only the LINE BOXES
                beside it — so this 39-character Cyrillic title takes two lines around the kcal
                figure and the description underneath runs full width. A flex row of [text | kcal]
                would squeeze the title into a 270px column for its whole height and cost it a third
                line. That is why the float stayed.
            </div>
        </div>
    )
}

// ── Clamp, subheading, actions ────────────────────────────────────────────────

const SurfaceExample: React.FC = () => {
    const [clamp, setClamp] = useState(2)
    return (
        <div>
            <div style={label}>clamp · subheading · the actions row</div>
            <div style={phone}>
                <tc-taxonomy-card
                    accent={CATEGORY_ACCENT['Пијалак']}
                    eyebrow="Пијалак"
                    heading="Домашен сок од јаболка"
                    subheading="Од папката „Зимница 2024"
                    clamp={clamp}
                    description="Овој опис е намерно долг за да се докаже отсекувањето: без него картичката во листа расте колку што сака и го руши ритамот на страницата, што е токму она што стегањето треба да го спречи."
                    metric-value="98"
                    metric-unit="ккал"
                    metric-spoken="98 килокалории по порција"
                >
                    <div slot="actions" style={{ display: 'flex', gap: 'var(--m-gap-tight, 5px)' }}>
                        <tc-button variant="primary" size="small">
                            Отвори
                        </tc-button>
                        <tc-button variant="danger" outline size="small">
                            Избриши
                        </tc-button>
                    </div>
                </tc-taxonomy-card>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[1, 2, 3, 0].map((n) => (
                    <button
                        key={n}
                        type="button"
                        className={`btn btn-sm ${clamp === n ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setClamp(n)}
                    >
                        clamp={n}
                    </button>
                ))}
            </div>
            <div style={note}>
                This card has no <code>href</code>, so its activation region is a{' '}
                <code>&lt;button&gt;</code> — the „Отвори"/„Избриши" pair still works, because the
                pair is slotted content raised above the overlay rather than nested inside a button.
                <code>clamp=0</code> turns the clamp off entirely.
            </div>
        </div>
    )
}

// ── Every category hue ────────────────────────────────────────────────────────

const HuesExample: React.FC = () => (
    <div>
        <div style={label}>The eight category hues, plus the fallback</div>
        <div style={{ ...phone, gap: 'var(--m-gap-tight, 5px)' }}>
            {Object.entries(CATEGORY_ACCENT).map(([name, hue]) => (
                <tc-taxonomy-card
                    key={name}
                    accent={hue}
                    eyebrow={name}
                    heading={name}
                    metric-value="000"
                    metric-unit="ккал"
                    style={{ '--bs-taxonomy-card-padding': '10px 12px 9px' } as React.CSSProperties}
                />
            ))}
            {/* No `accent` at all — sunshine's #55524c warm grey, the app's own fallback for
                a row with no taxonomy. */}
            <tc-taxonomy-card
                eyebrow="Без категорија"
                heading="Без категорија"
                metric-value="000"
                metric-unit="ккал"
                style={{ '--bs-taxonomy-card-padding': '10px 12px 9px' } as React.CSSProperties}
            />
        </div>
        <div style={note}>
            One hue drives five surfaces: the 3px top rule, the 3% surface tint, the eyebrow, the
            metric figure and the metric border's 30% mix. The map itself belongs to the app — the
            library never learns what a „Салата" is.
        </div>
    </div>
)

// ── A card whose numbers change ────────────────────────────────────────────────

const LiveExample: React.FC = () => {
    const [servings, setServings] = useState(4)
    const perServing = Math.round(1944 / servings)
    // Captured on the first render and compared after: a proportional figure would move
    // the box's left edge as the digit count changes.
    const probe = useRef<HTMLElement>(null)
    const [shift, setShift] = useState('—')
    useEffect(() => {
        const left = probe.current
            ?.querySelector('.tc-taxonomy-card-metric')
            ?.getBoundingClientRect().left
        if (left != null) setShift(`${left.toFixed(2)}px`)
    }, [servings])

    return (
        <div>
            <div style={label}>The metric is tabular, and the text is patched not rebuilt</div>
            <div style={phone}>
                <tc-taxonomy-card
                    ref={probe}
                    accent={CATEGORY_ACCENT['Главно јадење']}
                    eyebrow="Главно јадење"
                    heading="Тавче гравче"
                    description={`За ${servings} порции.`}
                    metric-value={String(perServing)}
                    metric-unit="ккал"
                    metric-spoken={`${perServing} килокалории по порција`}
                    href="/recipes/tavce-gravce"
                />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setServings((s) => Math.max(1, s - 1))}
                >
                    −
                </button>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{servings} порции</span>
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setServings((s) => Math.min(24, s + 1))}
                >
                    +
                </button>
            </div>
            <div style={note}>
                Box's left edge: <strong>{shift}</strong> — it does not move as the figure crosses a
                digit count, because the partial declares{' '}
                <code>font-variant-numeric: tabular-nums</code> AFTER the <code>font</code>{' '}
                shorthand (which resets it). The card patches its text with a{' '}
                <code>textContent</code> compare rather than rewriting the subtree, so the focused
                link survives every tick.
            </div>
        </div>
    )
}

const TaxonomyCardDemo: React.FC = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <CookbookExample />
        <FeedExample />
        <HeroAndSkeletonExample />
        <WrapExample />
        <SurfaceExample />
        <HuesExample />
        <LiveExample />
    </div>
)

export default TaxonomyCardDemo
