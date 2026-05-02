import React from 'react'

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

const rarityColor: Record<ItemRarity, string> = {
    common: '#9aa3ad',
    uncommon: '#3aa256',
    rare: '#6aa9ff',
    epic: '#c93ad2',
    legendary: '#ffa83a',
    mythic: '#ff5a8a',
}

export interface InventoryItem {
    id: string
    name?: React.ReactNode
    icon?: React.ReactNode
    qty?: number
    maxQty?: number
    rarity?: ItemRarity
    cooldown?: number
    locked?: boolean
    equipped?: boolean
    description?: React.ReactNode
    stats?: Array<{ label: string, value: React.ReactNode, delta?: number }>
    lore?: React.ReactNode
}

export interface ItemSlotProps {
    item?: InventoryItem | null
    selected?: boolean
    size?: number
    onClick?: (item: InventoryItem | null | undefined) => void
    onDragStart?: (item: InventoryItem) => void
    onDrop?: (item: InventoryItem) => void
    style?: React.CSSProperties
    className?: string
}

export const ItemSlot: React.FC<ItemSlotProps> = ({ item, selected, size = 56, onClick, onDragStart, onDrop, style, className }) => {
    const color = item?.rarity ? rarityColor[item.rarity] : 'rgba(255,255,255,0.15)'
    return (
        <div
            className={className}
            draggable={!!item}
            onClick={() => onClick?.(item)}
            onDragStart={() => item && onDragStart?.(item)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => item && onDrop?.(item)}
            style={{ position: 'relative', width: size, height: size, background: 'rgba(15,18,24,0.7)', border: `2px solid ${selected ? '#ffd35a' : color}`, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e6e8ec', fontSize: size * 0.5, cursor: item ? 'pointer' : 'default', ...style }}
        >
            {item?.icon}
            {item?.equipped && <span title="Equipped" style={{ position: 'absolute', top: 1, left: 2, color: '#3aa256', fontSize: 10 }}>E</span>}
            {item?.locked && <span title="Locked" style={{ position: 'absolute', top: 1, right: 2, fontSize: 10 }}>🔒</span>}
            {item?.qty !== undefined && item.qty > 1 && <span style={{ position: 'absolute', bottom: 1, right: 3, fontSize: 11, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{item.qty}</span>}
            {item?.cooldown !== undefined && item.cooldown < 1 && <div style={{ position: 'absolute', inset: 0, background: `conic-gradient(rgba(0,0,0,0.5) ${(1 - item.cooldown) * 360}deg, transparent 0deg)`, pointerEvents: 'none' }} />}
        </div>
    )
}

export interface InventoryGridProps {
    items: Array<InventoryItem | null>
    columns?: number
    slotSize?: number
    selectedId?: string
    onSelect?: (item: InventoryItem | null | undefined, index: number) => void
    onMove?: (from: number, to: number) => void
    style?: React.CSSProperties
    className?: string
}

export const InventoryGrid: React.FC<InventoryGridProps> = ({ items, columns = 8, slotSize = 56, selectedId, onSelect, onMove, style, className }) => {
    const dragIndex = React.useRef<number | null>(null)
    return (
        <div className={className} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, ${slotSize}px)`, gap: 4, ...style }}>
            {items.map((item, index) => (
                <div key={index} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex.current !== null && dragIndex.current !== index) onMove?.(dragIndex.current, index); dragIndex.current = null }}>
                    <ItemSlot item={item} size={slotSize} selected={item?.id === selectedId} onDragStart={() => { dragIndex.current = index }} onClick={(itm) => onSelect?.(itm, index)} />
                </div>
            ))}
        </div>
    )
}

export interface ItemTooltipProps {
    item: InventoryItem
    style?: React.CSSProperties
    className?: string
}

export const ItemTooltip: React.FC<ItemTooltipProps> = ({ item, style, className }) => {
    const color = item.rarity ? rarityColor[item.rarity] : '#e6e8ec'
    return (
        <div className={className} style={{ minWidth: 220, maxWidth: 320, padding: 10, background: 'rgba(8,10,14,0.95)', border: `1px solid ${color}`, borderRadius: 4, color: '#e6e8ec', fontSize: 12, ...style }}>
            <div style={{ fontWeight: 700, color, fontSize: 14 }}>{item.name}</div>
            {item.rarity && <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'capitalize', marginBottom: 6 }}>{item.rarity}</div>}
            {item.description && <div style={{ marginBottom: 6 }}>{item.description}</div>}
            {item.stats && item.stats.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0' }}>
                    {item.stats.map((stat) => (
                        <li key={stat.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ opacity: 0.7 }}>{stat.label}</span>
                            <span>{stat.value}{stat.delta !== undefined && <span style={{ marginLeft: 6, color: stat.delta > 0 ? '#3aa256' : '#d23a3a' }}>{stat.delta > 0 ? '+' : ''}{stat.delta}</span>}</span>
                        </li>
                    ))}
                </ul>
            )}
            {item.lore && <div style={{ fontStyle: 'italic', opacity: 0.6, marginTop: 6, fontSize: 11 }}>{item.lore}</div>}
        </div>
    )
}

export interface ItemCompareProps {
    current?: InventoryItem
    candidate: InventoryItem
    style?: React.CSSProperties
    className?: string
}

export const ItemCompare: React.FC<ItemCompareProps> = ({ current, candidate, style, className }) => (
    <div className={className} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'flex-start', ...style }}>
        {current ? <ItemTooltip item={current} /> : <div style={{ padding: 10, opacity: 0.5, textAlign: 'center' }}>No equipped item</div>}
        <div style={{ alignSelf: 'center', fontSize: 24, color: '#ffd35a' }}>↔</div>
        <ItemTooltip item={candidate} />
    </div>
)

export interface EquipmentSlotConfig {
    id: string
    label?: React.ReactNode
    item?: InventoryItem | null
    /** Position in % of doll bounds. */
    x: number
    y: number
}

export interface EquipmentDollProps {
    slots: EquipmentSlotConfig[]
    silhouette?: React.ReactNode
    onSelect?: (slot: EquipmentSlotConfig) => void
    selectedId?: string
    width?: number
    height?: number
    slotSize?: number
    style?: React.CSSProperties
    className?: string
}

export const EquipmentDoll: React.FC<EquipmentDollProps> = ({ slots, silhouette, onSelect, selectedId, width = 280, height = 380, slotSize = 48, style, className }) => (
    <div className={className} style={{ position: 'relative', width, height, background: 'rgba(15,18,24,0.5)', borderRadius: 6, ...style }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3, fontSize: 120 }}>{silhouette ?? '👤'}</div>
        {slots.map((slot) => (
            <div key={slot.id} style={{ position: 'absolute', left: `${slot.x}%`, top: `${slot.y}%`, transform: 'translate(-50%, -50%)' }}>
                <ItemSlot item={slot.item} selected={selectedId === slot.id} size={slotSize} onClick={() => onSelect?.(slot)} />
                {slot.label && <div style={{ fontSize: 10, opacity: 0.6, textAlign: 'center', marginTop: 2 }}>{slot.label}</div>}
            </div>
        ))}
    </div>
)
export const Paperdoll = EquipmentDoll

export interface CraftingRecipe {
    id: string
    name: React.ReactNode
    icon?: React.ReactNode
    inputs: Array<{ item: InventoryItem, qty: number, available?: number }>
    output: { item: InventoryItem, qty: number }
    craftTime?: number
}

export interface CraftingPanelProps {
    recipes: CraftingRecipe[]
    selectedId?: string
    onSelect?: (id: string) => void
    onCraft?: (id: string) => void
    crafting?: boolean
    style?: React.CSSProperties
    className?: string
}

export const CraftingPanel: React.FC<CraftingPanelProps> = ({ recipes, selectedId, onSelect, onCraft, crafting, style, className }) => {
    const active = recipes.find((recipe) => recipe.id === selectedId) ?? recipes[0]
    return (
        <div className={className} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 12, color: '#e6e8ec', ...style }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 360, overflowY: 'auto' }}>
                {recipes.map((recipe) => (
                    <li key={recipe.id}>
                        <button type="button" onClick={() => onSelect?.(recipe.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: recipe.id === active?.id ? 'rgba(255,255,255,0.08)' : 'transparent', color: '#e6e8ec', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
                            <span style={{ fontSize: 20 }}>{recipe.icon}</span><span>{recipe.name}</span>
                        </button>
                    </li>
                ))}
            </ul>
            {active && (
                <div style={{ padding: 12, background: 'rgba(15,18,24,0.5)', borderRadius: 4 }}>
                    <h3 style={{ margin: '0 0 12px' }}>{active.name}</h3>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Requires</div>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {active.inputs.map((input, i) => {
                                    const enough = input.available === undefined || input.available >= input.qty
                                    return (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <ItemSlot item={input.item} size={40} />
                                            <span style={{ fontSize: 11, color: enough ? '#3aa256' : '#d23a3a' }}>{input.available ?? '?'}/{input.qty}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <div style={{ fontSize: 24, opacity: 0.6 }}>→</div>
                        <div>
                            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Output</div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <ItemSlot item={active.output.item} size={40} />
                                <span style={{ fontSize: 16 }}>×{active.output.qty}</span>
                            </div>
                        </div>
                    </div>
                    <button type="button" disabled={crafting} onClick={() => onCraft?.(active.id)} style={{ width: '100%', padding: '8px 12px', background: '#6aa9ff', color: '#fff', border: 'none', borderRadius: 4, cursor: crafting ? 'not-allowed' : 'pointer', fontWeight: 600 }}>{crafting ? 'Crafting...' : 'Craft'}</button>
                </div>
            )}
        </div>
    )
}

export interface LootListProps {
    items: Array<{ item: InventoryItem, qty?: number }>
    title?: React.ReactNode
    onTake?: (id: string) => void
    onTakeAll?: () => void
    style?: React.CSSProperties
    className?: string
}

export const LootList: React.FC<LootListProps> = ({ items, title = 'Loot', onTake, onTakeAll, style, className }) => (
    <div className={className} style={{ minWidth: 240, padding: 10, background: 'rgba(8,10,14,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#e6e8ec', ...style }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>{title}</strong>
            {onTakeAll && <button type="button" onClick={onTakeAll} style={{ background: 'transparent', color: '#6aa9ff', border: 'none', cursor: 'pointer', fontSize: 12 }}>Take all</button>}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {items.map((entry, i) => (
                <li key={i} onClick={() => onTake?.(entry.item.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 3, cursor: 'pointer' }}>
                    <span style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 2, color: entry.item.rarity ? rarityColor[entry.item.rarity] : '#e6e8ec' }}>{entry.item.icon}</span>
                    <span style={{ flex: 1, color: entry.item.rarity ? rarityColor[entry.item.rarity] : '#e6e8ec' }}>{entry.item.name}</span>
                    {entry.qty !== undefined && entry.qty > 1 && <span style={{ opacity: 0.7 }}>×{entry.qty}</span>}
                </li>
            ))}
        </ul>
    </div>
)

export interface ShopItem {
    item: InventoryItem
    price: number
    currency?: React.ReactNode
    discount?: number
    soldOut?: boolean
}

export interface ShopPanelProps {
    items: ShopItem[]
    sellMode?: boolean
    onBuy?: (id: string) => void
    onSell?: (id: string) => void
    currency?: number
    currencyIcon?: React.ReactNode
    style?: React.CSSProperties
    className?: string
}

export const ShopPanel: React.FC<ShopPanelProps> = ({ items, sellMode = false, onBuy, onSell, currency, currencyIcon = '💰', style, className }) => (
    <div className={className} style={{ color: '#e6e8ec', ...style }}>
        {currency !== undefined && <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginBottom: 8 }}>{currencyIcon}<strong>{currency.toLocaleString()}</strong></div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {items.map((entry) => {
                const finalPrice = entry.discount ? Math.floor(entry.price * (1 - entry.discount)) : entry.price
                return (
                    <div key={entry.item.id} style={{ padding: 10, background: 'rgba(15,18,24,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ItemSlot item={entry.item} size={40} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{entry.item.name}</div>
                                <div style={{ fontSize: 12, opacity: 0.6 }}>{entry.currency ?? currencyIcon} {finalPrice.toLocaleString()}{entry.discount && <span style={{ marginLeft: 4, color: '#3aa256' }}>(-{Math.round(entry.discount * 100)}%)</span>}</div>
                            </div>
                        </div>
                        <button type="button" disabled={entry.soldOut} onClick={() => sellMode ? onSell?.(entry.item.id) : onBuy?.(entry.item.id)} style={{ width: '100%', marginTop: 8, padding: '6px 10px', background: entry.soldOut ? 'rgba(15,18,24,0.5)' : '#6aa9ff', color: '#fff', border: 'none', borderRadius: 3, cursor: entry.soldOut ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12 }}>{entry.soldOut ? 'Sold Out' : sellMode ? 'Sell' : 'Buy'}</button>
                    </div>
                )
            })}
        </div>
    </div>
)

export const Store = ShopPanel

export interface CurrencyDisplayProps {
    amount: number
    icon?: React.ReactNode
    label?: React.ReactNode
    color?: string
    fontSize?: number
    style?: React.CSSProperties
    className?: string
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({ amount, icon = '💰', label, color = '#ffd35a', fontSize = 16, style, className }) => (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color, fontSize, ...style }}>
        {icon}<strong>{amount.toLocaleString()}</strong>{label && <span style={{ opacity: 0.7 }}>{label}</span>}
    </div>
)
