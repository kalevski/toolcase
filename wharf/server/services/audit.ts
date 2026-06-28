// Audit read service (planning §10, gap-13). Cursor-paginated views over the
// append-only audit log: project-scoped (devops+) and global (owner).

import 'server-only'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import type { AuditEntry } from '@/server/domain/types'

export function listProjectAudit(
    projectId: string,
    opts: { before?: number; limit?: number } = {},
): AuditEntry[] {
    return auditRepo.list({ projectId, beforeId: opts.before, limit: opts.limit })
}

export function listGlobalAudit(opts: { before?: number; limit?: number } = {}): AuditEntry[] {
    return auditRepo.list({ beforeId: opts.before, limit: opts.limit })
}
