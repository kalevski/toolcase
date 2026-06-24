import { KeyBuilder } from './keys'
import { LuaScriptCache } from './scripts'
import type { LeaderboardEntry, RedisClient } from './types'

export type LeaderboardDirection = 'asc' | 'desc'

export interface LeaderboardOptions {
	/** Default ranking direction. `desc` (default) ranks highest score first. */
	direction?: LeaderboardDirection
}

export class Leaderboard {

	private readonly direction: LeaderboardDirection

	constructor(
		private readonly client: RedisClient,
		private readonly keys: KeyBuilder,
		private readonly scripts: LuaScriptCache,
		options: LeaderboardOptions = {},
	) {
		this.direction = options.direction ?? 'desc'
	}

	async addScore(boardKey: string, member: string, score: number): Promise<void> {
		await this.client.zAdd(this.keys.build(boardKey), { score, value: member })
	}

	async incrScore(boardKey: string, member: string, delta: number): Promise<number> {
		const reply = await this.client.zIncrBy(this.keys.build(boardKey), delta, member)
		return Number(reply)
	}

	async addScoreAndRank(
		boardKey: string,
		member: string,
		score: number,
	): Promise<{ rank: number | null; score: number }> {
		const reply = (await this.scripts.get('addScoreAndRank').run(this.client, {
			keys: [this.keys.build(boardKey)],
			arguments: [String(score), member, this.direction],
		})) as [number | string, number | string]
		const rank = Number(reply[0])
		return {
			rank: rank < 0 ? null : rank,
			score: Number(reply[1]),
		}
	}

	async topN(boardKey: string, count: number): Promise<LeaderboardEntry[]> {
		if (count <= 0) return []
		const reply = (await this.client.zRangeWithScores(
			this.keys.build(boardKey),
			0,
			count - 1,
			this.direction === 'desc' ? { REV: true } : {},
		)) as unknown as Array<{ value: string; score: number }>
		const out = new Array<LeaderboardEntry>(reply.length)
		for (let i = 0; i < reply.length; i++) {
			const e = reply[i]
			out[i] = { member: e.value, score: e.score }
		}
		return out
	}

	async rankOf(boardKey: string, member: string): Promise<number | null> {
		const reply = this.direction === 'desc'
			? await this.client.zRevRank(this.keys.build(boardKey), member)
			: await this.client.zRank(this.keys.build(boardKey), member)
		return reply === null ? null : Number(reply)
	}
}
