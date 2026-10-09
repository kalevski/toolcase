import type { Quota } from '../jmap/types'
import { t } from '../i18n'
import { formatBytes } from '../util/format'

/** Storage used: a thin meter and one mono line, "12.4 MB of 1 GB used · 1%". */
export function QuotaBar({ quota }: { quota: Quota | null }) {
    if (!quota || !quota.hardLimit) return null
    const label = t('quota.label', { used: formatBytes(quota.used), total: formatBytes(quota.hardLimit) })
    const percent = Math.min(100, Math.round((quota.used / quota.hardLimit) * 100))
    return (
        <div className="wm-quota">
            <tc-quota-meter
                variant="bar"
                used={quota.used}
                total={quota.hardLimit}
                label-format="none"
                spoken={`${t('quota.spoken')}: ${label}`}
            ></tc-quota-meter>
            <span className="wm-quota__label">
                <span>{label}</span>
                <span className="wm-quota__percent">{t('quota.percent', { percent })}</span>
            </span>
        </div>
    )
}
