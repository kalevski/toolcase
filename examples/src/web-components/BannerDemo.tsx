import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const BannerDemo: React.FC = () => {
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
                            title="Banner"
                            description="Status banner with a leading icon, body content, an optional action slot, and persistent localStorage-backed dismissal. Supports info, warning, success, and error variants."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Variants">
                                <div className="d-flex flex-column gap-2">
                                    {/* @ts-ignore */}
                                    <tc-banner variant="info">
                                        New documentation is available — check it out.
                                    {/* @ts-ignore */}
                                    </tc-banner>
                                    {/* @ts-ignore */}
                                    <tc-banner variant="warning">
                                        Maintenance window scheduled for Sunday 02:00 UTC.
                                    {/* @ts-ignore */}
                                    </tc-banner>
                                    {/* @ts-ignore */}
                                    <tc-banner variant="success">
                                        Your changes have been saved successfully.
                                    {/* @ts-ignore */}
                                    </tc-banner>
                                    {/* @ts-ignore */}
                                    <tc-banner variant="error">
                                        Failed to connect to the server. Please try again.
                                    {/* @ts-ignore */}
                                    </tc-banner>
                                </div>
                            </SectionCard>

                            <SectionCard title="Custom icon (icon attribute)">
                                <div className="d-flex flex-column gap-2">
                                    {/* @ts-ignore */}
                                    <tc-banner variant="info" icon="bell">
                                        You have 3 unread notifications.
                                    {/* @ts-ignore */}
                                    </tc-banner>
                                    {/* @ts-ignore */}
                                    <tc-banner variant="success" icon="rocket">
                                        Deployment to production completed in 42 seconds.
                                    {/* @ts-ignore */}
                                    </tc-banner>
                                    {/* @ts-ignore */}
                                    <tc-banner variant="warning" icon="clock">
                                        Your session will expire in 5 minutes.
                                    {/* @ts-ignore */}
                                    </tc-banner>
                                </div>
                            </SectionCard>

                            <SectionCard title="With action slot">
                                <div className="d-flex flex-column gap-2">
                                    {/* @ts-ignore */}
                                    <tc-banner variant="info">
                                        A new version of the dashboard is available.
                                        {/* @ts-ignore */}
                                        <tc-button slot="action" variant="primary" size="sm">
                                            Update now
                                        {/* @ts-ignore */}
                                        </tc-button>
                                    {/* @ts-ignore */}
                                    </tc-banner>
                                    {/* @ts-ignore */}
                                    <tc-banner variant="warning">
                                        Your trial expires in 3 days. Upgrade to keep your data.
                                        {/* @ts-ignore */}
                                        <tc-button slot="action" variant="warning" size="sm">
                                            Upgrade plan
                                        {/* @ts-ignore */}
                                        </tc-button>
                                    {/* @ts-ignore */}
                                    </tc-banner>
                                </div>
                            </SectionCard>

                            <SectionCard title="Dismissible — fires tc-dismiss on close">
                                <p className="text-muted small mb-2">
                                    {dismissed
                                        ? 'Banner dismissed — tc-dismiss fired (check console).'
                                        : 'Click × to dismiss. The tc-dismiss event is logged to the console.'}
                                </p>
                                {/* @ts-ignore */}
                                <tc-banner
                                    ref={dismissibleRef}
                                    variant="warning"
                                    dismissible
                                >
                                    Scheduled downtime on Friday 23:00 UTC. Save your work.
                                {/* @ts-ignore */}
                                </tc-banner>
                            </SectionCard>

                            <SectionCard title="Persistent dismissal (localStorage-backed)">
                                <p className="text-muted small mb-2">
                                    Closing this banner writes <code>"dismissed"</code> to{' '}
                                    <code>localStorage["tc-demo-banner"]</code>. It stays hidden on
                                    reload. Clear the key in DevTools to see it again.
                                </p>
                                {/* @ts-ignore */}
                                <tc-banner
                                    variant="success"
                                    dismissible
                                    storage-key="tc-demo-banner"
                                >
                                    Toolcase Web Components v3 is now available. Enjoy the new components!
                                {/* @ts-ignore */}
                                </tc-banner>
                            </SectionCard>

                            <SectionCard title="Preset alias: tc-announcement-bar (announce + CTA link)">
                                <div className="d-flex flex-column gap-2">
                                    {/* @ts-ignore */}
                                    <tc-announcement-bar variant="announce" icon-name="megaphone" cta-label="Learn more →" cta-href="#announce">
                                        Toolcase v3 is here — explore the new component library.
                                    {/* @ts-ignore */}
                                    </tc-announcement-bar>
                                    {/* @ts-ignore */}
                                    <tc-announcement-bar variant="info" icon-name="info" dismissible persist-dismiss-key="tc-demo-announcement">
                                        New docs are available — uses the legacy persist-dismiss-key attribute.
                                    {/* @ts-ignore */}
                                    </tc-announcement-bar>
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BannerDemo
