import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const OPTIONS = [
    { id: 'sword', icon: '⚔', label: 'Sword', color: '#f0d27a' },
    { id: 'bow', icon: '🏹', label: 'Bow', color: '#9fc55a' },
    { id: 'staff', icon: '✦', label: 'Staff', color: '#b878e8' },
    { id: 'shield', icon: '🛡', label: 'Shield', color: '#5fb8d4' },
    { id: 'potion', icon: '⚕', label: 'Potion', color: '#d44a3a' },
    { id: 'horn', icon: '☩', label: 'Horn', color: '#c5cfd6', disabled: true }
]

const RadialWheelDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)
    const [open, setOpen] = useState(false)
    const [last, setLast] = useState('—')

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.options = OPTIONS
    }, [])

    useEffect(() => {
        if (!ref.current) return
        if (open) ref.current.setAttribute('open', '')
        else ref.current.removeAttribute('open')
    }, [open])

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onSelect = (e: any) => {
            setLast(`select ${e.detail.id}`)
            setOpen(false)
        }
        const onClose = () => setOpen(false)
        el.addEventListener('select', onSelect)
        el.addEventListener('close', onClose)
        return () => {
            el.removeEventListener('select', onSelect)
            el.removeEventListener('close', onClose)
        }
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="RadialWheel"
                        description="Modal radial menu with hover label, disabled options, Escape and backdrop close."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title={`Last — ${last}`} />
                            <button
                                type="button"
                                onClick={() => setOpen(true)}
                                style={{
                                    fontFamily: 'var(--fg-display)',
                                    letterSpacing: '0.18em',
                                    textTransform: 'uppercase',
                                    fontSize: 12,
                                    padding: '10px 22px',
                                    background: 'linear-gradient(180deg, #5a3a18, #2a1a0a)',
                                    color: 'var(--fg-gold-bright)',
                                    border: '1px solid var(--fg-gold)',
                                    cursor: 'pointer'
                                }}
                            >
                                Open Wheel
                            </button>
                            {/* @ts-ignore */}
                            <gc-radial-wheel ref={ref} radius="100" option-size="56" center-label="Choose" />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RadialWheelDemo
