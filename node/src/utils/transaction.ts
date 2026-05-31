/**
 * Neutral transaction capability. The library declares this shape; a consumer's adapter
 * implements it (a `pg` pool, a MongoDB client, etc.). It names no engine and contains no SQL —
 * `Driver` is whatever handle that engine hands to a transaction callback.
 */
export interface TransactionClient<Driver = unknown> {
    transaction<T>(fn: (trx: Driver) => Promise<T>): Promise<T>
}
