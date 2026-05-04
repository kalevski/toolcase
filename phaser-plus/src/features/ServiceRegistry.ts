type ServiceClass<T> = new () => T
type ServiceFactory<T> = () => T

export default class ServiceRegistry {

    private readonly services: Map<ServiceClass<unknown>, unknown> = new Map()

    private readonly factories: Map<ServiceClass<unknown>, ServiceFactory<unknown>> = new Map()

    /**
     * Resolve (and lazy-construct) a singleton instance for the given service class.
     */
    resolve<T>(serviceClass: ServiceClass<T>): T {
        this.assertClass(serviceClass)
        if (this.services.has(serviceClass)) {
            return this.services.get(serviceClass) as T
        }
        const factory = this.factories.get(serviceClass) as ServiceFactory<T> | undefined
        const instance = factory ? factory() : new serviceClass()
        this.services.set(serviceClass, instance)
        return instance
    }

    /**
     * Bind a custom factory for a service class. Useful when the constructor
     * needs arguments. Calling `resolve` afterwards returns the factory output.
     */
    bind<T>(serviceClass: ServiceClass<T>, factory: ServiceFactory<T>): this {
        this.assertClass(serviceClass)
        this.factories.set(serviceClass, factory as ServiceFactory<unknown>)
        return this
    }

    /**
     * Inject a pre-built instance for a service class.
     */
    provide<T>(serviceClass: ServiceClass<T>, instance: T): this {
        this.assertClass(serviceClass)
        this.services.set(serviceClass, instance)
        return this
    }

    has<T>(serviceClass: ServiceClass<T>): boolean {
        return this.services.has(serviceClass)
    }

    dispose<T>(serviceClass: ServiceClass<T>): void {
        this.assertClass(serviceClass)
        this.services.delete(serviceClass)
    }

    disposeAll(): void {
        this.services.clear()
        this.factories.clear()
    }

    private assertClass(serviceClass: unknown): void {
        if (typeof serviceClass !== 'function') {
            throw new Error('provided serviceClass is not a class')
        }
    }

}
