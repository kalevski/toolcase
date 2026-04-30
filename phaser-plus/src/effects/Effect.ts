import { Filters, type Cameras } from 'phaser'

/**
 * Base class for reef GLSL effects. Subclasses declare static `KEY`
 * (unique RenderNode name) and `FRAGMENT` (GLSL fragment source) plus
 * override `applyUniforms` to push parameters to the shader program.
 */
export default abstract class Effect extends Filters.Controller {

    static readonly KEY: string

    static readonly FRAGMENT: string

    /** Shader time in seconds, refreshed per draw by the RenderNode wrapper. */
    time: number = 0

    constructor(camera: Cameras.Scene2D.Camera) {
        const ctor = (new.target as unknown as typeof Effect)
        super(camera, ctor.KEY)
    }

    /**
     * Push uniforms to the shader. Called once per draw via the RenderNode
     * `setupUniforms` bridge.
     */
    abstract applyUniforms(programManager: any, time: number): void

}
