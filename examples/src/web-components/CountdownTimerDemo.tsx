import React, { useEffect, useRef, useMemo, useState } from 'react'

const CountdownTimerDemo: React.FC = () => {
    const now = useMemo(() => Date.now(), [])
    const baseTarget = String(now + 5 * 60 * 1000 + 30 * 1000) // 5 min 30 sec from load

    const customRef = useRef<any>(null)
    const expireRef = useRef<any>(null)
    const [expireFired, setExpireFired] = useState(false)

    useEffect(() => {
        const el = customRef.current
        if (!el) return
        el.units = ['hours', 'minutes', 'seconds']
        el.target = new Date(now + 2 * 3600 * 1000)
    }, [])

    useEffect(() => {
        const el = expireRef.current
        if (!el) return
        // target 3 seconds from mount so the expire event fires quickly in the demo
        el.target = new Date(now + 3000)
        const handler = () => setExpireFired(true)
        el.addEventListener('tc-expire', handler)
        return () => el.removeEventListener('tc-expire', handler)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Countdown Timer"
                            description="Counts down to a target date in configurable units. Visibility-aware updates keep the timer accurate when the tab is backgrounded."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — all four units">
                                {/* @ts-ignore */}
                                <tc-countdown-timer
                                    target={baseTarget}
                                    label="Launch in"
                                    sub-label="Get ready for launch!"
                                />
                            </tc-section-card>

                            <tc-section-card title="Compact mode">
                                {/* @ts-ignore */}
                                <tc-countdown-timer target={baseTarget} compact label="Time left" />
                            </tc-section-card>

                            <tc-section-card title="Custom units — hours · minutes · seconds (JS property)">
                                {/* @ts-ignore */}
                                <tc-countdown-timer ref={customRef} label="Session ends in" />
                            </tc-section-card>

                            <tc-section-card title="Expire event (fires after 3 s)">
                                {/* @ts-ignore */}
                                <tc-countdown-timer ref={expireRef} label="Expiring soon" />
                                {expireFired && (
                                    <div className="form-text mt-2 text-success">
                                        ✓ <code>tc-expire</code> event fired — timer has expired.
                                    </div>
                                )}
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CountdownTimerDemo
