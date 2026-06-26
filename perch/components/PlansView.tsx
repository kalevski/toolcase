'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTc, useTcProps } from '@/lib/tc'
import { useMe } from '@/lib/me-context'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { LoadingState, ErrorState } from './states'
import {
    buildPricingCards,
    buildQuotaWarnings,
    type PlansContext,
    type PricingCardView,
} from '@/server/domain/plans-view'
import type { MeResponse, Site } from '@/server/domain/types'

// Plans & sponsor view (§6, §11, §14, §15, task 735). One page composed entirely
// of `tc-*` Web Components driven through the `lib/tc.ts` bridge:
//
//   • tc-announcement-bar / tc-banner — over-quota + grace-window warnings, driven
//     by the caller's site status (§11)
//   • tc-pricing-card ×4              — free / bronze / silver / gold from the §15
//     limits, the caller's current plan highlighted and badged (from GET /api/me)
//   • tc-sponsor-wall + a CTA         — the owner's live sponsors and a "Sponsor the
//     owner on GitHub" call-to-action linking to their Sponsors page
//
// All presentation is derived by the pure `domain/plans-view.ts` view-model, so the
// component is just data-fetching + wiring. Object data (`features`/`action`/`tiers`)
// flows into the elements as *properties* via the bridge; everything else is a
// plain attribute.

type LoadState =
    | { phase: 'loading' }
    | { phase: 'error'; message: string }
    | { phase: 'ready'; sites: Site[]; ctx: PlansContext }

export function PlansView() {
    // Identity/plan come from context (AuthGate already fetched /api/me, plan WS-3);
    // only the sites list and the plans context are fetched here.
    const me = useMe()
    const [state, setState] = useState<LoadState>({ phase: 'loading' })

    const load = useCallback(async (signal?: AbortSignal) => {
        setState({ phase: 'loading' })
        try {
            const [sites, ctx] = await Promise.all([
                apiFetch<Site[]>('/api/sites', { signal }),
                apiFetch<PlansContext>('/api/plans', { signal }),
            ])
            setState({ phase: 'ready', sites, ctx })
        } catch (err) {
            if (signal?.aborted) return
            setState({ phase: 'error', message: describeApiError(err) })
        }
    }, [])

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    if (state.phase === 'loading') {
        return (
            <section className="perch-plans">
                <header className="perch-home-header">
                    <h1 className="perch-home-title">Plans</h1>
                </header>
                <LoadingState shape="cards" count={4} label="Loading plans…" />
            </section>
        )
    }

    if (state.phase === 'error') {
        return (
            <section className="perch-plans">
                <header className="perch-home-header">
                    <h1 className="perch-home-title">Plans</h1>
                </header>
                <ErrorState title="Couldn’t load plans" message={state.message} onRetry={() => void load()} />
            </section>
        )
    }

    return <PlansContent me={me} sites={state.sites} ctx={state.ctx} />
}

function PlansContent({ me, sites, ctx }: { me: MeResponse; sites: Site[]; ctx: PlansContext }) {
    const cards = useMemo(
        () => buildPricingCards(me.plan, ctx.planTiers, ctx.sponsorUrl),
        [me.plan, ctx.planTiers, ctx.sponsorUrl],
    )
    const warnings = useMemo(
        () => buildQuotaWarnings(sites, me.limits, ctx.quotaGraceSec),
        [sites, me.limits, ctx.quotaGraceSec],
    )

    const wallRef = useTcProps<HTMLElement>(useMemo(() => ({ tiers: ctx.sponsorTiers }), [ctx.sponsorTiers]))

    const overQuotaCount = warnings.length

    return (
        <section className="perch-plans">
            {/* Page-level over-quota summary (§11). */}
            {overQuotaCount > 0 && (
                <tc-announcement-bar
                    variant="warning"
                    icon-name="triangle-alert"
                    cta-label={ctx.sponsorUrl ? 'Sponsor to upgrade' : undefined}
                    cta-href={ctx.sponsorUrl ?? undefined}
                >
                    {overQuotaCount === 1
                        ? 'One of your sites is over its plan quota.'
                        : `${overQuotaCount} of your sites are over their plan quota.`}
                </tc-announcement-bar>
            )}

            <header className="perch-home-header">
                <h1 className="perch-home-title">Plans</h1>
                <p className="perch-home-lead">
                    You’re on the <strong>{me.plan}</strong> plan. Quotas lift when you sponsor the owner on
                    GitHub — your sponsorship tier maps to the plan below.
                </p>
            </header>

            {/* Per-site warning detail (§11). */}
            {warnings.length > 0 && (
                <div className="perch-plans-warnings">
                    {warnings.map((w) => (
                        <tc-banner key={w.siteId} variant={w.variant}>
                            <strong>{w.title}.</strong> {w.message}
                        </tc-banner>
                    ))}
                </div>
            )}

            <div className="perch-pricing-grid">
                {cards.map((card) => (
                    <PricingCard key={card.plan} card={card} />
                ))}
            </div>

            <section className="perch-sponsor">
                <header className="perch-sponsor-header">
                    <h2 className="perch-home-subtitle">Support Perch</h2>
                    <p className="perch-home-lead">
                        Perch is free to use. Sponsoring{ctx.ownerLogin ? ` @${ctx.ownerLogin}` : ' the owner'} on
                        GitHub keeps the lights on and unlocks higher plans for your account.
                    </p>
                </header>

                {ctx.sponsorUrl ? (
                    <a
                        className="perch-sponsor-cta"
                        href={ctx.sponsorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        ♥ Sponsor the owner on GitHub
                    </a>
                ) : (
                    <p className="perch-sponsor-empty">Sponsorship isn’t set up yet — check back soon.</p>
                )}

                {ctx.sponsorTiers.length > 0 && <tc-sponsor-wall ref={wallRef} title="Our sponsors" />}
            </section>
        </section>
    )
}

// One pricing card. `features` (array) and `action` (object) must be set as element
// *properties* — JSX can only stringify them into attributes — so they flow through
// the lib/tc.ts bridge; the scalar fields stay plain attributes.
function PricingCard({ card }: { card: PricingCardView }) {
    const ref = useTc<HTMLElement>(useMemo(() => ({ features: card.features, action: card.action }), [card]))
    return (
        <tc-pricing-card
            ref={ref}
            name={card.name}
            price={card.price}
            period={card.period}
            description={card.description}
            badge-text={card.badgeText}
            highlight={card.highlight || undefined}
        />
    )
}
