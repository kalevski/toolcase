export function register(): void {
    if (customElements.get('tc-button') !== undefined) {
        return
    }
    // Component define calls are appended here by later tasks.
}
