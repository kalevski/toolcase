import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const FRAMEWORK_ITEMS = [
    {
        key: 'react',
        label: 'React',
        description: 'A JavaScript library for building user interfaces',
    },
    { key: 'vue', label: 'Vue', description: 'The progressive JavaScript framework' },
    { key: 'svelte', label: 'Svelte', description: 'Cybernetically enhanced web apps' },
    {
        key: 'angular',
        label: 'Angular',
        description: 'Platform for building mobile & desktop apps',
    },
    {
        key: 'solid',
        label: 'SolidJS',
        description: 'Simple and performant reactivity for building user interfaces',
    },
    { key: 'qwik', label: 'Qwik', description: 'Instant-on web apps at any scale' },
]

const COUNTRY_ITEMS = [
    { key: 'us', label: 'United States' },
    { key: 'gb', label: 'United Kingdom' },
    { key: 'de', label: 'Germany' },
    { key: 'fr', label: 'France' },
    { key: 'jp', label: 'Japan' },
    { key: 'ca', label: 'Canada' },
    { key: 'au', label: 'Australia' },
    { key: 'br', label: 'Brazil' },
]

// A stress list. The app's ingredient-category filter already runs to dozens of
// options and its ingredient picker to hundreds — at which point a 240px floating
// dropdown anchored mid-screen stops being a control.
const INGREDIENT_ITEMS = Array.from({ length: 300 }, (_, i) => ({
    key: `ing-${i}`,
    label: `Состојка ${String(i + 1).padStart(3, '0')}`,
    description: i % 7 === 0 ? 'со опис' : undefined,
}))

const SEASON_ITEMS = [
    { key: 'spring', label: 'Пролет' },
    { key: 'summer', label: 'Лето' },
    { key: 'autumn', label: 'Есен' },
    { key: 'winter', label: 'Зима' },
    { key: 'all', label: 'Целогодишно' },
]

const ExtendedSelectDemo: React.FC = () => {
    const [selected, setSelected] = useState<string | null>(null)
    const [preselectedValue, setPreselectedValue] = useState<string>('react')
    const [submitted, setSubmitted] = useState<string | null>(null)
    const [picked, setPicked] = useState<string[]>(['react', 'svelte'])
    const [multiSubmitted, setMultiSubmitted] = useState<string[] | null>(null)

    const basicRef = useTc<HTMLElement>(
        { items: FRAMEWORK_ITEMS },
        {
            'tc-change': (e: Event) => {
                setSelected((e as CustomEvent<{ value: string }>).detail.value)
            },
        },
    )
    const preselectedRef = useTc<HTMLElement>(
        { items: COUNTRY_ITEMS },
        {
            'tc-change': (e: Event) => {
                setPreselectedValue((e as CustomEvent<{ value: string }>).detail.value)
            },
        },
    )
    const sheetRef = useTc<HTMLElement>({ items: SEASON_ITEMS })
    const sheetLongRef = useTc<HTMLElement>({ items: INGREDIENT_ITEMS })
    const sheetMultiRef = useTc<HTMLElement>({ items: INGREDIENT_ITEMS })
    const loadingRef = useTc<HTMLElement>({ items: FRAMEWORK_ITEMS })
    const formRef = useTc<HTMLElement>({ items: FRAMEWORK_ITEMS })
    const multiRef = useTc<HTMLElement>(
        { items: FRAMEWORK_ITEMS },
        {
            'tc-change': (e: Event) => {
                setPicked((e as CustomEvent<{ value: string[] }>).detail.value)
            },
        },
    )
    const multiFormRef = useTc<HTMLElement>({ items: COUNTRY_ITEMS })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ExtendedSelect"
                            description="Searchable dropdown with debounced filtering, keyboard navigation, item descriptions, and native form-submission support. Set items via the items JS property; listen for tc-change events."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="With descriptions — framework picker">
                                <p className="text-muted small mb-3">
                                    Items are set via the <code>items</code> JS property. Each item
                                    can carry an optional <code>description</code> line. Type to
                                    filter (debounced 150 ms); Arrow keys navigate; Enter selects;
                                    Escape closes.
                                </p>
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-extended-select
                                        ref={basicRef}
                                        placeholder="Choose a framework…"
                                        search-placeholder="Search frameworks…"
                                        name="framework"
                                    />
                                </div>
                                {selected && (
                                    <p className="mt-3 text-muted small">
                                        Selected: <strong>{selected}</strong>
                                    </p>
                                )}
                            </tc-section-card>

                            <tc-section-card title="Preselected value">
                                <p className="text-muted small mb-3">
                                    Pass a <code>value</code> attribute (or JS property) to set an
                                    initial selection. The trigger shows the item's label; a check
                                    mark highlights the selected row in the list.
                                </p>
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-extended-select
                                        ref={preselectedRef}
                                        value={preselectedValue}
                                        placeholder="Choose a country…"
                                        name="country"
                                    />
                                </div>
                                <p className="mt-3 text-muted small">
                                    Current value: <strong>{preselectedValue}</strong>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Multi-select">
                                <p className="text-muted small mb-3">
                                    Add the boolean <code>multiple</code> attribute to pick several
                                    options. Rows become a checkbox list, the menu stays open while
                                    you toggle, and <code>value</code> holds the comma-separated
                                    keys (read them as an array via the <code>values</code> JS
                                    property). <code>tc-change</code> carries{' '}
                                    <code>detail.value</code> as a <code>string[]</code>. Past three
                                    picks the trigger collapses to an “N selected” summary.
                                </p>
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-extended-select
                                        ref={multiRef}
                                        multiple
                                        value={picked.join(',')}
                                        placeholder="Choose frameworks…"
                                        search-placeholder="Search frameworks…"
                                        name="frameworks"
                                    />
                                </div>
                                <p className="mt-3 text-muted small">
                                    Selected:{' '}
                                    <strong>{picked.length ? picked.join(', ') : '(none)'}</strong>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Multi-select — form submission">
                                <p className="text-muted small mb-3">
                                    In <code>multiple</code> mode every picked key is submitted as a
                                    separate entry under <code>name</code>, so{' '}
                                    <code>formData.getAll(name)</code> returns the full list.
                                </p>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        const fd = new FormData(e.currentTarget)
                                        setMultiSubmitted(fd.getAll('countries').map(String))
                                    }}
                                    style={{ maxWidth: 400 }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-extended-select
                                        ref={multiFormRef}
                                        multiple
                                        required
                                        name="countries"
                                        label="Shipping regions"
                                        help="Pick one or more countries."
                                        placeholder="Choose countries…"
                                        style={{ marginBottom: '0.75rem' } as React.CSSProperties}
                                    />
                                    <button type="submit" className="btn btn-primary btn-sm">
                                        Submit form
                                    </button>
                                </form>
                                {multiSubmitted !== null && (
                                    <p className="mt-3 text-muted small">
                                        Submitted <code>countries</code>:{' '}
                                        <strong>
                                            {multiSubmitted.length
                                                ? multiSubmitted.join(', ')
                                                : '(empty)'}
                                        </strong>
                                    </p>
                                )}
                            </tc-section-card>

                            <tc-section-card title="Loading state">
                                <p className="text-muted small mb-3">
                                    Set the boolean <code>loading</code> attribute to disable the
                                    trigger and show a spinner inside the menu. The dropdown cannot
                                    be opened while loading.
                                </p>
                                <div style={{ maxWidth: 400 }}>
                                    {/* @ts-ignore */}
                                    <tc-extended-select
                                        ref={loadingRef}
                                        placeholder="Fetching options…"
                                        loading
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title='Sheet on touch (mobile="auto")'>
                                <p className="text-muted small mb-3">
                                    Under a coarse pointer below 768px the option list opens in a{' '}
                                    <code>tc-bottom-sheet</code> instead of a floating dropdown:
                                    full-width rows at 48px, a checkmark on the selected item, a
                                    search field past ~12 options, and a „Готово" footer for
                                    multi-select. The value, the selection logic and every event are
                                    the same code in both modes — only the presentation moves. Force
                                    it with <code>mobile=&quot;sheet&quot;</code> to see it on a
                                    desktop; <code>mobile=&quot;dropdown&quot;</code> pins the old
                                    behaviour.
                                </p>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem',
                                        maxWidth: 390,
                                    }}
                                >
                                    {/* Five options — no search field: a filter slower to read
                                        than the list it filters is noise, and on a phone it also
                                        costs the keyboard covering half the sheet. */}
                                    {/* @ts-ignore */}
                                    <tc-extended-select
                                        ref={sheetRef}
                                        mobile="sheet"
                                        label="Сезона (5 опции — без барање)"
                                        placeholder="Изберете сезона…"
                                    />
                                    {/* 300 options — search appears, and the SHEET BODY is the one
                                        scroller rather than a 240px window inside a scrolling
                                        page. */}
                                    {/* @ts-ignore */}
                                    <tc-extended-select
                                        ref={sheetLongRef}
                                        mobile="sheet"
                                        label="Состојка (300 опции — со барање)"
                                        placeholder="Изберете состојка…"
                                    />
                                    {/* Multi-select keeps the sheet open while picking, so it needs
                                        an explicit way out — without the footer the only exit is the
                                        scrim, which reads as cancelling. */}
                                    {/* @ts-ignore */}
                                    <tc-extended-select
                                        ref={sheetMultiRef}
                                        mobile="sheet"
                                        multiple
                                        label="Состојки (повеќекратен избор)"
                                        placeholder="Изберете состојки…"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Native form submission">
                                <p className="text-muted small mb-3">
                                    Inside a <code>&lt;form&gt;</code> the selected value is
                                    submitted via a hidden{' '}
                                    <code>&lt;input type=&quot;hidden&quot;&gt;</code>. The{' '}
                                    <code>name</code> attribute sets the field name for{' '}
                                    <code>FormData</code>.
                                </p>
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        const fd = new FormData(e.currentTarget)
                                        setSubmitted(String(fd.get('tool') ?? ''))
                                    }}
                                    style={{ maxWidth: 400 }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-extended-select
                                        ref={formRef}
                                        placeholder="Pick a tool…"
                                        name="tool"
                                        style={{ marginBottom: '0.75rem' } as React.CSSProperties}
                                    />
                                    <button type="submit" className="btn btn-primary btn-sm">
                                        Submit form
                                    </button>
                                </form>
                                {submitted !== null && (
                                    <p className="mt-3 text-muted small">
                                        Submitted <code>tool</code>:{' '}
                                        <strong>{submitted || '(empty)'}</strong>
                                    </p>
                                )}
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ExtendedSelectDemo
