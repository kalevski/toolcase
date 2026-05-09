import type { Kysely, Transaction } from 'kysely'

export type Trx<DB> = Transaction<DB>

export type Executor<DB> = Kysely<DB>
