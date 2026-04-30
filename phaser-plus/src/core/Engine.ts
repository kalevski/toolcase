import { Level, type Logger } from '@toolcase/logging'
import type { LoggerLevel } from '@toolcase/logging/lib/Level'
import LoggerFactory from './LoggerFactory'
import ServiceRegistry from './ServiceRegistry'

export default class Engine {

    readonly version: string = '0.2.0'

    readonly services: ServiceRegistry

    private readonly logging: LoggerFactory = new LoggerFactory()

    constructor() {
        this.logging.level = Level.VERBOSE as LoggerLevel
        this.services = new ServiceRegistry()
        this.getLogger().info(`reef v${this.version} initialized`)
    }

    setLogLevel(value: LoggerLevel): this {
        this.logging.level = value
        return this
    }

    getLogger(scope: string = '@phaser-plus/reef'): Logger {
        return this.logging.getLogger(scope)
    }

}
