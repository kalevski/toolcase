// Driver dispatch (perch_database_management.md §6): one `DbDriver` per engine,
// resolved by the registry row's `kind`. The barrel the services import.

import 'server-only'
import type { DbServerKind } from '@/server/domain/types'
import { postgresDriver } from '@/server/infrastructure/db-drivers/postgres'
import { mysqlDriver } from '@/server/infrastructure/db-drivers/mysql'
import type { DbDriver } from '@/server/infrastructure/db-drivers/types'

export {
    DbDriverError,
    CONNECT_TIMEOUT_MS,
    STATEMENT_TIMEOUT_MS,
    type DbConnInfo,
    type DbDriver,
} from '@/server/infrastructure/db-drivers/types'

export function driverFor(kind: DbServerKind): DbDriver {
    return kind === 'postgres' ? postgresDriver : mysqlDriver
}
