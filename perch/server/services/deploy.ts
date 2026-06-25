// Deploy service (§9) — the site-lifecycle entry point the API routes call. All the
// policy (the `draft → provisioning → live → failed` state machine, the last-known-good
// status interpretation, the poll loop) lives in the pure, unit-tested
// `domain/deploy-machine.ts`; this layer is the `server-only` wiring that binds that
// machine to real infrastructure: the `nginxpilot` client, `siteRepo`, `auditRepo`,
// and the plan-derived poll interval.
//
// See notes/static-hosting-app-design.md §4, §9, §11.

import 'server-only'
import * as nginxpilot from '@/server/infrastructure/nginxpilot'
import * as siteRepo from '@/server/data/repositories/site-repo'
import * as userRepo from '@/server/data/repositories/user-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { resolveLimits } from '@/server/services/plan'
import { PLAN_LIMITS, type Site } from '@/server/domain/types'
import type { FragmentOptions } from '@/server/domain/nginxpilot-fragment'
import * as machine from '@/server/domain/deploy-machine'
import type { DeployDeps, SiteSourceChanges, TrackOptions } from '@/server/domain/deploy-machine'

/**
 * Render options for a site's fragment: the poll interval is the owner's effective
 * `PlanLimits.minIntervalSec` (free polls slowly, sponsors near-real-time, §11/§15).
 * v1 deploys public repos only, so no `auth` block is emitted (zero stored secrets,
 * §9); the renderer's `require_file` + `exclude` defaults cover the rest.
 */
function fragmentOptions(site: Site): FragmentOptions {
    const owner = userRepo.get(site.ownerId)
    const limits = owner ? resolveLimits(owner.login) : PLAN_LIMITS.free
    return { intervalSec: limits.minIntervalSec }
}

/** Append an audit entry for a lifecycle transition, attributed to the site owner. */
function audit(action: string, site: Site, detail?: string): void {
    const owner = userRepo.get(site.ownerId)
    auditRepo.append({
        githubId: owner?.githubId ?? site.ownerId,
        login: owner?.login ?? null,
        action,
        site: site.hostname,
        detail: detail ?? null,
    })
}

/** Assemble the machine's injected ports from real infrastructure. */
function deps(): DeployDeps {
    return {
        client: {
            writeFragment: nginxpilot.writeFragment,
            removeFragment: nginxpilot.removeFragment,
            reload: nginxpilot.reload,
            sync: nginxpilot.sync,
            status: nginxpilot.status,
        },
        store: {
            updateStatus: siteRepo.updateStatus,
            updateLastError: siteRepo.updateLastError,
            updateLastRef: siteRepo.updateLastRef,
            updateBytes: siteRepo.updateBytes,
            updateSource: siteRepo.updateSource,
            remove: siteRepo.remove,
        },
        fragmentOptions,
        audit,
        now: () => new Date().toISOString(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    }
}

/** Provision a site: write fragment → reload → first sync → mark `provisioning` (§9 step 4). */
export function provision(site: Site): Promise<Site> {
    return machine.provision(deps(), site)
}

/** Poll `/status` until the site is live, applying last-known-good semantics (§9 step 5). */
export function track(site: Site, opts?: TrackOptions): Promise<Site> {
    return machine.track(deps(), site, opts)
}

/** Force an immediate redeploy of the existing fragment (§9 step 6, the Redeploy button). */
export function redeploy(site: Site): Promise<Site> {
    return machine.redeploy(deps(), site)
}

/** Rewrite source on a branch/subdir change, then reload + sync (§9 step 6). */
export function update(site: Site, changes: SiteSourceChanges): Promise<Site> {
    return machine.update(deps(), site, changes)
}

/** Remove the fragment, reload, and delete the row (§9 step 7). */
export function remove(site: Site): Promise<void> {
    return machine.remove(deps(), site)
}
