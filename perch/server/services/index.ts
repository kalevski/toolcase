// Service layer — policy / business rules. Each service is server-only and is
// the sole caller of the repositories beneath it. This file only marks the
// layer and the `server-only` guard convention; import services directly
// (`import * as auth from '@/server/services/auth'`).
//
// Services so far:
//   - auth.ts — GitHub OAuth code flow, signed httpOnly session cookie,
//     owner-bootstrap role resolution, and the `authorize(minRole)` guard (§7).
//   - plan.ts — effective plan + quota limits, computed from a user's
//     sponsorship row through the owner-editable `plan_tier` mapping (§6, §8, §15).
//   - sponsors-reconcile.ts — the scheduled GraphQL reconcile ticker that queries
//     the owner's `sponsorshipsAsMaintainer` and upserts authoritative sponsorship
//     state, self-healing missed/forged webhooks (§8, §16). The Sponsors webhook
//     itself lives in `app/api/webhooks/github-sponsors/route.ts`.
//   - deploy.ts — the site-lifecycle state machine (`draft → provisioning → live →
//     failed`): provision / track / redeploy / update / remove, driving nginxpilot
//     (fragment + reload + sync) with last-known-good semantics (§9). Pure logic in
//     `domain/deploy-machine.ts`; this is the server-only wiring.
//   - quota.ts — the control-plane quota gates nginxpilot can't provide: pre-create
//     count + custom-domain gates, the plan-derived fragment refresh interval, and
//     the post-deploy byte cap (over_quota → grace → suspend, reversible on trim or
//     upgrade) (§11). Pure decisions in `domain/quota.ts`; this is the server-only wiring.
//   - sites.ts — the `/api/sites` policy layer: per-site tenant isolation (re-checks
//     `site.owner_id === session.sub`, owner role bypasses) plus create/update/delete/
//     redeploy/verify/status orchestration over the quota (§728), domains (§729), and
//     deploy (§727) services. Pure ownership + source-input decisions live in
//     `domain/site-access.ts` and `domain/site-input.ts`; this is the server-only wiring.
//   - domains.ts — the shared hostname namespace + custom-domain provisioning:
//     strict label/custom-domain validation with global uniqueness, subdomain attach
//     (pure nginxpilot fragment, no nginx reload), server-side DNS verification against
//     the ingress IP (fail-closed takeover guard), and per-custom-domain vhost + certbot
//     install/teardown (§10, §16). Pure shape/verify decisions in `domain/hostname.ts`;
//     the nginx/certbot/DNS I/O is in `infrastructure/nginx.ts`.
//
// See notes/static-hosting-app-design.md §5, §7, §13.

import 'server-only'

export {}
