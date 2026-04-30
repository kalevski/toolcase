import type Effect from './Effect'
import * as Color from './shaders/colorEffects'
import * as Procedural from './shaders/proceduralEffects'
import * as Distortion from './shaders/distortionEffects'
import * as Dissolve from './shaders/dissolveEffects'
import * as Mask from './shaders/maskEffects'
import * as Lighting from './shaders/lightingEffects'

type EffectCtor = (new (camera: Phaser.Cameras.Scene2D.Camera) => Effect) & {
    KEY: string
    FRAGMENT: string
}

export const EFFECT_REGISTRY: EffectCtor[] = [
    // Colour grading + tone mapping
    Color.GrayScaleEffect,
    Color.NegativeEffect,
    Color.PosterizeEffect,
    Color.ThresholdEffect,
    Color.ColorRGBEffect,
    Color.ColorEffect,
    Color.HSVEffect,
    Color.ColorChangeEffect,
    Color.SepiaEffect,
    Color.MetalFXEffect,
    Color.GoldFXEffect,
    Color.GoldenFXEffect,
    Color.IcedFXEffect,
    Color.SandFXEffect,
    Color.StoneFXEffect,
    Color.WoodFXEffect,

    // Procedural / time-driven
    Procedural.NoiseEffect,
    Procedural.NoiseAnimatedEffect,
    Procedural.BloodEffect,
    Procedural.BurningFXEffect,
    Procedural.FireEffect,
    Procedural.FireAdditiveEffect,
    Procedural.SmokeEffect,
    Procedural.FrozenEffect,
    Procedural.IceEffect,
    Procedural.LightningEffect,
    Procedural.LightningBoltEffect,
    Procedural.PlasmaRainbowEffect,
    Procedural.PlasmaShieldEffect,

    // UV distortion
    Distortion.BlackHoleEffect,
    Distortion.TwistEffect,
    Distortion.DistortionEffect,
    Distortion.DistortionAdditiveEffect,
    Distortion.WaveEffect,
    Distortion.MysticDistortionEffect,
    Distortion.MysticDistortionAdditiveEffect,
    Distortion.HeatEffect,
    Distortion.JellyEffect,
    Distortion.JellyAutoMoveEffect,
    Distortion.LiquidEffect,
    Distortion.LiquifyEffect,
    Distortion.SlimEffect,

    // Dissolve / pixelate
    Dissolve.DesintegrationFXEffect,
    Dissolve.DestroyedFXEffect,
    Dissolve.CompressionFXEffect,
    Dissolve.PixelEffect,
    Dissolve.Pixel8BitsBlackEffect,
    Dissolve.Pixel8BitsCommodoreEffect,
    Dissolve.Pixel8BitsGameboyEffect,

    // Masks / overlays
    Mask.CircleFadeEffect,
    Mask.ClippingEffect,
    Mask.EnergyBarEffect,
    Mask.GhostEffect,
    Mask.FourGradientsEffect,
    Mask.AdditiveEffect,
    Mask.TeleportationEffect,
    Mask.CartoonEffect,

    // Lighting + outline + water + sky
    Lighting.OutlineEffect,
    Lighting.PatternEffect,
    Lighting.PatternAdditiveEffect,
    Lighting.EdgeColorEffect,
    Lighting.BlurEffect,
    Lighting.SharpenEffect,
    Lighting.GrassFXEffect,
    Lighting.GrassMultiFXEffect,
    Lighting.HologramEffect,
    Lighting.Hologram2Effect,
    Lighting.Hologram3Effect,
    Lighting.ShinyReflectEffect,
    Lighting.SkyCloudEffect,
    Lighting.WaterAndBackgroundEffect,
    Lighting.WaterAndBackgroundDeluxeEffect,
    Lighting.WaterfallEffect
]
