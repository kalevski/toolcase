'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { MeResponse } from '@/server/domain/types'

// Identity context. `AuthGate` fetches `GET /api/me` once per page load, then
// provides the result here; descendants read it via `useMe()` instead of each
// firing its own `/api/me` request.

const MeContext = createContext<MeResponse | null>(null)

export function MeProvider({ me, children }: { me: MeResponse; children: ReactNode }) {
    return <MeContext.Provider value={me}>{children}</MeContext.Provider>
}

/** The signed-in identity. Throws if used outside an AuthGate-provided MeProvider. */
export function useMe(): MeResponse {
    const me = useContext(MeContext)
    if (!me) throw new Error('useMe() must be used within an AuthGate-provided MeProvider')
    return me
}
