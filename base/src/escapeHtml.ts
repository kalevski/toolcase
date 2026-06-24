const ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}

function escapeHtml(input: string): string {
    return input.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch])
}

export default escapeHtml
