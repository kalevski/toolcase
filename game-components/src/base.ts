import { LitElement } from 'lit'

/**
 * Shared base for all gc-* components. Adds a typed `emit` helper that
 * dispatches a CustomEvent that bubbles and crosses the shadow boundary.
 */
export class GameElement extends LitElement {
    /** Emit a CustomEvent that bubbles and is composed (crosses shadow DOM). */
    protected emit<T = unknown>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }
}

/** Re-export the rarity color helper used across inventory & progression. */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

export const rarityVar = (rarity?: ItemRarity): string => `var(--gc-rarity-${rarity ?? 'common'})`
