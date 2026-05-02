import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const KeyBinderDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [last, setLast] = useState<string>('—')

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const change = (event: any) => setLast(`change: ${event.detail.value} (${event.detail.code})`)
        const cancel = () => setLast('cancel')
        el.addEventListener('change', change)
        el.addEventListener('cancel', cancel)
        return () => {
            el.removeEventListener('change', change)
            el.removeEventListener('cancel', cancel)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Key Binder"
                        description="Click to capture next keystroke. Escape cancels. Emits 'change' or 'cancel'."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Interactive — ${last}`} />
                            {/* @ts-ignore */}
                            <gc-key-binder ref={ref} />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Pre-bound" />
                            {/* @ts-ignore */}
                            <gc-key-binder value="W" />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Empty / placeholder" />
                            {/* @ts-ignore */}
                            <gc-key-binder placeholder="Press to bind…" />
                        {/* @ts-ignore */}
                        </gc-panel>
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Disabled" />
                            {/* @ts-ignore */}
                            <gc-key-binder value="Space" disabled />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default KeyBinderDemo
