import Effect from '../Effect'
import { HEAD, HASH, RGB_HSV, LUMINANCE, SAMPLE_SRC, MIX_OUT } from './_prelude'

// --------------------------------------------------------------------------
// GrayScale — luminance desaturation with optional ramp tint.
// --------------------------------------------------------------------------
export class GrayScaleEffect extends Effect {
    static readonly KEY = 'reef.GrayScale'
    static readonly FRAGMENT = `${HEAD}${LUMINANCE}
        uniform float uAmount;
        uniform vec3 uTint;
        void main() {
            ${SAMPLE_SRC}
            float l = luma(src.rgb);
            vec3 outRgb = mix(src.rgb, vec3(l) * uTint, uAmount);
            ${MIX_OUT}
        }`
    alpha: number = 1
    amount: number = 1
    tintR: number = 1
    tintG: number = 1
    tintB: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uAmount', this.amount)
        pm.setUniform('uTint', [this.tintR, this.tintG, this.tintB])
    }
}

// --------------------------------------------------------------------------
// Negative — invert in linear space (gamma-corrected) for a punchier look.
// --------------------------------------------------------------------------
export class NegativeEffect extends Effect {
    static readonly KEY = 'reef.Negative'
    static readonly FRAGMENT = `${HEAD}
        uniform float uAmount;
        void main() {
            ${SAMPLE_SRC}
            vec3 lin = pow(src.rgb, vec3(2.2));
            vec3 inv = pow(vec3(1.0) - lin, vec3(1.0 / 2.2));
            vec3 outRgb = mix(src.rgb, inv, uAmount);
            ${MIX_OUT}
        }`
    alpha: number = 1
    amount: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uAmount', this.amount)
    }
}

// --------------------------------------------------------------------------
// Posterize — quantise per channel with optional dither for retro feel.
// --------------------------------------------------------------------------
export class PosterizeEffect extends Effect {
    static readonly KEY = 'reef.Posterize'
    static readonly FRAGMENT = `${HEAD}${HASH}
        uniform float uBands;
        uniform float uDither;
        void main() {
            ${SAMPLE_SRC}
            float dither = (hash(outTexCoord * resolution) - 0.5) * uDither;
            vec3 outRgb = floor(src.rgb * uBands + dither + 0.5) / uBands;
            ${MIX_OUT}
        }`
    alpha: number = 1
    bands: number = 6
    dither: number = 0.5
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uBands', Math.max(1, this.bands))
        pm.setUniform('uDither', this.dither)
    }
}

// --------------------------------------------------------------------------
// Threshold — anti-aliased binary mask with custom high/low colours.
// --------------------------------------------------------------------------
export class ThresholdEffect extends Effect {
    static readonly KEY = 'reef.Threshold'
    static readonly FRAGMENT = `${HEAD}${LUMINANCE}
        uniform float uThreshold;
        uniform float uSoftness;
        uniform vec3 uHigh;
        uniform vec3 uLow;
        void main() {
            ${SAMPLE_SRC}
            float l = luma(src.rgb);
            float v = smoothstep(uThreshold - uSoftness, uThreshold + uSoftness, l);
            vec3 outRgb = mix(uLow, uHigh, v);
            ${MIX_OUT}
        }`
    alpha: number = 1
    threshold: number = 0.5
    softness: number = 0.05
    highR: number = 1; highG: number = 1; highB: number = 1
    lowR: number = 0; lowG: number = 0; lowB: number = 0
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uThreshold', this.threshold)
        pm.setUniform('uSoftness', this.softness)
        pm.setUniform('uHigh', [this.highR, this.highG, this.highB])
        pm.setUniform('uLow', [this.lowR, this.lowG, this.lowB])
    }
}

// --------------------------------------------------------------------------
// ColorRGB — per-channel additive offset, clamped to LDR.
// --------------------------------------------------------------------------
export class ColorRGBEffect extends Effect {
    static readonly KEY = 'reef.ColorRGB'
    static readonly FRAGMENT = `${HEAD}
        uniform vec3 uOffset;
        void main() {
            ${SAMPLE_SRC}
            vec3 outRgb = clamp(src.rgb + uOffset, 0.0, 1.0);
            ${MIX_OUT}
        }`
    alpha: number = 1
    r: number = -0.2
    g: number = 0.1
    b: number = 0.3
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uOffset', [this.r, this.g, this.b])
    }
}

// --------------------------------------------------------------------------
// Color — multiplicative tint with luminance-preserving option.
// --------------------------------------------------------------------------
export class ColorEffect extends Effect {
    static readonly KEY = 'reef.Color'
    static readonly FRAGMENT = `${HEAD}${LUMINANCE}
        uniform vec3 uColor;
        uniform float uPreserveLuma;
        void main() {
            ${SAMPLE_SRC}
            vec3 tinted = src.rgb * uColor;
            float lo = luma(src.rgb);
            float lt = luma(tinted) + 1e-5;
            vec3 preserved = tinted * (lo / lt);
            vec3 outRgb = mix(tinted, preserved, uPreserveLuma);
            ${MIX_OUT}
        }`
    alpha: number = 1
    r: number = 0.4; g: number = 0.9; b: number = 1
    preserveLuma: number = 0.5
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uColor', [this.r, this.g, this.b])
        pm.setUniform('uPreserveLuma', this.preserveLuma)
    }
}

// --------------------------------------------------------------------------
// HSV — global hue/sat/value grade.
// --------------------------------------------------------------------------
export class HSVEffect extends Effect {
    static readonly KEY = 'reef.HSV'
    static readonly FRAGMENT = `${HEAD}${RGB_HSV}
        uniform float uHueShift;
        uniform float uSaturation;
        uniform float uValue;
        void main() {
            ${SAMPLE_SRC}
            vec3 hsv = rgb2hsv(src.rgb);
            hsv.x = fract(hsv.x + uHueShift / 360.0);
            hsv.y = clamp(hsv.y * uSaturation, 0.0, 1.0);
            hsv.z = clamp(hsv.z * uValue, 0.0, 1.0);
            vec3 outRgb = hsv2rgb(hsv);
            ${MIX_OUT}
        }`
    alpha: number = 1
    hueShift: number = 60
    saturation: number = 1.2
    valueBrightness: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uHueShift', this.hueShift)
        pm.setUniform('uSaturation', this.saturation)
        pm.setUniform('uValue', this.valueBrightness)
    }
}

// --------------------------------------------------------------------------
// ColorChange — selective hue replacement around `uTargetHue` (0..1).
// --------------------------------------------------------------------------
export class ColorChangeEffect extends Effect {
    static readonly KEY = 'reef.ColorChange'
    static readonly FRAGMENT = `${HEAD}${RGB_HSV}
        uniform float uTargetHue;
        uniform float uTolerance;
        uniform float uHueShift;
        uniform float uSaturation;
        uniform float uValue;
        uniform vec3 uColor;
        void main() {
            ${SAMPLE_SRC}
            vec3 hsv = rgb2hsv(src.rgb);
            float dh = abs(fract(hsv.x - uTargetHue + 0.5) - 0.5);
            float w = smoothstep(uTolerance, 0.0, dh) * smoothstep(0.05, 0.4, hsv.y);
            vec3 shiftedHsv = vec3(fract(hsv.x + uHueShift / 360.0), hsv.y * uSaturation, hsv.z * uValue);
            vec3 shifted = hsv2rgb(shiftedHsv) * uColor;
            vec3 outRgb = mix(src.rgb, shifted, w);
            ${MIX_OUT}
        }`
    alpha: number = 1
    targetHue: number = 0
    tolerance: number = 0.15
    hueShift: number = 180
    saturation: number = 1
    valueBrightness: number = 1
    r: number = 1; g: number = 1; b: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uTargetHue', this.targetHue)
        pm.setUniform('uTolerance', this.tolerance)
        pm.setUniform('uHueShift', this.hueShift)
        pm.setUniform('uSaturation', this.saturation)
        pm.setUniform('uValue', this.valueBrightness)
        pm.setUniform('uColor', [this.r, this.g, this.b])
    }
}

// --------------------------------------------------------------------------
// Sepia — classic warm tonemap.
// --------------------------------------------------------------------------
export class SepiaEffect extends Effect {
    static readonly KEY = 'reef.Sepia'
    static readonly FRAGMENT = `${HEAD}
        uniform float uIntensity;
        void main() {
            ${SAMPLE_SRC}
            float r = dot(src.rgb, vec3(0.393, 0.769, 0.189));
            float g = dot(src.rgb, vec3(0.349, 0.686, 0.168));
            float b = dot(src.rgb, vec3(0.272, 0.534, 0.131));
            vec3 outRgb = mix(src.rgb, vec3(r, g, b), uIntensity);
            ${MIX_OUT}
        }`
    alpha: number = 1
    intensity: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uIntensity', this.intensity)
    }
}

// --------------------------------------------------------------------------
// MetalFX — luminance ramp + animated highlight streak.
// --------------------------------------------------------------------------
export class MetalFXEffect extends Effect {
    static readonly KEY = 'reef.MetalFX'
    static readonly FRAGMENT = `${HEAD}${LUMINANCE}
        uniform float uMetal;
        void main() {
            ${SAMPLE_SRC}
            float l = pow(luma(src.rgb), 1.0 / max(0.01, uMetal));
            vec3 cool = vec3(0.32, 0.40, 0.50);
            vec3 mid  = vec3(0.78, 0.82, 0.88);
            vec3 hot  = vec3(1.00, 1.00, 1.05);
            vec3 base = mix(cool, mid, smoothstep(0.0, 0.55, l));
            base = mix(base, hot, smoothstep(0.55, 0.95, l));
            float streak = smoothstep(0.85, 1.0, l) * (0.3 + 0.7 * sin(outTexCoord.y * 80.0 + uTime));
            vec3 outRgb = base + streak * 0.15;
            ${MIX_OUT}
        }`
    alpha: number = 1
    metal: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uMetal', this.metal)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// GoldFX — saturated yellow ramp with shimmer.
// --------------------------------------------------------------------------
export class GoldFXEffect extends Effect {
    static readonly KEY = 'reef.GoldFX'
    static readonly FRAGMENT = `${HEAD}${LUMINANCE}
        uniform float uGold;
        void main() {
            ${SAMPLE_SRC}
            float l = pow(luma(src.rgb), 1.0 / max(0.01, uGold))
                ;
            vec3 dark = vec3(0.30, 0.18, 0.04);
            vec3 mid  = vec3(0.85, 0.62, 0.18);
            vec3 hot  = vec3(1.00, 0.95, 0.55);
            vec3 base = mix(dark, mid, smoothstep(0.0, 0.55, l));
            base = mix(base, hot, smoothstep(0.55, 1.0, l));
            float shimmer = smoothstep(0.7, 1.0, l) * (0.5 + 0.5 * sin(outTexCoord.x * 50.0 + uTime * 2.0));
            vec3 outRgb = base + shimmer * vec3(0.2, 0.15, 0.05);
            ${MIX_OUT}
        }`
    alpha: number = 1
    gold: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uGold', this.gold)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// GoldenFX — brighter, juicier cousin of GoldFX.
// --------------------------------------------------------------------------
export class GoldenFXEffect extends Effect {
    static readonly KEY = 'reef.GoldenFX'
    static readonly FRAGMENT = `${HEAD}${LUMINANCE}
        uniform float uGolden;
        void main() {
            ${SAMPLE_SRC}
            float l = pow(luma(src.rgb), 1.0 / max(0.01, uGolden));
            vec3 dark = vec3(0.45, 0.27, 0.05);
            vec3 mid  = vec3(1.00, 0.78, 0.25);
            vec3 hot  = vec3(1.20, 1.05, 0.65);
            vec3 base = mix(dark, mid, smoothstep(0.0, 0.6, l));
            base = mix(base, hot, smoothstep(0.6, 1.0, l));
            vec3 outRgb = clamp(base, 0.0, 1.0);
            ${MIX_OUT}
        }`
    alpha: number = 1
    golden: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uGolden', this.golden)
    }
}

// --------------------------------------------------------------------------
// IcedFX — pale blue with drifting sparkle.
// --------------------------------------------------------------------------
export class IcedFXEffect extends Effect {
    static readonly KEY = 'reef.IcedFX'
    static readonly FRAGMENT = `${HEAD}${HASH}${LUMINANCE}
        uniform float uIced;
        void main() {
            ${SAMPLE_SRC}
            float l = pow(luma(src.rgb), 1.0 / max(0.01, uIced));
            vec3 deep  = vec3(0.18, 0.30, 0.45);
            vec3 mid   = vec3(0.55, 0.78, 0.95);
            vec3 light = vec3(0.90, 0.98, 1.00);
            vec3 base = mix(deep, mid, smoothstep(0.0, 0.5, l));
            base = mix(base, light, smoothstep(0.5, 1.0, l));
            float twinkle = step(0.985, hash(floor(outTexCoord * 80.0) + floor(uTime * 4.0)));
            vec3 outRgb = base + twinkle * vec3(0.35);
            ${MIX_OUT}
        }`
    alpha: number = 1
    iced: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uIced', this.iced)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// SandFX — warm grain overlay with luminance-driven palette.
// --------------------------------------------------------------------------
export class SandFXEffect extends Effect {
    static readonly KEY = 'reef.SandFX'
    static readonly FRAGMENT = `${HEAD}${HASH}${LUMINANCE}
        uniform float uSand;
        void main() {
            ${SAMPLE_SRC}
            float l = luma(src.rgb);
            float grain = (hash(outTexCoord * resolution) - 0.5) * 0.18;
            vec3 dark = vec3(0.45, 0.32, 0.18);
            vec3 mid  = vec3(0.85, 0.70, 0.40);
            vec3 hot  = vec3(1.00, 0.92, 0.62);
            vec3 sand = mix(dark, mid, smoothstep(0.0, 0.55, l));
            sand = mix(sand, hot, smoothstep(0.55, 1.0, l)) + grain;
            vec3 outRgb = mix(src.rgb, sand, uSand);
            ${MIX_OUT}
        }`
    alpha: number = 1
    sand: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uSand', this.sand)
    }
}

// --------------------------------------------------------------------------
// StoneFX — fbm-blended grey with cracks.
// --------------------------------------------------------------------------
export class StoneFXEffect extends Effect {
    static readonly KEY = 'reef.StoneFX'
    static readonly FRAGMENT = `${HEAD}${HASH}${LUMINANCE}
        uniform float uIntoStone;
        uniform float uDeep;
        float n2(vec2 p) {
            return hash(p) * 0.5 + hash(p * 2.3) * 0.25 + hash(p * 5.1) * 0.125;
        }
        void main() {
            ${SAMPLE_SRC}
            float l = luma(src.rgb);
            float n = n2(outTexCoord * 220.0);
            float crack = smoothstep(0.45, 0.5, abs(n - 0.5));
            vec3 base = mix(vec3(0.18), vec3(0.62), n);
            vec3 stone = base * (0.65 + l * 0.55) - crack * uDeep * 0.25;
            vec3 outRgb = mix(src.rgb, clamp(stone, 0.0, 1.0), uIntoStone);
            ${MIX_OUT}
        }`
    alpha: number = 1
    intoStone: number = 1
    deep: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uIntoStone', this.intoStone)
        pm.setUniform('uDeep', this.deep)
    }
}

// --------------------------------------------------------------------------
// WoodFX — sin rings + grain noise for a believable plank.
// --------------------------------------------------------------------------
export class WoodFXEffect extends Effect {
    static readonly KEY = 'reef.WoodFX'
    static readonly FRAGMENT = `${HEAD}${HASH}${LUMINANCE}
        uniform float uIntoWood;
        uniform float uDeep;
        void main() {
            ${SAMPLE_SRC}
            float warp = hash(floor(outTexCoord * vec2(8.0, 32.0))) * 1.5;
            float rings = sin(outTexCoord.y * 90.0 + warp) * 0.5 + 0.5;
            float grain = hash(outTexCoord * resolution) * 0.5 + 0.5;
            vec3 dark  = vec3(0.30, 0.16, 0.06);
            vec3 light = vec3(0.78, 0.50, 0.24);
            vec3 wood = mix(dark, light, rings);
            wood = mix(wood, dark, grain * uDeep * 0.4);
            wood *= (0.5 + luma(src.rgb) * 0.7);
            vec3 outRgb = mix(src.rgb, clamp(wood, 0.0, 1.0), uIntoWood);
            ${MIX_OUT}
        }`
    alpha: number = 1
    intoWood: number = 1
    deep: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uIntoWood', this.intoWood)
        pm.setUniform('uDeep', this.deep)
    }
}
