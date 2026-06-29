'use client'

import { useCallback, useMemo } from 'react'
import type { TableColumn } from '@toolcase/web-components'
import { escapeHtml } from '@/lib/tc'
import type { NginxpilotCert } from '@/server/infrastructure/nginxpilot'
import { AdminPage, json, useOwnerData } from './shared'
import { DataTable } from '@/components/DataTable'

// Read-only view of the TLS certificates nginxpilot has discovered in its cert
// directory for the owner's active realm (GET /api/admin/certificates → the
// daemon's GET /certs). nginxpilot only *consumes* certs — certbot/acme.sh/external
// tools issue and renew them — so this page never creates, edits, or deletes:
// no row actions, no mutations. Metadata only; no key material ever crosses the wire.

interface CertRow extends Record<string, unknown> {
    domain: string
    names: string[]
    issuer?: string
    notAfter?: string
    modTime: string
}

/** A Bootstrap-compatible pill (painted by tc-* style.css), as AdminRealms uses. */
function badge(variant: string, text: string): string {
    return `<span class="badge text-bg-${variant}">${escapeHtml(text)}</span>`
}

const MUTED = '<span class="perch-admin-hint">—</span>'

/** Localised short date, or a muted dash when absent/unparseable. */
function fmtDate(iso?: string): string {
    if (!iso) return MUTED
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return escapeHtml(iso)
    return escapeHtml(
        d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
    )
}

// Expiry as a coloured pill + date: danger once past, warning inside the 30-day
// renewal window (certbot renews at 30d), success otherwise. No not_after (an
// unparseable cert) collapses to a muted dash.
function expiryCell(notAfter?: string): string {
    if (!notAfter) return MUTED
    const d = new Date(notAfter)
    if (Number.isNaN(d.getTime())) return escapeHtml(notAfter)
    const days = Math.floor((d.getTime() - Date.now()) / 86_400_000)
    const pill =
        days < 0
            ? badge('danger', 'expired')
            : days <= 30
              ? badge('warning', `${days}d left`)
              : badge('success', `${days}d left`)
    return `${pill} <span class="perch-admin-hint">${fmtDate(notAfter)}</span>`
}

const CERT_COLUMNS: TableColumn[] = [
    {
        key: 'domain',
        header: 'Domain',
        render: (row: CertRow) => `<span class="perch-admin-mono">${escapeHtml(row.domain)}</span>`,
    },
    {
        key: 'names',
        header: 'SAN names',
        render: (row: CertRow) =>
            row.names.length
                ? `<span class="perch-admin-mono perch-admin-hint">${escapeHtml(row.names.join(', '))}</span>`
                : MUTED,
    },
    {
        key: 'issuer',
        header: 'Issuer',
        render: (row: CertRow) => (row.issuer ? escapeHtml(row.issuer) : MUTED),
    },
    {
        key: 'notAfter',
        header: 'Expires',
        render: (row: CertRow) => expiryCell(row.notAfter),
    },
    {
        key: 'modTime',
        header: 'Updated',
        align: 'right',
        render: (row: CertRow) => `<span class="perch-admin-hint">${fmtDate(row.modTime)}</span>`,
    },
]

export function AdminCertificates() {
    const fetcher = useCallback(async (): Promise<NginxpilotCert[] | null> => {
        try {
            return await fetch('/api/admin/certificates', { cache: 'no-store' }).then((r) =>
                json<NginxpilotCert[]>(r),
            )
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useOwnerData(fetcher)

    return (
        <AdminPage
            title="Certificates"
            subtitle="The TLS certificates nginxpilot discovered in its cert directory for the active realm. Issued and renewed externally (certbot / acme.sh) — read-only here."
            icon="shield-check"
            iconColor="emerald"
            state={state}
            onRetry={() => void reload()}
        >
            {(certs) => <CertificatesList certs={certs} />}
        </AdminPage>
    )
}

function CertificatesList({ certs }: { certs: NginxpilotCert[] }) {
    const rows = useMemo<CertRow[]>(
        () =>
            certs.map((c) => ({
                domain: c.domain,
                names: c.names,
                issuer: c.issuer,
                notAfter: c.not_after,
                modTime: c.mod_time,
            })),
        [certs],
    )

    return (
        <tc-section-card title="Discovered certificates" icon="shield-check">
            <div className="perch-admin-section">
                <p className="perch-home-lead perch-admin-hint">
                    nginxpilot scans its cert directory (certbot live or flat layout) and wires each
                    cert into the matching site or proxy. This list reads disk fresh, so renewals
                    show on reload.
                </p>
                {rows.length === 0 ? (
                    <tc-empty-state icon="shield-check">
                        No certificates discovered. nginxpilot has no cert directory configured, or
                        it’s empty.
                    </tc-empty-state>
                ) : (
                    <DataTable<CertRow>
                        columns={CERT_COLUMNS}
                        rows={rows}
                        rowKey={(row) => row.domain}
                    />
                )}
            </div>
        </tc-section-card>
    )
}
