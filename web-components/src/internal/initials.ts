// Derive up-to-two-letter initials from a display name: first letter of the
// first and last word (or the first letter alone for a single word). `empty` is
// returned for a blank name (components differ: '' for avatars, '?' for tiles).
export function deriveInitials(name: string, empty = ''): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return empty
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}
