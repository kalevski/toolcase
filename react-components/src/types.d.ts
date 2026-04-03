declare module 'dropzone' {
    class Dropzone {
        constructor(element: HTMLElement, options?: Record<string, unknown>)
        on(event: string, callback: (...args: any[]) => void): void
        destroy(): void
    }
    export default Dropzone
}
