import { useState } from 'react'
import { GcPage, GcSection } from './_demo'
import '@toolcase/game-components'

export const ListRowDemo = () => {
    const [selected, setSelected] = useState('a')
    const items = [
        { id: 'a', name: 'Knell-Steel Longsword', price: 1240 },
        { id: 'b', name: "Yew Hunter's Bow", price: 480 },
        { id: 'c', name: 'Heart-Salve', price: 64 },
        { id: 'd', name: 'Tome of the Pale March', price: 3800 },
    ]
    return (
        <GcPage category="Primitives — Atoms" title="gc-list-row" lede="Selectable list row with left-accent highlight on selection.">
            <GcSection title="Live demo">
                <div style={{ width: 380 }}>
                    {items.map((item) => (
                        <gc-list-row
                            key={item.id}
                            selected={selected === item.id || undefined}
                            onSelect={() => setSelected(item.id)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: '#e8dcc4' }}>
                                <span>{item.name}</span>
                                <span style={{ color: '#f0d27a', fontFamily: 'monospace' }}>◉ {item.price}</span>
                            </div>
                        </gc-list-row>
                    ))}
                </div>
            </GcSection>
        </GcPage>
    )
}

export default ListRowDemo
