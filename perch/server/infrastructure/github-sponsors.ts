// GitHub Sponsors GraphQL integration for the scheduled reconcile (§8). Fetch-based,
// no SDK — the REST sibling is `infrastructure/github.ts`. Queries the owner's
// `viewer.sponsorshipsAsMaintainer` connection with a dedicated owner PAT and
// returns the trimmed nodes; the mapping to `Sponsorship` rows is the pure
// `domain/sponsorship-events.reconcileToSponsorships`.

import 'server-only'
import type { GraphqlSponsorshipNode } from '@/server/domain/sponsorship-events'

export class GithubError extends Error {
    constructor(
        message: string,
        public status?: number,
    ) {
        super(message)
    }
}

const GRAPHQL_URL = 'https://api.github.com/graphql'

// `viewer` is the authenticated maintainer (the PAT owner), so no login arg is
// needed. `includePrivate: true` surfaces private sponsorships too. We page in
// 100s and read `isActive` per node (active vs cancelled) plus the tier price.
const QUERY = `query($cursor: String) {
  viewer {
    sponsorshipsAsMaintainer(first: 100, includePrivate: true, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        isActive
        createdAt
        tier { monthlyPriceInCents }
        sponsorEntity {
          ... on User { login }
          ... on Organization { login }
        }
      }
    }
  }
}`

interface GraphqlResponse {
    data?: {
        viewer?: {
            sponsorshipsAsMaintainer?: {
                pageInfo?: { hasNextPage?: boolean; endCursor?: string | null }
                nodes?: GraphqlSponsorshipNode[]
            }
        }
    }
    errors?: { message?: string }[]
}

/**
 * Fetch every sponsorship the token's owner maintains, following pagination.
 * Throws `GithubError` on a transport failure or a GraphQL `errors` payload so
 * the reconcile job can log and back off without corrupting the table.
 */
export async function fetchSponsorshipsAsMaintainer(token: string): Promise<GraphqlSponsorshipNode[]> {
    const all: GraphqlSponsorshipNode[] = []
    let cursor: string | null = null
    // Bound the loop defensively (100 × 50 = 5000 sponsors) so a malformed
    // `hasNextPage` can never spin forever.
    for (let page = 0; page < 50; page++) {
        const res = await fetch(GRAPHQL_URL, {
            method: 'POST',
            cache: 'no-store',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: QUERY, variables: { cursor } }),
        })
        if (!res.ok) {
            const detail = await res
                .json()
                .then((d: any) => d?.message ?? '')
                .catch(() => '')
            throw new GithubError(`GitHub GraphQL failed (${res.status})${detail ? `: ${detail}` : ''}`, res.status)
        }
        const body = (await res.json()) as GraphqlResponse
        if (body.errors && body.errors.length > 0) {
            throw new GithubError(`GitHub GraphQL errors: ${body.errors.map((e) => e.message ?? '?').join('; ')}`)
        }
        const conn = body.data?.viewer?.sponsorshipsAsMaintainer
        if (conn?.nodes) all.push(...conn.nodes)
        if (!conn?.pageInfo?.hasNextPage || !conn.pageInfo.endCursor) break
        cursor = conn.pageInfo.endCursor
    }
    return all
}
