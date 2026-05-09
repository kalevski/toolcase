import type Serializer from '@toolcase/serializer'
import type {
	RedisClientType,
	RedisFunctions,
	RedisModules,
	RedisScripts,
} from 'redis'
import type { LuaScriptCache } from './scripts'

export type RedisClient = RedisClientType<
	RedisModules,
	RedisFunctions,
	RedisScripts
>

export interface KVServiceOptions {
	client: RedisClient
	namespace?: string
	separator?: string
	serializer?: Serializer
	logger?: KVLogger
	onCommand?: KVCommandHook
	onSubscriberError?: (error: unknown, channel: string) => void
	scripts?: LuaScriptCache
}

export interface KVLogger {
	debug?: (msg: string, meta?: Record<string, unknown>) => void
	warn?: (msg: string, meta?: Record<string, unknown>) => void
	error?: (msg: string, meta?: Record<string, unknown>) => void
}

export type KVCommandHook = (
	op: string,
	durationMs: number,
	err?: unknown,
) => void

export interface RateLimitResult {
	allowed: boolean
	count: number
	limit: number
	remaining: number
	resetInSeconds: number
}

export interface LeaderboardEntry {
	member: string
	score: number
}

export type SubscribeHandler<T> = (
	message: T,
	channel: string,
) => void | Promise<void>

export interface Subscription {
	close(): Promise<void>
}
