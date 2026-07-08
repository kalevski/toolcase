// Upload option validation (spec §6.3) — pure and client-shared, so the upload
// form can show the exact errors the API enforces. Returns a discriminated
// `{ ok: true, value } | { ok: false, error: { field, message } }`.

export interface UploadOptionsInput {
    title?: string
    language?: string
    model?: string
    translate?: boolean
}

export interface UploadOptions {
    /** Empty string = derive from the original filename. */
    title: string
    language: string
    model: string
    translate: boolean
}

export type ValidationResult<T> =
    | { ok: true; value: T }
    | { ok: false; error: { field: string; message: string } }

/** Accepted upload containers (spec §4.1). True validation is ffprobe on the stored file. */
export const ACCEPTED_EXTENSIONS = [
    'mp3',
    'wav',
    'm4a',
    'aac',
    'flac',
    'ogg',
    'opus',
    'webm',
    'mp4',
    'mov',
    'mkv',
] as const

export const TITLE_MAX_CHARS = 200

// The whisper.cpp language set ('auto' + the ISO 639-1 codes it supports).
// Kept as a flat allow-list so validation never accepts free text (§6.3).
export const WHISPER_LANGUAGES = [
    'auto',
    'en', 'zh', 'de', 'es', 'ru', 'ko', 'fr', 'ja', 'pt', 'tr', 'pl', 'ca', 'nl',
    'ar', 'sv', 'it', 'id', 'hi', 'fi', 'vi', 'he', 'uk', 'el', 'ms', 'cs', 'ro',
    'da', 'hu', 'ta', 'no', 'th', 'ur', 'hr', 'bg', 'lt', 'la', 'mi', 'ml', 'cy',
    'sk', 'te', 'fa', 'lv', 'bn', 'sr', 'az', 'sl', 'kn', 'et', 'mk', 'br', 'eu',
    'is', 'hy', 'ne', 'mn', 'bs', 'kk', 'sq', 'sw', 'gl', 'mr', 'pa', 'si', 'km',
    'sn', 'yo', 'so', 'af', 'oc', 'ka', 'be', 'tg', 'sd', 'gu', 'am', 'yi', 'lo',
    'uz', 'fo', 'ht', 'ps', 'tk', 'nn', 'mt', 'sa', 'lb', 'my', 'bo', 'tl', 'mg',
    'as', 'tt', 'haw', 'ln', 'ha', 'ba', 'jw', 'su', 'yue',
] as const

/** File extension (lowercase, without the dot) or null when there is none. */
export function extensionOf(filename: string): string | null {
    const dot = filename.lastIndexOf('.')
    if (dot <= 0 || dot === filename.length - 1) return null
    return filename.slice(dot + 1).toLowerCase()
}

export function isAcceptedExtension(ext: string): boolean {
    return (ACCEPTED_EXTENSIONS as readonly string[]).includes(ext.toLowerCase())
}

/** Title from a filename: strip the extension, trim, cap length. */
export function titleFromFilename(filename: string): string {
    const dot = filename.lastIndexOf('.')
    const base = dot > 0 ? filename.slice(0, dot) : filename
    const trimmed = base.trim()
    return (trimmed || 'Untitled').slice(0, TITLE_MAX_CHARS)
}

/**
 * Validate upload options against the operator's model allow-list. `large` is
 * rejected regardless of the allow-list (RAM budget, spec §2).
 */
export function validateUploadOptions(
    input: UploadOptionsInput,
    allowedModels: string[],
    defaultModel: string,
): ValidationResult<UploadOptions> {
    const title = (input.title ?? '').trim()
    if (title.length > TITLE_MAX_CHARS) {
        return { ok: false, error: { field: 'title', message: `title must be at most ${TITLE_MAX_CHARS} characters` } }
    }

    const language = (input.language ?? 'auto').trim().toLowerCase() || 'auto'
    if (!(WHISPER_LANGUAGES as readonly string[]).includes(language)) {
        return { ok: false, error: { field: 'language', message: `unsupported language '${language}'` } }
    }

    const model = (input.model ?? '').trim() || defaultModel
    if (model === 'large') {
        return { ok: false, error: { field: 'model', message: 'the large model is not allowed on this hardware' } }
    }
    if (!allowedModels.includes(model)) {
        return { ok: false, error: { field: 'model', message: `model '${model}' is not in the allow-list` } }
    }

    return { ok: true, value: { title, language, model, translate: Boolean(input.translate) } }
}

/** Validate a rename (PATCH). */
export function validateTitle(raw: unknown): ValidationResult<string> {
    if (typeof raw !== 'string' || raw.trim() === '') {
        return { ok: false, error: { field: 'title', message: 'title is required' } }
    }
    const title = raw.trim()
    if (title.length > TITLE_MAX_CHARS) {
        return { ok: false, error: { field: 'title', message: `title must be at most ${TITLE_MAX_CHARS} characters` } }
    }
    return { ok: true, value: title }
}
