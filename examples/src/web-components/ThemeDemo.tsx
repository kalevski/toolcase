import React from 'react'

// A small cluster of nested components reused under each theme wrapper, so the
// effect of a token swap is obvious side-by-side.
const Cluster: React.FC = () => (
    <div className="d-flex flex-column gap-3">
        {/* @ts-ignore */}
        <tc-panel bordered>
            {/* @ts-ignore */}
            <tc-panel-header heading="Project status" icon="Activity"></tc-panel-header>
            <p className="m-0">
                Every component below inherits its colours, borders, and type from the wrapping{' '}
                <code>tc-theme</code> — no per-element overrides.
            </p>
        </tc-panel>

        <div className="d-flex flex-wrap gap-2 align-items-center">
            <tc-button variant="primary">Primary</tc-button>
            {/* @ts-ignore */}
            <tc-button variant="secondary" outline>
                Secondary
            </tc-button>
            <tc-badge variant="primary">New</tc-badge>
            <tc-badge variant="success">Stable</tc-badge>
        </div>

        <tc-alert variant="info">Tokens cascade to nested components through inheritance.</tc-alert>

        <div className="d-flex flex-wrap gap-3">
            {/* @ts-ignore */}
            <tc-metric-tile label="Builds" value="1,284" icon="Hammer"></tc-metric-tile>
            {/* @ts-ignore */}
            <tc-metric-tile label="Uptime" value="99.98" unit="%" icon="Activity"></tc-metric-tile>
        </div>
    </div>
)

const VARIANTS = [
    'ocean',
    'forest',
    'ember',
    'royal',
    'mint',
    'rose',
    'crimson',
    'indigo',
    'slate',
    'sunset',
    'twilight',
] as const
const VARIANT_THEMES = [
    'default',
    'dungeon',
    'aurora',
    'sunshine',
    'neon',
    'blueprint',
    'redline',
] as const

const ThemeDemo: React.FC = () => {
    const [variantTheme, setVariantTheme] =
        React.useState<(typeof VARIANT_THEMES)[number]>('blueprint')
    const [variant, setVariant] = React.useState<(typeof VARIANTS)[number]>('ocean')
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Theme"
                            description="The theming host element — a display:contents wrapper that hosts --tc-* token overrides. Re-pointing the design-system tokens on a tc-theme re-skins every nested tc-* component at once, because each component's cosmetics flow through --bs-<component>-* properties that default to --tc-* tokens."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Ambient (default) theme — no wrapper">
                                <p className="text-muted small mb-3">
                                    The default toolcase tokens apply globally at <code>:root</code>
                                    , so components are themed out of the box with no{' '}
                                    <code>tc-theme</code> wrapper.
                                </p>
                                <Cluster />
                            </tc-section-card>

                            <tc-section-card title="Ad-hoc token overrides — set --tc-* on the wrapper">
                                <p className="text-muted small mb-3">
                                    The simplest re-skin: set <code>--tc-*</code> design tokens
                                    directly on a <code>tc-theme</code>. They inherit through the{' '}
                                    <code>display:contents</code> box, so every descendant picks
                                    them up.
                                </p>
                                {/* @ts-ignore */}
                                <tc-theme
                                    style={
                                        {
                                            '--tc-accent': '#7c3aed',
                                            '--tc-app-accent': '#7c3aed',
                                            '--tc-app-accent-hover': '#6d28d9',
                                            '--tc-border': '#e9d5ff',
                                            '--tc-surface-muted': '#faf5ff',
                                        } as React.CSSProperties
                                    }
                                >
                                    <Cluster />
                                </tc-theme>
                            </tc-section-card>

                            <tc-section-card title='Named theme — name="dungeon"'>
                                <p className="text-muted small mb-3">
                                    Opt into a bundled skin via the <code>name</code> attribute. The
                                    fantasy <code>dungeon</code> palette stays inert until a wrapper
                                    requests it. (Display fonts are not bundled — they degrade to
                                    system serifs.)
                                </p>
                                {/* @ts-ignore */}
                                <tc-theme name="dungeon">
                                    <Cluster />
                                </tc-theme>
                            </tc-section-card>

                            <tc-section-card title='Named theme — name="aurora"'>
                                <p className="text-muted small mb-3">
                                    The dark <code>aurora</code> skin re-skins the same subtree
                                    without touching any nested markup.
                                </p>
                                {/* @ts-ignore */}
                                <tc-theme name="aurora">
                                    <Cluster />
                                </tc-theme>
                            </tc-section-card>

                            <tc-section-card title='Named theme — name="sunshine"'>
                                <p className="text-muted small mb-3">
                                    The warm <code>sunshine</code> skin — a citrus-boutique palette
                                    (cream canvas, olive-green ink, bright lemon accent) ported from
                                    the nekadnesto.mk storefront — re-skins the same subtree.
                                    (Display fonts are not bundled — they degrade to system
                                    sans-serif.)
                                </p>
                                {/* @ts-ignore */}
                                <tc-theme name="sunshine">
                                    <Cluster />
                                </tc-theme>
                            </tc-section-card>

                            <tc-section-card title='Named theme — name="neon"'>
                                <p className="text-muted small mb-3">
                                    The dark <code>neon</code> skin — a synthwave / cyberpunk
                                    palette (deep navy-purple void, dual hot-magenta + electric-cyan
                                    accents, glowing outlines) ported from the Neon Drift landing
                                    page — re-skins the same subtree. (Display fonts are not bundled
                                    — they degrade to system sans-serif.)
                                </p>
                                {/* @ts-ignore */}
                                <tc-theme name="neon">
                                    <Cluster />
                                </tc-theme>
                            </tc-section-card>

                            <tc-section-card title='Named theme — name="blueprint"'>
                                <p className="text-muted small mb-3">
                                    The light <code>blueprint</code> skin — lavender paper, a faint
                                    violet grid, four arcade accents (pink · teal · violet · amber)
                                    and, uniquely, rounded corners.
                                </p>
                                {/* @ts-ignore */}
                                <tc-theme name="blueprint">
                                    <Cluster />
                                </tc-theme>
                            </tc-section-card>

                            <tc-section-card title='Named theme — name="redline"'>
                                <p className="text-muted small mb-3">
                                    The light <code>redline</code> skin — a performance-dealership
                                    palette (showroom canvas, crimson signature accent, technical-blue
                                    highlight, dark navbar/footer/hero chrome) ported from an
                                    automotive marketplace template. Its signature is a diagonal
                                    "speed-cut" corner on cards and panels — a clip-path shear, not a
                                    curve, so the sharp-corner mandate stays intact. See the{' '}
                                    <code>tc-car-listing-card</code> demo for the theme's flagship
                                    component. (Display font is not bundled — it degrades to system
                                    sans-serif.)
                                </p>
                                {/* @ts-ignore */}
                                <tc-theme name="redline">
                                    <Cluster />
                                </tc-theme>
                            </tc-section-card>

                            <tc-section-card title="Theme variants — name + variant">
                                <p className="text-muted small mb-3">
                                    Every bundled theme ships eleven accent variants selected with the{' '}
                                    <code>variant</code> attribute:{' '}
                                    <code>&lt;tc-theme name="blueprint" variant="ocean"&gt;</code>.
                                    A variant swaps only the primary and secondary accent colours —
                                    canvas, surfaces, text, status colours and structure all stay
                                    the base theme's. The variants are <code>ocean</code> (blue
                                    / cyan), <code>forest</code> (green / lime), <code>ember</code>{' '}
                                    (orange / gold), <code>royal</code> (violet / magenta),{' '}
                                    <code>mint</code> (teal / mint), <code>rose</code> (rose / pink),{' '}
                                    <code>crimson</code> (red / coral), <code>indigo</code> (indigo /
                                    periwinkle), <code>slate</code> (steel / silver), and two{' '}
                                    <strong>gradient</strong> variants whose primary is a two-tone sweep
                                    instead of a flat colour: <code>sunset</code> (coral → orange) and{' '}
                                    <code>twilight</code> (violet → blue).
                                </p>
                                <div className="d-flex flex-column gap-3 mb-3">
                                    <div>
                                        <div className="text-muted small mb-2">Theme</div>
                                        <div className="d-flex flex-wrap gap-2">
                                            {VARIANT_THEMES.map((t) => (
                                                <tc-button
                                                    key={t}
                                                    variant={t === variantTheme ? 'primary' : 'secondary'}
                                                    // @ts-ignore
                                                    outline={t !== variantTheme}
                                                    onClick={() => setVariantTheme(t)}
                                                >
                                                    {t}
                                                </tc-button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-muted small mb-2">Variant</div>
                                        <div className="d-flex flex-wrap gap-2">
                                            {VARIANTS.map((v) => (
                                                <tc-button
                                                    key={v}
                                                    variant={v === variant ? 'primary' : 'secondary'}
                                                    // @ts-ignore
                                                    outline={v !== variant}
                                                    onClick={() => setVariant(v)}
                                                >
                                                    {v}
                                                </tc-button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div className="mb-2">
                                        <code>
                                            name="{variantTheme}" variant="{variant}"
                                        </code>
                                    </div>
                                    {/* @ts-ignore */}
                                    <tc-theme name={variantTheme} variant={variant}>
                                        <Cluster />
                                        {/* @ts-ignore */}
                                    </tc-theme>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ThemeDemo
