import type { Quota } from '../jmap/types'
import { t } from '../i18n'
import { formatBytes } from '../util/format'

export function QuotaBar({ quota }: { quota: Quota | null }) {
    if (!quota || !quota.hardLimit) return null
    const label = t('quota.label', { used: formatBytes(quota.used), total: formatBytes(quota.hardLimit) })
    return (
        <div className="wm-quota">
            <tc-quota-meter
                variant="bar"
                used={quota.used}
                total={quota.hardLimit}
                label-format="none"
                spoken={`${t('quota.spoken')}: ${label}`}
            ></tc-quota-meter>
            <span className="wm-quota__label">{label}</span>
        </div>
    )
}
