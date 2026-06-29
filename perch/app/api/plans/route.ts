// GET /api/plans — the server-derived plan/sponsor context the plans page needs
// but can't compute client-side: the bootstrap owner's Sponsors page, the live
// sponsor wall, the owner-editable `$ → plan` mapping, and the quota grace window
// (§8, §11, §14). The caller's own plan/limits/usage come from `GET /api/me` and
// their sites from `GET /api/sites`. Guarded by `authorize('standard')`.

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import { config } from '@/server/config'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as sponsorshipRepo from '@/server/data/repositories/sponsorship-repo'
import * as planTierRepo from '@/server/data/repositories/plan-tier-repo'
import { buildSponsorTiers, sponsorPageUrl, type PlansContext } from '@/server/domain/plans-view'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const authz = await authorize('standard')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const owner = userRepo.getOwner()
    const ownerLogin = owner?.login ?? null
    const planTiers = planTierRepo.list()

    const body: PlansContext = {
        ownerLogin,
        sponsorUrl: sponsorPageUrl(ownerLogin),
        sponsorTiers: buildSponsorTiers(sponsorshipRepo.listActive(), planTiers),
        planTiers,
        quotaGraceSec: config.quotaGraceSec,
    }
    return NextResponse.json(body)
}
