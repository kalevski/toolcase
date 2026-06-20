import Effect from '../Effect'
import { HEAD, HASH, SAFE_SAMPLE, SAMPLE_SRC, MIX_OUT } from './_prelude'

// --------------------------------------------------------------------------
// CircleFade — feathered radial mask, fade-in or fade-out via `uInOut`.
// --------------------------------------------------------------------------
export class CircleFadeEffect extends Effect {
    static readonly KEY = 'reef.CircleFade'
    static readonly FRAGMENT = `${HEAD}
        uniform float uOffset;
        uniform float uSoftness;
        uniform float uInOut;
        void main() {
            ${SAMPLE_SRC}
            float r = length(outTexCoord - 0.5) * 2.0;
            float t = smoothstep(uOffset - uSoftness, uOffset + uSoftness, r);
            float mask = uInOut < 0.0 ? 1.0 - t : t;
            float a = src.a * mix(1.0, mask, uAlpha);
            gl_FragColor = vec4(src.rgb, a);
        }`
    alpha: number = 1
    offset: number = 0.7
    softness: number = 0.1
    inOut: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uOffset', this.offset)
        pm.setUniform('uSoftness', this.softness)
        pm.setUniform('uInOut', this.inOut)
    }
}

// --------------------------------------------------------------------------
// Clipping — soft fade from each side rather than a hard discard.
// --------------------------------------------------------------------------
export class ClippingEffect extends Effect {
    static readonly KEY = 'reef.Clipping'
    static readonly FRAGMENT = `${HEAD}
        uniform vec4 uClip;
        uniform float uSoftness;
        void main() {
            ${SAMPLE_SRC}
            float l = smoothstep(uClip.x - uSoftness, uClip.x + uSoftness, outTexCoord.x);
            float r = smoothstep(uClip.y - uSoftness, uClip.y + uSoftness, 1.0 - outTexCoord.x);
            float u = smoothstep(uClip.z - uSoftness, uClip.z + uSoftness, outTexCoord.y);
            float d = smoothstep(uClip.w - uSoftness, uClip.w + uSoftness, 1.0 - outTexCoord.y);
            float mask = l * r * u * d;
            gl_FragColor = vec4(src.rgb, src.a * mix(1.0, mask, uAlpha));
        }`
    alpha: number = 1
    left: number = 0
    right: number = 0
    up: number = 0
    down: number = 0
    softness: number = 0.02
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uClip', [this.left, this.right, this.up, this.down])
        pm.setUniform('uSoftness', this.softness)
    }
}

// --------------------------------------------------------------------------
// EnergyBar — animated horizontal fill with edge glow + segment ticks.
// --------------------------------------------------------------------------
export class EnergyBarEffect extends Effect {
    static readonly KEY = 'reef.EnergyBar'
    static readonly FRAGMENT = `${HEAD}
        uniform float uProgress;
        uniform float uEdge;
        uniform float uSegments;
        uniform vec3 uColor;
        void main() {
            ${SAMPLE_SRC}
            float dist = uProgress - outTexCoord.x;
            float fill = step(0.0, dist);
            float edge = smoothstep(0.04, 0.0, abs(dist));
            float pulse = 0.6 + 0.4 * sin(uTime * 6.0);
            float seg = step(abs(fract(outTexCoord.x * uSegments) - 0.5), 0.04) * 0.05;
            vec3 fillCol = uColor * (1.0 - seg);
            vec3 outRgb = mix(src.rgb * 0.25, fillCol, fill);
            outRgb += edge * uColor * uEdge * pulse;
            ${MIX_OUT}
        }`
    alpha: number = 1
    progress: number = 0.6
    edge: number = 1
    segments: number = 8
    r: number = 0.4; g: number = 1.0; b: number = 0.5
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uProgress', this.progress)
        pm.setUniform('uEdge', this.edge)
        pm.setUniform('uSegments', this.segments)
        pm.setUniform('uColor', [this.r, this.g, this.b])
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Ghost — translucent silhouette tinted cyan, with subtle wobble.
// --------------------------------------------------------------------------
export class GhostEffect extends Effect {
    static readonly KEY = 'reef.Ghost'
    static readonly FRAGMENT = `${HEAD}${SAFE_SAMPLE}
        uniform float uOffset;
        uniform vec4 uClip;
        void main() {
            float wob = sin(outTexCoord.y * 12.0 + uTime * 1.5) * 0.01 * uOffset;
            vec4 src = safeSample(outTexCoord + vec2(wob, uOffset * 0.04));
            float l = smoothstep(uClip.x - 0.05, uClip.x + 0.05, outTexCoord.x);
            float r = smoothstep(uClip.y - 0.05, uClip.y + 0.05, 1.0 - outTexCoord.x);
            float u = smoothstep(uClip.z - 0.05, uClip.z + 0.05, outTexCoord.y);
            float d = smoothstep(uClip.w - 0.05, uClip.w + 0.05, 1.0 - outTexCoord.y);
            float mask = l * r * u * d;
            vec3 outRgb = src.rgb * vec3(0.65, 0.85, 1.0);
            float a = src.a * mask * mix(1.0, 0.6, uAlpha);
            gl_FragColor = vec4(clamp(mix(src.rgb, outRgb, uAlpha), 0.0, 1.0), a);
        }`
    alpha: number = 1
    offset: number = 0.4
    left: number = 0.1; right: number = 0.1; up: number = 0.05; down: number = 0.2
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uOffset', this.offset)
        pm.setUniform('uClip', [this.left, this.right, this.up, this.down])
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// 4_Gradients — bilinear corner blend, mixed multiplicatively with source.
// --------------------------------------------------------------------------
export class FourGradientsEffect extends Effect {
    static readonly KEY = 'reef.4Gradients'
    static readonly FRAGMENT = `${HEAD}
        uniform vec3 uC1;
        uniform vec3 uC2;
        uniform vec3 uC3;
        uniform vec3 uC4;
        uniform float uMode;
        void main() {
            ${SAMPLE_SRC}
            vec3 top = mix(uC1, uC2, outTexCoord.x);
            vec3 bot = mix(uC3, uC4, outTexCoord.x);
            vec3 grad = mix(top, bot, outTexCoord.y);
            vec3 outRgb = mix(src.rgb * grad, grad, uMode);
            ${MIX_OUT}
        }`
    alpha: number = 1
    c1r: number = 1; c1g: number = 0.3; c1b: number = 0.5
    c2r: number = 1; c2g: number = 0.85; c2b: number = 0.2
    c3r: number = 0.2; c3g: number = 0.7; c3b: number = 1
    c4r: number = 0.4; c4g: number = 1; c4b: number = 0.6
    mode: number = 0
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uC1', [this.c1r, this.c1g, this.c1b])
        pm.setUniform('uC2', [this.c2r, this.c2g, this.c2b])
        pm.setUniform('uC3', [this.c3r, this.c3g, this.c3b])
        pm.setUniform('uC4', [this.c4r, this.c4g, this.c4b])
        pm.setUniform('uMode', this.mode)
    }
}

// --------------------------------------------------------------------------
// Additive — output intensity multiplier (host should use additive blend).
// --------------------------------------------------------------------------
export class AdditiveEffect extends Effect {
    static readonly KEY = 'reef.Additive'
    static readonly FRAGMENT = `${HEAD}
        uniform float uIntensity;
        void main() {
            ${SAMPLE_SRC}
            vec3 outRgb = src.rgb * uIntensity;
            ${MIX_OUT}
        }`
    alpha: number = 1
    intensity: number = 1.4
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uIntensity', this.intensity)
    }
}

// --------------------------------------------------------------------------
// Teleportation — vertical strip dissolve with rim glow + chromatic split.
// --------------------------------------------------------------------------
export class TeleportationEffect extends Effect {
    static readonly KEY = 'reef.Teleportation'
    static readonly FRAGMENT = `${HEAD}${HASH}${SAFE_SAMPLE}
        uniform float uProgress;
        void main() {
            float strip = smoothstep(0.4, 0.6, hash(vec2(floor(outTexCoord.y * 80.0), 0.0)));
            float t = uProgress + strip * 0.25;
            float chroma = 0.012 * (1.0 - smoothstep(0.0, 0.4, abs(outTexCoord.y - t)));
            float r = safeSample(outTexCoord + vec2(chroma, 0.0)).r;
            float g = safeSample(outTexCoord).g;
            float b = safeSample(outTexCoord - vec2(chroma, 0.0)).b;
            vec4 src = safeSample(outTexCoord);
            float visible = smoothstep(t - 0.02, t + 0.02, outTexCoord.y);
            float rim = (1.0 - visible) * smoothstep(t - 0.05, t, outTexCoord.y);
            vec3 outRgb = vec3(r, g, b) + rim * vec3(0.5, 0.8, 1.4);
            float a = src.a * visible;
            gl_FragColor = vec4(clamp(mix(src.rgb, outRgb, uAlpha), 0.0, 1.0), a);
        }`
    alpha: number = 1
    progress: number = 0
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uProgress', this.progress)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Cartoon — luminance posterise + Sobel-ish edge mask.
// --------------------------------------------------------------------------
export class CartoonEffect extends Effect {
    static readonly KEY = 'reef.Cartoon'
    static readonly FRAGMENT = `${HEAD}
        uniform float uColorLevel;
        uniform float uEdgeSize;
        uniform float uEdgeStrength;
        float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
        void main() {
            ${SAMPLE_SRC}
            vec2 px = uEdgeSize / resolution;
            float c = lum(src.rgb);
            float gx =
                lum(texture2D(uMainSampler, outTexCoord + vec2(px.x, 0.0)).rgb) -
                lum(texture2D(uMainSampler, outTexCoord - vec2(px.x, 0.0)).rgb);
            float gy =
                lum(texture2D(uMainSampler, outTexCoord + vec2(0.0, px.y)).rgb) -
                lum(texture2D(uMainSampler, outTexCoord - vec2(0.0, px.y)).rgb);
            float edge = smoothstep(0.05, 0.2, length(vec2(gx, gy))) * uEdgeStrength;
            vec3 quant = floor(src.rgb * uColorLevel + 0.5) / uColorLevel;
            vec3 outRgb = quant * (1.0 - edge);
            ${MIX_OUT}
        }`
    alpha: number = 1
    colorLevel: number = 5
    edgeSize: number = 1
    edgeStrength: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uColorLevel', this.colorLevel)
        pm.setUniform('uEdgeSize', this.edgeSize)
        pm.setUniform('uEdgeStrength', this.edgeStrength)
    }
}
