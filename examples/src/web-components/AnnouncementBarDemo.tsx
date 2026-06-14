import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const AnnouncementBarDemo: React.FC = () => {
    const dismissibleRef = useRef<any>(null)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        const el = dismissibleRef.current
        if (!el) return
        const handler = () => {
            setDismissed(true)
            console.log('tc-dismiss fired')
        }
        el.addEventListener('tc-dismiss', handler)
        return () => el.removeEventListener('tc-dismiss', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Announcement Bar"
                            description="Persistent announcement bar with optional CTA link, icon, and localStorage-backed dismissal. Supports info, success, warning, and announce variants."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Variants">
                                <div className="d-flex flex-column gap-2">
                                    {/* @ts-ignore */}
                                    <tc-announcement-bar variant="info">
                                        New docs are available — check them out.
                                    {/* @ts-ignore */}
                                    </tc-announcement-bar>
                                    {/* @ts-ignore */}
                                    <tc-announcement-bar variant="success">
                                        Your workspace has been updated successfully.
                                    {/* @ts-ignore */}
                                    </tc-announcement-bar>
                                    {/* @ts-ignore */}
                                    <tc-announcement-bar variant="warning">
                                        Maintenance window scheduled for Sunday 02:00 UTC.
                                    {/* @ts-ignore */}
                                    </tc-announcement-bar>
                                    {/* @ts-ignore */}
                                    <tc-announcement-bar variant="announce">
                                        Toolcase v3 is here — explore the new component library.
                                    {/* @ts-ignore */}
                                    </tc-announcement-bar>
                                </div>
                            </SectionCard>

                            <SectionCard title="With icon (icon-name attribute)">
                                <div className="d-flex flex-column gap-2">
                                    {/* @ts-ignore */}
                                    <tc-announcement-bar variant="info" icon-name="info">
                                        System status: all services are operational.
                                    {/* @ts-ignore */}
                                    </tc-announcement-bar>
                                    {/* @ts-ignore */}
                                    <tc-announcement-bar variant="success" icon-name="check-circle">
                                        Deployment complete — zero downtime.
                                    {/* @ts-ignore */}
                                    </tc-announcement-bar>
                                    {/* @ts-ignore */}
                                    <tc-announcement-bar variant="warning" icon-name="triangle-alert">
                                        Some features may be degraded during peak hours.
                                    {/* @ts-ignore */}
                                    </tc-announcement-bar>
                                    {/* @ts-ignore */}
                                    <tc-announcement-bar variant="announce" icon-name="megaphone">
                                        Join our next community call on June 20 — RSVP now.
                                    {/* @ts-ignore */}
                                    </tc-announcement-bar>
                                </div>
                            </SectionCard>

                            <SectionCard title="With CTA link">
                                <div className="d-flex flex-column gap-2">
                                    {/* @ts-ignore */}
                                    <tc-announcement-bar variant="info" icon-name="info" cta-label="Read the changelog" cta-href="#changelog">
                                        Version 3.2.0 includes breaking changes to the token API.
                                    {/* @ts-ignore */}
                                    </tc-announcement-bar>
                                    {/* @ts-ignore */}
                                    <tc-announcement-bar variant="announce" icon-name="star" cta-label="Learn more →" cta-href="#announce">
                                        Toolcase is now open-source. Give it a star on GitHub.
                                    {/* @ts-ignore */}
                                    </tc-announcement-bar>
                                </div>
                            </SectionCard>

                            <SectionCard title="Dismissible — fires tc-dismiss event on close">
                                <p className="text-muted small mb-2">
                                    {dismissed
                                        ? 'Bar dismissed — tc-dismiss fired (check console).'
                                        : 'Click × to dismiss. The tc-dismiss event is logged to the console.'}
                                </p>
                                {/* @ts-ignore */}
                                <tc-announcement-bar
                                    ref={dismissibleRef}
                                    variant="warning"
                                    icon-name="triangle-alert"
                                    dismissible
                                    cta-label="Upgrade now"
                                    cta-href="#upgrade"
                                >
                                    Your trial expires in 3 days. Upgrade to keep your data.
                                {/* @ts-ignore */}
                                </tc-announcement-bar>
                            </SectionCard>

                            <SectionCard title="Persistent dismissal (localStorage-backed)">
                                <p className="text-muted small mb-2">
                                    Closing this bar writes <code>"dismissed"</code> to{' '}
                                    <code>localStorage["tc-demo-announcement"]</code>. It stays hidden
                                    on reload. Clear the key in DevTools to see it again.
                                </p>
                                {/* @ts-ignore */}
                                <tc-announcement-bar
                                    variant="announce"
                                    icon-name="bell"
                                    dismissible
                                    persist-dismiss-key="tc-demo-announcement"
                                    cta-label="See what's new"
                                    cta-href="#new"
                                >
                                    Toolcase Web Components are now available in v3.
                                {/* @ts-ignore */}
                                </tc-announcement-bar>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AnnouncementBarDemo
