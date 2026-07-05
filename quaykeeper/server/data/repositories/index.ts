// Repository layer — raw-SQL access, one file per §12 table, server-only. Each
// module is a namespace of prepared-statement CRUD/query helpers over `db.ts`,
// returning the `server/domain/types.ts` row types. Services import a repo either
// directly (`import * as userRepo from '@/server/data/repositories/user-repo'`)
// or via these barrels. See notes/static-hosting-app-design.md §5, §12.

import 'server-only'

export * as userRepo from './user-repo'
export * as userLimitRepo from './user-limit-repo'
export * as realmRepo from './realm-repo'
export * as userRealmRepo from './user-realm-repo'
export * as baseDomainRepo from './base-domain-repo'
export * as siteRepo from './site-repo'
export * as auditRepo from './audit-repo'
export * as settingRepo from './setting-repo'
export * as globalVarRepo from './global-var-repo'
export * as secretRepo from './secret-repo'
export * as instanceRepo from './instance-repo'
export * as envVarRepo from './env-var-repo'
export * as flagRepo from './flag-repo'
export * as dbServerRepo from './db-server-repo'
export * as dockerSnippetRepo from './docker-snippet-repo'
