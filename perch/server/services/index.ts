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
//
// See notes/static-hosting-app-design.md §5, §7, §13.

import 'server-only'

export {}
