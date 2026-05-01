import Effect from './Effect'
import EffectManager from './EffectManager'
import { installEffects } from './installEffects'
import { EFFECT_REGISTRY } from './registry'

export * from './shaders/colorEffects'
export * from './shaders/proceduralEffects'
export * from './shaders/distortionEffects'
export * from './shaders/dissolveEffects'
export * from './shaders/maskEffects'
export * from './shaders/lightingEffects'

export {
    Effect,
    EffectManager,
    installEffects,
    EFFECT_REGISTRY
}
