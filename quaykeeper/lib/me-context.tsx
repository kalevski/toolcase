'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { MeResponse } from '@/server/domain/types'

// Identity context (plan WS-3). `AuthGate` fetches `GET /api/me` once per page
// load, then provides the result here. Descendants (DashboardHome,
// SiteDetail, the admin/routing gates) read it via `useMe()` instead of each
// firing its own `/api/me` request — the limits are already revived by AuthGate,
// so consumers get a ready-to-use payload. Every consumer renders below AuthGate,
// so the context is always populated.

const MeContext = createContext<MeResponse | null>(null)

export function MeProvider({ me, children }: { me: MeResponse; children: ReactNode }) {
    return <MeContext.Provider value={me}>{children}</MeContext.Provider>
}

/** The signed-in identity. Throws if used outside `AuthGate` (a wiring bug). */
export function useMe(): MeResponse {
    const me = useContext(MeContext)
    if (!me) throw new Error('useMe() must be used within an AuthGate-provided MeProvider')
    return me
}
