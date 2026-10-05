import { useState } from 'react'
import type { Branding } from '../api/session'
import { isHttpUrl } from '../util/safe'

/** Domain logo (only an http(s) URL is ever used as an img src) plus its name. */
export function BrandMark({ branding, size = 'md' }: { branding: Branding; size?: 'md' | 'lg' }) {
    const [broken, setBroken] = useState<string | null>(null)
    const logo = isHttpUrl(branding.logoUrl) && broken !== branding.logoUrl ? branding.logoUrl : ''
    return (
        <span className={`wm-brand wm-brand--${size}`}>
            {logo ? (
                <img
                    className="wm-brand__logo"
                    src={logo}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setBroken(logo)}
                />
            ) : (
                <span className="wm-brand__dot" aria-hidden="true" />
            )}
            <span className="wm-brand__name">{branding.name}</span>
        </span>
    )
}
