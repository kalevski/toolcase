import { PhysicsEditorSource } from './types'

/**
 * Decodes encoded image bytes (or a Blob) to RGBA pixels via `createImageBitmap`
 * + an offscreen canvas. `createImageBitmap` sniffs the encoding from the bytes,
 * so PNG / JPEG / GIF / WebP all decode without an explicit MIME type; pass a
 * typed `Blob` when the byte sniff would be ambiguous.
 */
export const decodeSource = async (
    src: PhysicsEditorSource,
): Promise<{ rgba: Uint8ClampedArray; width: number; height: number }> => {
    const blob = src instanceof Blob ? src : new Blob([src as BlobPart])
    const bitmap = await createImageBitmap(blob)
    const c = document.createElement('canvas')
    c.width = bitmap.width
    c.height = bitmap.height
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, c.width, c.height)
    bitmap.close?.()
    return { rgba: data, width: c.width, height: c.height }
}
