import type Scene from '../engine/Scene'
import type { TweenOptions, TweenHandle } from './TweenProcessor'

export default class Tween {

    static to(scene: Scene, target: object, to: Record<string, number>, opts: TweenOptions): TweenHandle {
        const processor = (scene.flow as any).tweens
        return processor.tween(target, to, opts)
    }

    static cancel(handle: TweenHandle): void {
        handle.cancel()
    }

}
