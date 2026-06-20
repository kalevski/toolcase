import Effect from '../Effect'
import { HEAD, HASH, NOISE, SAMPLE_SRC, SAFE_SAMPLE, MIX_OUT } from './_prelude'

// --------------------------------------------------------------------------
// Outline — 8-tap dilation outside the alpha silhouette.
// --------------------------------------------------------------------------
export class OutlineEffect extends Effect {
    static readonly KEY = 'reef.Outline'
    static readonly FRAGMENT = `${HEAD}
        uniform float uSpread;
        uniform float uSoftness;
        uniform vec3 uColor;
        void main() {
            ${SAMPLE_SRC}
            if (src.a > 0.95) {
                gl_FragColor = src;
                return;
            }
            float a = 0.0;
            for (int x = -1; x <= 1; x++) {
                for (int y = -1; y <= 1; y++) {
                    if (x == 0 && y == 0) continue;
                    a = max(a, texture2D(uMainSampler, outTexCoord + vec2(float(x), float(y)) * uSpread).a);
                }
            }
            float edge = smoothstep(0.0, uSoftness, a) * (1.0 - src.a);
            vec3 outRgb = mix(src.rgb, uColor, edge);
            gl_FragColor = vec4(clamp(mix(src.rgb, outRgb, uAlpha), 0.0, 1.0), max(src.a, edge * uAlpha));
        }`
    alpha: number = 1
    spread: number = 0.008
    softness: number = 0.4
    r: number = 1; g: number = 1; b: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uSpread', this.spread)
        pm.setUniform('uSoftness', this.softness)
        pm.setUniform('uColor', [this.r, this.g, this.b])
    }
}

// --------------------------------------------------------------------------
// Pattern — repeating tiled UV with optional scroll, masked by source alpha.
// --------------------------------------------------------------------------
export class PatternEffect extends Effect {
    static readonly KEY: string = 'reef.Pattern'
    static readonly FRAGMENT: string = `${HEAD}
        uniform vec2 uTile;
        uniform vec2 uScroll;
        uniform vec3 uColor;
        void main() {
            ${SAMPLE_SRC}
            vec2 tiled = fract(outTexCoord / uTile + uScroll * uTime);
            vec4 patSrc = texture2D(uMainSampler, tiled);
            vec3 outRgb = mix(src.rgb, patSrc.rgb * uColor, src.a);
            ${MIX_OUT}
        }`
    alpha: number = 1
    tileX: number = 0.2
    tileY: number = 0.2
    scrollX: number = 0
    scrollY: number = 0.05
    r: number = 1; g: number = 1; b: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uTile', [this.tileX, this.tileY])
        pm.setUniform('uScroll', [this.scrollX, this.scrollY])
        pm.setUniform('uColor', [this.r, this.g, this.b])
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// PatternAdditive — additive-blend variant of PatternEffect. Brightens the
// tiled pattern output (×1.6, clamped) so it composes correctly under Phaser's
// additive blend mode, mirroring DistortionAdditiveEffect.
// --------------------------------------------------------------------------
export class PatternAdditiveEffect extends PatternEffect {
    static readonly KEY: string = 'reef.PatternAdditive'
    static readonly FRAGMENT: string = `${HEAD}
        uniform vec2 uTile;
        uniform vec2 uScroll;
        uniform vec3 uColor;
        void main() {
            ${SAMPLE_SRC}
            vec2 tiled = fract(outTexCoord / uTile + uScroll * uTime);
            vec4 patSrc = texture2D(uMainSampler, tiled);
            vec3 outRgb = clamp(mix(src.rgb, patSrc.rgb * uColor, src.a) * 1.6, 0.0, 1.0);
            ${MIX_OUT}
        }`
}

// --------------------------------------------------------------------------
// EdgeColor — colour the alpha boundary with smooth dilation.
// --------------------------------------------------------------------------
export class EdgeColorEffect extends Effect {
    static readonly KEY = 'reef.EdgeColor'
    static readonly FRAGMENT = `${HEAD}
        uniform vec3 uColor;
        uniform float uWidth;
        void main() {
            ${SAMPLE_SRC}
            vec2 px = uWidth / resolution;
            float minA = 1.0;
            for (int x = -1; x <= 1; x++) {
                for (int y = -1; y <= 1; y++) {
                    minA = min(minA, texture2D(uMainSampler, outTexCoord + vec2(float(x), float(y)) * px).a);
                }
            }
            float edge = src.a * (1.0 - minA);
            vec3 outRgb = mix(src.rgb, uColor, edge);
            ${MIX_OUT}
        }`
    alpha: number = 1
    width: number = 1.5
    r: number = 0; g: number = 1; b: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uWidth', this.width)
        pm.setUniform('uColor', [this.r, this.g, this.b])
    }
}

// --------------------------------------------------------------------------
// Blur — 13-tap separable Gaussian-ish, single pass.
// --------------------------------------------------------------------------
export class BlurEffect extends Effect {
    static readonly KEY = 'reef.Blur'
    static readonly FRAGMENT = `${HEAD}
        uniform float uBlur;
        void main() {
            vec2 px = uBlur / resolution;
            vec4 acc = vec4(0.0);
            float weights[5];
            weights[0] = 0.227027;
            weights[1] = 0.1945946;
            weights[2] = 0.1216216;
            weights[3] = 0.054054;
            weights[4] = 0.016216;
            acc += texture2D(uMainSampler, outTexCoord) * weights[0];
            for (int i = 1; i < 5; i++) {
                acc += texture2D(uMainSampler, outTexCoord + vec2(float(i), 0.0) * px) * weights[i];
                acc += texture2D(uMainSampler, outTexCoord - vec2(float(i), 0.0) * px) * weights[i];
                acc += texture2D(uMainSampler, outTexCoord + vec2(0.0, float(i)) * px) * weights[i];
                acc += texture2D(uMainSampler, outTexCoord - vec2(0.0, float(i)) * px) * weights[i];
            }
            vec4 src = texture2D(uMainSampler, outTexCoord);
            vec3 outRgb = (acc / 1.74).rgb;
            ${MIX_OUT}
        }`
    alpha: number = 1
    blur: number = 4
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uBlur', this.blur)
    }
}

// --------------------------------------------------------------------------
// Sharpen — 3x3 unsharp mask (centre - blurred neighbours).
// --------------------------------------------------------------------------
export class SharpenEffect extends Effect {
    static readonly KEY = 'reef.Sharpen'
    static readonly FRAGMENT = `${HEAD}
        uniform float uAmount;
        void main() {
            vec2 px = 1.0 / resolution;
            vec4 acc = vec4(0.0);
            for (int x = -1; x <= 1; x++) {
                for (int y = -1; y <= 1; y++) {
                    acc += texture2D(uMainSampler, outTexCoord + vec2(float(x), float(y)) * px);
                }
            }
            vec4 src = texture2D(uMainSampler, outTexCoord);
            vec3 blurred = (acc / 9.0).rgb;
            vec3 outRgb = clamp(src.rgb + (src.rgb - blurred) * uAmount, 0.0, 1.0);
            ${MIX_OUT}
        }`
    alpha: number = 1
    amount: number = 1.5
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uAmount', this.amount)
    }
}

// --------------------------------------------------------------------------
// GrassFX — vertical-progress shear sway.
// --------------------------------------------------------------------------
export class GrassFXEffect extends Effect {
    static readonly KEY = 'reef.GrassFX'
    static readonly FRAGMENT = `${HEAD}${SAFE_SAMPLE}
        uniform float uHeat;
        uniform float uSpeed;
        void main() {
            float sway = sin(uTime * uSpeed * 1.4) * uHeat * 0.05;
            vec2 uv = outTexCoord;
            uv.x += sway * pow(1.0 - uv.y, 1.4);
            vec4 src = safeSample(uv);
            vec3 outRgb = src.rgb;
            ${MIX_OUT}
        }`
    alpha: number = 1
    heat: number = 1
    speed: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uHeat', this.heat)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// GrassMultiFX — multi-band sway summed for richer wind.
// --------------------------------------------------------------------------
export class GrassMultiFXEffect extends Effect {
    static readonly KEY = 'reef.GrassMultiFX'
    static readonly FRAGMENT = `${HEAD}${SAFE_SAMPLE}
        uniform float uHeat;
        uniform float uSpeed;
        void main() {
            float t = uTime * uSpeed;
            float sway = (sin(t) + 0.5 * sin(t * 2.7) + 0.25 * sin(t * 5.1)) * uHeat * 0.04;
            vec2 uv = outTexCoord;
            uv.x += sway * pow(1.0 - uv.y, 1.4);
            vec4 src = safeSample(uv);
            vec3 outRgb = src.rgb;
            ${MIX_OUT}
        }`
    alpha: number = 1
    heat: number = 1
    speed: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uHeat', this.heat)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Hologram — chromatic aberration + scanlines + cyan tint.
// --------------------------------------------------------------------------
export class HologramEffect extends Effect {
    static readonly KEY = 'reef.Hologram'
    static readonly FRAGMENT = `${HEAD}${HASH}${SAFE_SAMPLE}
        uniform float uDistortion;
        uniform float uSpeed;
        void main() {
            vec2 uv = outTexCoord;
            float jitter = (hash(vec2(floor(uv.y * 100.0), floor(uTime * uSpeed * 12.0))) - 0.5) * 0.012 * uDistortion;
            uv.x += jitter;
            float chroma = 0.005 * uDistortion;
            float r = safeSample(uv + vec2(chroma, 0.0)).r;
            float g = safeSample(uv).g;
            float b = safeSample(uv - vec2(chroma, 0.0)).b;
            vec4 src = safeSample(uv);
            float scan = 0.85 + 0.15 * sin(uv.y * resolution.y * 0.5 + uTime * 4.0);
            float roll = 0.94 + 0.06 * sin(uv.y * 4.0 + uTime);
            vec3 tint = vec3(0.40, 0.85, 1.05);
            vec3 outRgb = vec3(r, g, b) * tint * scan * roll;
            ${MIX_OUT}
        }`
    alpha: number = 1
    distortion: number = 1
    speed: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uDistortion', this.distortion)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Hologram2 — pronounced RGB channel split with vertical glitch bands.
// --------------------------------------------------------------------------
export class Hologram2Effect extends Effect {
    static readonly KEY = 'reef.Hologram2'
    static readonly FRAGMENT = `${HEAD}${HASH}${SAFE_SAMPLE}
        uniform float uDistortion;
        uniform float uSpeed;
        void main() {
            float band = step(0.97, hash(vec2(floor(outTexCoord.y * 60.0), floor(uTime * uSpeed * 8.0))));
            float wob = sin(outTexCoord.y * 60.0 + uTime * uSpeed * 2.0) * 0.012 * uDistortion;
            float r = safeSample(outTexCoord + vec2(wob + band * 0.04, 0.0)).r;
            float g = safeSample(outTexCoord).g;
            float b = safeSample(outTexCoord - vec2(wob + band * 0.04, 0.0)).b;
            vec4 src = safeSample(outTexCoord);
            float scan = 0.9 + 0.1 * sin(outTexCoord.y * resolution.y * 0.7);
            vec3 outRgb = vec3(r, g, b) * scan;
            ${MIX_OUT}
        }`
    alpha: number = 1
    distortion: number = 1
    speed: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uDistortion', this.distortion)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Hologram3 — scanlines + colour-tinted ramp + vertical sweep.
// --------------------------------------------------------------------------
export class Hologram3Effect extends Effect {
    static readonly KEY = 'reef.Hologram3'
    static readonly FRAGMENT = `${HEAD}${HASH}${SAFE_SAMPLE}
        uniform float uDistortion;
        uniform float uSpeed;
        uniform vec3 uColor;
        void main() {
            vec2 uv = outTexCoord;
            uv.x += (hash(vec2(floor(uv.y * 120.0), floor(uTime * uSpeed * 6.0))) - 0.5) * 0.012 * uDistortion;
            vec4 src = safeSample(uv);
            float scan = 0.85 + 0.15 * sin(uv.y * resolution.y * 0.7 + uTime * 5.0);
            float sweep = smoothstep(0.0, 0.05, abs(fract(uv.y - uTime * 0.2) - 0.5));
            vec3 outRgb = src.rgb * uColor * scan * (0.85 + sweep * 0.4);
            ${MIX_OUT}
        }`
    alpha: number = 1
    distortion: number = 1
    speed: number = 1
    r: number = 0.7; g: number = 1.0; b: number = 0.95
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uDistortion', this.distortion)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uColor', [this.r, this.g, this.b])
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Shiny_Reflect — diagonal Gaussian highlight sweep with smoothed edges.
// --------------------------------------------------------------------------
export class ShinyReflectEffect extends Effect {
    static readonly KEY = 'reef.ShinyReflect'
    static readonly FRAGMENT = `${HEAD}
        uniform float uLight;
        uniform float uSize;
        uniform float uSpeed;
        uniform float uOnlyLight;
        uniform vec3 uTint;
        void main() {
            ${SAMPLE_SRC}
            float t = mod(uTime / max(0.1, uSpeed), 1.0) * 2.0 - 0.5;
            float d = (outTexCoord.x - outTexCoord.y) - (t * 2.0 - 1.0);
            float spec = exp(-d * d / (uSize * uSize)) * uLight;
            vec3 base = src.rgb * (1.0 - uOnlyLight);
            vec3 outRgb = base + spec * uTint;
            ${MIX_OUT}
        }`
    alpha: number = 1
    light: number = 1
    size: number = 0.35
    speed: number = 1.5
    onlyLight: number = 0
    tintR: number = 1; tintG: number = 1; tintB: number = 1.05
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uLight', this.light)
        pm.setUniform('uSize', this.size)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uOnlyLight', this.onlyLight)
        pm.setUniform('uTint', [this.tintR, this.tintG, this.tintB])
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// SkyCloud — layered scrolling fbm clouds plus sun glare.
// --------------------------------------------------------------------------
export class SkyCloudEffect extends Effect {
    static readonly KEY = 'reef.SkyCloud'
    static readonly FRAGMENT = `${HEAD}${HASH}${NOISE}
        uniform float uZoom;
        uniform float uIntensity;
        uniform vec2 uScroll;
        uniform float uLight;
        void main() {
            ${SAMPLE_SRC}
            vec2 q = outTexCoord / uZoom;
            float n1 = fbm(q + uScroll * uTime);
            float n2 = fbm(q * 1.7 + uScroll * uTime * 0.5 + 11.0);
            float clouds = clamp(n1 * 0.6 + n2 * 0.5, 0.0, 1.0);
            vec3 sky = mix(vec3(0.30, 0.55, 0.95), vec3(1.0), clouds);
            float sun = pow(max(0.0, 1.0 - distance(outTexCoord, vec2(0.78, 0.22)) * 2.0), 6.0) * uLight;
            vec3 outRgb = mix(src.rgb, sky, uIntensity * smoothstep(0.2, 0.8, clouds)) + sun * vec3(1.0, 0.95, 0.7);
            ${MIX_OUT}
        }`
    alpha: number = 1
    zoom: number = 0.4
    intensity: number = 0.5
    scrollX: number = 0.06; scrollY: number = 0.02
    light: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uZoom', this.zoom)
        pm.setUniform('uIntensity', this.intensity)
        pm.setUniform('uScroll', [this.scrollX, this.scrollY])
        pm.setUniform('uLight', this.light)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// WaterAndBackground — reflection of upper half on the lower half with caustic.
// --------------------------------------------------------------------------
export class WaterAndBackgroundEffect extends Effect {
    static readonly KEY: string = 'reef.WaterAndBackground'
    static readonly FRAGMENT: string = `${HEAD}${HASH}${NOISE}${SAFE_SAMPLE}
        uniform float uHeat;
        uniform float uSpeed;
        uniform float uLight;
        void main() {
            vec2 uv = outTexCoord;
            if (uv.y > 0.5) {
                vec2 q = uv * 6.0 + uTime * uSpeed * vec2(0.4, 0.6);
                vec2 d = (vec2(fbm(q), fbm(q + 1.7)) - 0.5) * 0.05 * uHeat;
                vec2 reflected = vec2(uv.x, 1.0 - uv.y) + d;
                vec4 src = safeSample(reflected);
                float caustic = pow(0.5 + 0.5 * sin((uv.y - 0.5) * 30.0 + uTime * 2.0 + d.x * 20.0), 2.0);
                vec3 tint = vec3(0.45, 0.75, 0.95);
                vec3 outRgb = src.rgb * tint + caustic * vec3(0.10) * uLight;
                gl_FragColor = vec4(clamp(mix(src.rgb, outRgb, uAlpha), 0.0, 1.0), src.a);
                return;
            }
            vec4 src = safeSample(uv);
            gl_FragColor = src;
        }`
    alpha: number = 1
    heat: number = 1
    speed: number = 1
    light: number = 3
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uHeat', this.heat)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uLight', this.light)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// WaterAndBackgroundDeluxe — enhanced variant of WaterAndBackgroundEffect with
// foam highlights, depth-graded tint, and a horizon glow on the upper half for
// a richer scene. Distinct FRAGMENT; use WaterAndBackground for the lighter look.
// --------------------------------------------------------------------------
export class WaterAndBackgroundDeluxeEffect extends WaterAndBackgroundEffect {
    static readonly KEY: string = 'reef.WaterAndBackgroundDeluxe'
    static readonly FRAGMENT: string = `${HEAD}${HASH}${NOISE}${SAFE_SAMPLE}
        uniform float uHeat;
        uniform float uSpeed;
        uniform float uLight;
        void main() {
            vec2 uv = outTexCoord;
            if (uv.y > 0.5) {
                vec2 q = uv * 6.0 + uTime * uSpeed * vec2(0.4, 0.6);
                vec2 d = (vec2(fbm(q), fbm(q + 1.7)) - 0.5) * 0.05 * uHeat;
                vec2 reflected = vec2(uv.x, 1.0 - uv.y) + d;
                vec4 src = safeSample(reflected);
                float depth = (uv.y - 0.5) * 2.0;
                float caustic = pow(0.5 + 0.5 * sin((uv.y - 0.5) * 30.0 + uTime * 2.0 + d.x * 20.0), 2.0);
                float foam = smoothstep(0.7, 1.0, fbm(q * 2.5 + uTime * 0.5)) * (1.0 - depth) * 0.4;
                vec3 tint = mix(vec3(0.45, 0.75, 0.95), vec3(0.1, 0.3, 0.6), depth);
                vec3 outRgb = src.rgb * tint + caustic * vec3(0.10) * uLight + foam;
                gl_FragColor = vec4(clamp(mix(src.rgb, outRgb, uAlpha), 0.0, 1.0), src.a);
                return;
            }
            vec4 src = safeSample(uv);
            float horizon = smoothstep(0.48, 0.5, uv.y) * 0.15 * uLight;
            gl_FragColor = vec4(clamp(src.rgb + vec3(0.45, 0.75, 0.95) * horizon, 0.0, 1.0), src.a);
        }`
}

// --------------------------------------------------------------------------
// Waterfall — vertical UV scroll with bubbling foam highlights.
// --------------------------------------------------------------------------
export class WaterfallEffect extends Effect {
    static readonly KEY = 'reef.Waterfall'
    static readonly FRAGMENT = `${HEAD}${HASH}${NOISE}${SAFE_SAMPLE}
        uniform float uLiquid;
        uniform float uSpeed;
        uniform float uEdge;
        uniform vec3 uLightColor;
        void main() {
            vec2 uv = outTexCoord;
            uv.y -= uTime * uSpeed * 0.5;
            vec2 q = uv * 7.0;
            vec2 d = (vec2(fbm(q), fbm(q + 5.0)) - 0.5) * 0.06 * uLiquid;
            vec4 src = safeSample(outTexCoord + d);
            float foam = smoothstep(0.65, 0.92, fbm(q * 2.0 + uTime * 0.8));
            float streak = smoothstep(0.95, 1.0, fbm(q * 4.0 + uTime));
            vec3 outRgb = src.rgb + (foam * 0.6 + streak * 1.2) * uLightColor * uEdge;
            ${MIX_OUT}
        }`
    alpha: number = 1
    liquid: number = 1
    speed: number = 1
    edge: number = 0.5
    r: number = 0.85; g: number = 0.95; b: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uLiquid', this.liquid)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uEdge', this.edge)
        pm.setUniform('uLightColor', [this.r, this.g, this.b])
        pm.setUniform('uTime', time)
    }
}
