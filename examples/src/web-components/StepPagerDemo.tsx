import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

// Screen `1e` of the JADI.mk phone design, at the size it was composed: 390x844.
// The 844px frame is what makes the clamp visible — the second frame below is a
// 375x667 iPhone SE, where the fixed canvas sizes do not fit and the clamped ones do.
const phone = (height: number, width = 390): React.CSSProperties => ({
    width: `${width}px`,
    maxWidth: '100%',
    height: `${height}px`,
    // The element is `flex: 1 1 auto; height: 100%`, so it needs a parent with a
    // height. A cooking mode in an app gets that from a tc-mobile-shell or from
    // `position: fixed; inset: 0`.
    display: 'flex',
    border: '1px solid var(--tc-border)',
    overflow: 'hidden',
})

const label: React.CSSProperties = { fontWeight: 700, marginBottom: '0.5rem' }

const note: React.CSSProperties = {
    padding: '10px 0',
    fontSize: '0.8125rem',
    color: 'var(--tc-text-muted)',
}

// Verbatim from the design file's own DCLogic script, so the line-breaking in the
// 30px Playfair setting is the real thing rather than lorem ipsum.
const STEPS = [
    {
        no: '01',
        text: 'Гравот потопете го во студена вода преку ноќ, потоа исцедете го.',
        hint: 'Тетовскиот грав бара долго потопување — водата треба да го покрие за два прста.',
    },
    {
        no: '02',
        text: 'Варете го во свежа вода околу 40 минути, додека не омекне но не се распадне.',
        hint: 'Солете дури на крај — солта во почеток ја стврднува лушпата.',
    },
    {
        no: '03',
        text: 'Динстајте го кромидот, додајте црвен пипер надвор од оган и промешајте.',
        hint: 'Пиперот гори за секунди. Тргнете го тавчето од ринглата пред да го ставите.',
    },
    {
        no: '04',
        text: 'Прелијте во земјено тавче и печете 35 минути на 220°C додека не фати кора.',
        hint: 'Кората е поентата — не мешајте додека се пече.',
    },
]

const MK = {
    heading: 'Тавче гравче',
    next: 'Следен',
    done: 'Готово',
    tip: 'Совет',
    swipe: 'Повлечете лево или десно за следниот чекор',
    awake: 'Екранот е буден',
}

// ── the design's own screen, at 390x844 ───────────────────────────────────────

const CanvasExample: React.FC = () => {
    const [log, setLog] = useState('—')
    const pager = useTc<HTMLElement>(
        { steps: STEPS },
        {
            'tc-step-pager-change': (e: CustomEvent) =>
                setLog(`change → ${e.detail.index}${e.detail.last ? ' (last)' : ''}`),
            'tc-step-pager-done': () => setLog('done'),
            'tc-step-pager-close': () => setLog('close'),
        },
    )
    return (
        <div>
            <div style={phone(844)}>
                {/* keep-awake is opted into here so the „Екранот е буден" chip can be
                    seen. It appears ONLY if a screen wake lock is genuinely granted —
                    a secure context, a visible document, and an engine that implements
                    the API. On Firefox and over plain http it never shows, which is the
                    point: the chip reports the lock, not the request. */}
                {/* @ts-ignore */}
                <tc-step-pager
                    ref={pager}
                    heading={MK.heading}
                    next-label={MK.next}
                    done-label={MK.done}
                    hint-label={MK.tip}
                    swipe-hint={MK.swipe}
                    wake-label={MK.awake}
                    keep-awake
                />
            </div>
            <div style={note}>
                Swipe, or use the two buttons, or focus the pager and press ← / →. The progress
                segments fill up to <em>and including</em> the current step, the advance label
                becomes „{MK.done}" on the last one, and the back button stays enabled on the first
                (the design draws it that way) but does nothing. Last event: <code>{log}</code>
            </div>
        </div>
    )
}

// ── the same content at 375x667, where the clamp earns its keep ───────────────

const SmallExample: React.FC = () => {
    const clamped = useTc<HTMLElement>({ steps: STEPS })
    return (
        <div>
            <div style={phone(667, 375)}>
                {/* @ts-ignore */}
                <tc-step-pager
                    ref={clamped}
                    heading={MK.heading}
                    next-label={MK.next}
                    done-label={MK.done}
                    hint-label={MK.tip}
                    swipe-hint={MK.swipe}
                />
            </div>
            <div style={note}>
                iPhone SE. The step number and the step text are <code>clamp()</code>ed against
                viewport height — calibrated so the middle term is exactly the canvas value at 844px
                — and whatever is still left over is absorbed by the step scrolling, so the hint
                block is what goes below the fold rather than the number or the instruction.
            </div>
        </div>
    )
}

// ── steps as bare strings, no hints ──────────────────────────────────────────

const PlainExample: React.FC = () => {
    const plain = useTc<HTMLElement>({
        steps: [
            'Измијте и исецкајте ги доматите на коцки.',
            'Загрејте масло и додајте кромид.',
            'Гответе 10 минути и послужете.',
        ],
    })
    return (
        <div>
            <div style={phone(420)}>
                {/* @ts-ignore */}
                <tc-step-pager
                    ref={plain}
                    heading="Брз сос"
                    next-label={MK.next}
                    done-label={MK.done}
                />
            </div>
            <div style={note}>
                A bare <code>string[]</code> is a valid <code>steps</code> value — which is what a
                recipe's instructions actually are. The numbers are zero-padded automatically, and a
                step with no <code>hint</code> renders no notice block. No <code>swipe-hint</code>{' '}
                here either, so there is no caption row at all rather than an empty one.
            </div>
        </div>
    )
}

// ── past `max-segments`: one bar and a counter instead of a tick row ─────────

const LongExample: React.FC = () => {
    const long = useTc<HTMLElement>({
        steps: Array.from(
            { length: 15 },
            (_, i) => `Чекор број ${i + 1} од петнаесет — измешајте и оставете да отстои.`,
        ),
    })
    return (
        <div>
            <div style={phone(560)}>
                {/* @ts-ignore */}
                <tc-step-pager
                    ref={long}
                    heading="Спирална пита со сирење"
                    next-label={MK.next}
                    done-label={MK.done}
                />
            </div>
            <div style={note}>
                Fifteen steps. Fifteen segments at 390px are 20px each separated by 4px gaps — a
                dotted line whose fill boundary the eye cannot find — so past{' '}
                <code>max-segments</code> (default 10) the same region becomes one continuous bar
                filled to <code>(index + 1) / count</code> with a „3/15" counter beside it. Same
                colours, same 4px height; only the encoding changes. Set <code>max-segments</code>{' '}
                to move the threshold.
            </div>
        </div>
    )
}

// ── heading-action: the context title as a button ────────────────────────────

const HeadingActionExample: React.FC = () => {
    const [log, setLog] = useState('—')
    const acted = useTc<HTMLElement>(
        { steps: STEPS },
        { 'tc-step-pager-heading': () => setLog('heading pressed') },
    )
    return (
        <div>
            <div style={phone(560)}>
                {/* @ts-ignore */}
                <tc-step-pager
                    ref={acted}
                    heading={MK.heading}
                    heading-action
                    next-label={MK.next}
                    done-label={MK.done}
                    hint-label={MK.tip}
                />
            </div>
            <div style={note}>
                With <code>heading-action</code> the title becomes a real <code>button</code> — the
                element swaps the tag, so a plain title never announces as pressable — carrying a
                14px chevron and <code>aria-haspopup="dialog"</code>. Its hit box is grown by
                padding and pulled back by margin exactly as the ✕'s is, so the row keeps the
                design's 34px height. JADI.mk uses it to open the ingredient amounts mid-cook, which
                the canvas has no affordance for at all. Last event: <code>{log}</code>
            </div>
        </div>
    )
}

const StepPagerDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="StepPager"
                        description="The full-screen guided-step surface: a segmented progress rule, one step per swipe, and a 96px back plus a full-width advance button in the thumb zone. Composes tc-swipe-pager, adds an aria-live announcer, and optionally holds a screen wake lock while you cook."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    {/* NOTE: deliberately NOT nested inside tc-section-card /
                        tc-rich-page-header. Those distribute their own slots with a
                        subtree-wide querySelectorAll. tc-step-pager renders its entire
                        subtree from the `steps` property and has no slots, so it can
                        neither be hoisted from nor hoist anything itself. */}
                    <div className="d-flex flex-column gap-4 mt-4">
                        <div>
                            <div style={label}>Screen 1e at 390x844 — the canvas size</div>
                            <CanvasExample />
                        </div>
                        <div>
                            <div style={label}>375x667 — the clamp</div>
                            <SmallExample />
                        </div>
                        <div>
                            <div style={label}>Bare strings, no hints, no caption</div>
                            <PlainExample />
                        </div>
                        <div>
                            <div style={label}>15 steps — one bar and a „3/15" counter</div>
                            <LongExample />
                        </div>
                        <div>
                            <div style={label}>heading-action — the title opens something</div>
                            <HeadingActionExample />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default StepPagerDemo
