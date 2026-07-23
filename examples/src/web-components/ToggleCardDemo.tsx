import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const ToggleCardDemo: React.FC = () => {
    const [notifications, setNotifications] = useState(true)

    // Wire the controlled card's tc-change event + checked prop sync.
    const notificationsRef = useTc<HTMLElement>(
        { checked: notifications },
        {
            'tc-change': (e: Event) => {
                setNotifications((e as CustomEvent<{ checked: boolean }>).detail.checked)
            },
        }
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ToggleCard"
                            description="Clickable card with an integrated toggle switch for on/off states. The whole card is the click target; Space/Enter toggles when focused. Supports a leading icon, a hint line, a badge, plus disabled and loading states."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card
                                title={`Controlled (notifications: ${notifications ? 'on' : 'off'})`}
                            >
                                <div className="d-flex flex-column gap-2" style={{ maxWidth: 520 }}>
                                    {/* @ts-ignore */}
                                    <tc-toggle-card
                                        ref={notificationsRef}
                                        label="Notifications"
                                        hint="Receive email and push notifications"
                                        icon="bell"
                                    />
                                </div>
                                <div className="d-flex gap-2 mt-3 flex-wrap">
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setNotifications(true)}
                                    >
                                        Turn on
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-secondary"
                                        onClick={() => setNotifications(false)}
                                    >
                                        Turn off
                                    </button>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Basic toggles (uncontrolled)">
                                <div className="d-flex flex-column gap-2" style={{ maxWidth: 520 }}>
                                    {/* @ts-ignore */}
                                    <tc-toggle-card
                                        label="Dark Mode"
                                        hint="Use dark theme across the app"
                                        icon="moon"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-toggle-card
                                        label="Analytics"
                                        hint="Collect anonymous usage data"
                                        icon="line-chart"
                                        checked
                                    />
                                    {/* @ts-ignore */}
                                    <tc-toggle-card
                                        label="Auto-save"
                                        hint="Save changes automatically every 30 seconds"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="With badge">
                                <div className="d-flex flex-column gap-2" style={{ maxWidth: 520 }}>
                                    {/* @ts-ignore */}
                                    <tc-toggle-card
                                        label="Beta Features"
                                        hint="Try experimental features before release"
                                        icon="rocket"
                                        badge="Beta"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-toggle-card
                                        label="Premium Support"
                                        hint="Priority support channel access"
                                        icon="star"
                                        badge="Pro"
                                        checked
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled & loading">
                                <div className="d-flex flex-column gap-2" style={{ maxWidth: 520 }}>
                                    {/* @ts-ignore */}
                                    <tc-toggle-card
                                        label="Two-Factor Auth"
                                        hint="This setting is managed by your organization"
                                        icon="shield"
                                        checked
                                        disabled
                                    />
                                    {/* @ts-ignore */}
                                    <tc-toggle-card
                                        label="Syncing settings"
                                        hint="Fetching the latest configuration"
                                        icon="refresh-cw"
                                        loading
                                    />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ToggleCardDemo
