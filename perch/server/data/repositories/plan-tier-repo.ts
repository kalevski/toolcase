// Plan-tier repository — all SQL for the `plan_tier` table (§8, §12). The
// owner-editable `$ → plan` mapping that buckets a sponsorship's `tier_cents`
// into a paid `Plan`. Raw-SQL list + whole-table replace; the bucketing logic
// (highest matching `min_cents` wins) lives in `services/plan.ts`.

import 'server-only'
import { prep, allRows, tx } from '@/server/data/db'
import type { PaidPlan, PlanTier } from '@/server/domain/types'

interface Raw {
    min_cents: number
    plan: string
}

function map(r: Raw): PlanTier {
    return { minCents: r.min_cents, plan: r.plan as PaidPlan }
}

/** The mapping ordered cheapest-first, so a service can scan for the highest match. */
export function list(): PlanTier[] {
    return allRows<Raw>('SELECT * FROM plan_tier ORDER BY min_cents').map(map)
}

/**
 * Atomically replace the entire mapping with `tiers`. The owner edits the table
 * as a whole, so this clears every row and re-inserts inside one transaction —
 * never a partially-applied mapping.
 */
export function replace(tiers: PlanTier[]): void {
    tx(() => {
        prep('DELETE FROM plan_tier').run()
        const insert = prep('INSERT INTO plan_tier (min_cents, plan) VALUES (?, ?)')
        for (const t of tiers) insert.run(t.minCents, t.plan)
    })
}
