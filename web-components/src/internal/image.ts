// True when a string looks like an image source (URL, path, data-image URI, or a
// recognised image file extension) rather than a lucide icon name. Single source
// of truth for the item-art heuristic shared by the inventory/slot widgets.
export function isImageSrc(value: string): boolean {
    return (
        /^(https?:|\/|\.\/|\.\.\/|data:image\/)/.test(value) ||
        /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(value)
    )
}
