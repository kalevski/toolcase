// Pure usage summarization for `GET /api/me` — collapse a user's sites into a
// count + total deployed bytes (§7 step 4, §11). No I/O and no `server-only`
// deps, so it is unit-testable in isolation; `app/api/me/route.ts` feeds it the
// rows from `siteRepo.listByOwner`. Sites without a measured size count as 0.
//
// See notes/static-hosting-app-design.md §7, §11, §13.

import type { Site, SiteUsage } from '@/server/domain/types'

/** Summarize a user's owned sites into `{ siteCount, totalBytes }`. */
export function summarizeUsage(sites: Site[]): SiteUsage {
    return {
        siteCount: sites.length,
        totalBytes: sites.reduce((sum, site) => sum + (site.bytes ?? 0), 0),
    }
}
