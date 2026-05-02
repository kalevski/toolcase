import { Level, type Logger } from '@toolcase/logging'
import LoggerFactory from './LoggerFactory'
import ServiceRegistry from '../features/ServiceRegistry'

export default class Engine {

    readonly version: string = '2.0.0'

    readonly services: ServiceRegistry

    private readonly logging: LoggerFactory = new LoggerFactory()

    constructor() {
        this.logging.level = Level.VERBOSE
        this.services = new ServiceRegistry()
        this.getLogger().info(`reef v${this.version} initialized`)
    }

    setLogLevel(value: any): this {
        this.logging.level = value
        return this
    }

    getLogger(scope: string = '@toolcase/phaser-plus'): Logger {
        return this.logging.getLogger(scope)
    }

}
