export default class ProxyHandler<T> {

    protected ref: T | null = null

    protected proxyList: ProxyHandler<T>[] = []

    setRef(ref: T): void {
        this.ref = ref
        for (const child of this.proxyList) {
            child.setRef(ref)
        }
    }

    getRef(): T | null {
        return this.ref
    }

    removeRef(): void {
        this.ref = null
        for (const child of this.proxyList) {
            child.removeRef()
        }
    }

}
