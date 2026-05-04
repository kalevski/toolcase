export interface Size {
    width: number
    height: number
}

export interface Rect extends Size {
    x: number
    y: number
}

export interface PlacedRect extends Rect {
    rotated: boolean
}

export interface PixelGrid {
    width: number
    height: number
    alphaAt(x: number, y: number): number
}

export interface Sprite {
    id: string
    width: number
    height: number
    pixels?: PixelGrid
}

export interface PreparedSprite {
    id: string
    width: number
    height: number
    sourceWidth: number
    sourceHeight: number
    sourceOffsetX: number
    sourceOffsetY: number
    rotated: boolean
    pixels?: PixelGrid
}

export interface PlacedSprite extends PreparedSprite {
    rect: Rect
    page: number
}

export interface PackedPage {
    width: number
    height: number
    sprites: PlacedSprite[]
    occupancy: number
}

export interface PackResult {
    pages: PackedPage[]
    unpacked: PreparedSprite[]
}

export type POTMode = 'none' | 'page' | 'square'

export interface AlgorithmOptions {
    maxWidth: number
    maxHeight: number
    allowRotation: boolean
    padding: number
    extrude: number
    pot: POTMode
}

export interface MemoryBudget {
    maxPagePixels?: number
    maxPages?: number
    maxSinglePagePixels?: number
}

export type AlgorithmKind = 'max-rects' | 'guillotine' | 'shelf' | 'skyline' | 'binary-tree'

export type SortStrategy =
    | 'area-desc'
    | 'max-side-desc'
    | 'height-desc'
    | 'width-desc'
    | 'perimeter-desc'

export interface PackerOptions extends AlgorithmOptions {
    algorithm: AlgorithmKind
    sort: SortStrategy | 'none'
    trim: boolean
    alphaThreshold: number
    budget: MemoryBudget
}
