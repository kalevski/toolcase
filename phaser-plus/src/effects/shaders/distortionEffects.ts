import Effect from '../Effect'
import { HEAD, HASH, NOISE, SAFE_SAMPLE, MIX_OUT } from './_prelude'

// --------------------------------------------------------------------------
// BlackHole — radial pull, swirl, and accretion-disk glow.
// --------------------------------------------------------------------------
export class BlackHoleEffect extends Effect {
    static readonly KEY = 'reef.BlackHole'
    static readonly FRAGMENT = `${HEAD}${SAFE_SAMPLE}
        uniform float uDistortion;
        uniform float uHole;
        uniform float uSpeed;
        uniform vec3 uColor;
        void main() {
            vec2 p = outTexCoord - 0.5;
            float r = length(p);
            float a = atan(p.y, p.x) + uTime * uSpeed * 0.3 / max(0.05, r);
            float warp = pow(1.0 - clamp(r, 0.0, 1.0), 1.0 + uDistortion);
            vec2 uv = vec2(cos(a), sin(a)) * r * warp + 0.5;
            vec4 src = safeSample(uv);
            float horizon = smoothstep(uHole, uHole + 0.04, r);
            float disk = smoothstep(uHole + 0.04, uHole + 0.18, r) * (1.0 - smoothstep(uHole + 0.18, uHole + 0.35, r));
            vec3 base = src.rgb * uColor * horizon;
            vec3 outRgb = base + disk * vec3(1.2, 0.6, 0.2);
            ${MIX_OUT}
        }`
    alpha: number = 1
    distortion: number = 1.2
    hole: number = 0.05
    speed: number = 4
    r: number = 0.7; g: number = 0.55; b: number = 1.1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uDistortion', this.distortion)
        pm.setUniform('uHole', this.hole)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uColor', [this.r, this.g, this.b])
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Twist — polar pinwheel with smooth radial falloff.
// --------------------------------------------------------------------------
export class TwistEffect extends Effect {
    static readonly KEY: string = 'reef.Twist'
    static readonly FRAGMENT: string = `${HEAD}${SAFE_SAMPLE}
        uniform float uDistortion;
        uniform vec2 uCenter;
        uniform float uRadius;
        uniform vec3 uColor;
        void main() {
            vec2 p = outTexCoord - uCenter;
            float r = length(p);
            float falloff = smoothstep(uRadius, 0.0, r);
            float a = atan(p.y, p.x) + uDistortion * falloff;
            vec2 uv = vec2(cos(a), sin(a)) * r + uCenter;
            vec4 src = safeSample(uv);
            vec3 outRgb = src.rgb * uColor;
            ${MIX_OUT}
        }`
    alpha: number = 1
    distortion: number = 1.6
    posX: number = 0.5
    posY: number = 0.5
    radius: number = 0.6
    r: number = 1; g: number = 1; b: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uDistortion', this.distortion)
        pm.setUniform('uCenter', [this.posX, this.posY])
        pm.setUniform('uRadius', this.radius)
        pm.setUniform('uColor', [this.r, this.g, this.b])
    }
}

// --------------------------------------------------------------------------
// Distortion — animated dual-axis sine UV ripple, clamped sampling.
// --------------------------------------------------------------------------
export class DistortionEffect extends Effect {
    static readonly KEY: string = 'reef.Distortion'
    static readonly FRAGMENT: string = `${HEAD}${SAFE_SAMPLE}
        uniform vec2 uOffset;
        uniform vec2 uDistance;
        uniform vec2 uPhase;
        void main() {
            vec2 d = vec2(
                sin(outTexCoord.y * uOffset.x + uPhase.x) * uDistance.x,
                sin(outTexCoord.x * uOffset.y + uPhase.y) * uDistance.y
            );
            vec4 src = safeSample(outTexCoord + d);
            vec3 outRgb = src.rgb;
            ${MIX_OUT}
        }`
    alpha: number = 1
    offsetX: number = 14; offsetY: number = 10
    distanceX: number = 0.025; distanceY: number = 0.025
    phaseX: number = 0; phaseY: number = 0
    autoSpeedX: number = 1.4; autoSpeedY: number = 1.1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uOffset', [this.offsetX, this.offsetY])
        pm.setUniform('uDistance', [this.distanceX, this.distanceY])
        pm.setUniform('uPhase', [this.phaseX + time * this.autoSpeedX, this.phaseY + time * this.autoSpeedY])
    }
}

// --------------------------------------------------------------------------
// DistortionAdditive — distorted source brightened, suitable for additive draw.
// --------------------------------------------------------------------------
export class DistortionAdditiveEffect extends DistortionEffect {
    static readonly KEY: string = 'reef.DistortionAdditive'
    static readonly FRAGMENT: string = `${HEAD}${SAFE_SAMPLE}
        uniform vec2 uOffset;
        uniform vec2 uDistance;
        uniform vec2 uPhase;
        void main() {
            vec2 d = vec2(
                sin(outTexCoord.y * uOffset.x + uPhase.x) * uDistance.x,
                sin(outTexCoord.x * uOffset.y + uPhase.y) * uDistance.y
            );
            vec4 src = safeSample(outTexCoord + d);
            vec3 outRgb = clamp(src.rgb * 1.6, 0.0, 1.0);
            ${MIX_OUT}
        }`
}

// --------------------------------------------------------------------------
// Wave — intentional alias of DistortionEffect registered under a separate KEY
// for API parity with effects.md. Shares DistortionEffect.FRAGMENT exactly;
// visual behaviour is identical. Prefer DistortionEffect for new code.
// --------------------------------------------------------------------------
export class WaveEffect extends DistortionEffect {
    static readonly KEY: string = 'reef.Wave'
}

// --------------------------------------------------------------------------
// MysticDistortion — ripple plus animated horizontal pitch bands and glow.
// --------------------------------------------------------------------------
export class MysticDistortionEffect extends Effect {
    static readonly KEY: string = 'reef.MysticDistortion'
    static readonly FRAGMENT: string = `${HEAD}${SAFE_SAMPLE}
        uniform vec2 uOffset;
        uniform vec2 uDistance;
        uniform vec2 uPhase;
        uniform float uPitch;
        uniform float uPitchSpeed;
        uniform float uPitchOffset;
        uniform vec3 uGlow;
        void main() {
            vec2 d = vec2(
                sin(outTexCoord.y * uOffset.x + uPhase.x) * uDistance.x,
                sin(outTexCoord.x * uOffset.y + uPhase.y) * uDistance.y
            );
            float band = sin(outTexCoord.y * 90.0 + uTime * uPitchSpeed * 1.4 + uPitchOffset);
            d.x += band * uPitch * 0.05;
            vec4 src = safeSample(outTexCoord + d);
            float aura = smoothstep(0.0, 0.6, abs(band)) * 0.3;
            vec3 outRgb = src.rgb + uGlow * aura;
            ${MIX_OUT}
        }`
    alpha: number = 1
    offsetX: number = 56; offsetY: number = 28
    distanceX: number = 0.012; distanceY: number = 0.04
    phaseX: number = 1.16; phaseY: number = 5.12
    pitch: number = 0.5
    pitchSpeed: number = 1.2
    pitchOffset: number = 0
    gr: number = 0.4; gg: number = 0.2; gb: number = 0.7
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uOffset', [this.offsetX, this.offsetY])
        pm.setUniform('uDistance', [this.distanceX, this.distanceY])
        pm.setUniform('uPhase', [this.phaseX + time, this.phaseY + time])
        pm.setUniform('uPitch', this.pitch)
        pm.setUniform('uPitchSpeed', this.pitchSpeed)
        pm.setUniform('uPitchOffset', this.pitchOffset)
        pm.setUniform('uGlow', [this.gr, this.gg, this.gb])
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// MysticDistortionAdditive — additive-blend variant of MysticDistortionEffect.
// Brightens the distorted output (×1.6, clamped) so it composes correctly
// under Phaser's additive blend mode, mirroring DistortionAdditiveEffect.
// --------------------------------------------------------------------------
export class MysticDistortionAdditiveEffect extends MysticDistortionEffect {
    static readonly KEY: string = 'reef.MysticDistortionAdditive'
    static readonly FRAGMENT: string = `${HEAD}${SAFE_SAMPLE}
        uniform vec2 uOffset;
        uniform vec2 uDistance;
        uniform vec2 uPhase;
        uniform float uPitch;
        uniform float uPitchSpeed;
        uniform float uPitchOffset;
        uniform vec3 uGlow;
        void main() {
            vec2 d = vec2(
                sin(outTexCoord.y * uOffset.x + uPhase.x) * uDistance.x,
                sin(outTexCoord.x * uOffset.y + uPhase.y) * uDistance.y
            );
            float band = sin(outTexCoord.y * 90.0 + uTime * uPitchSpeed * 1.4 + uPitchOffset);
            d.x += band * uPitch * 0.05;
            vec4 src = safeSample(outTexCoord + d);
            float aura = smoothstep(0.0, 0.6, abs(band)) * 0.3;
            vec3 outRgb = clamp((src.rgb + uGlow * aura) * 1.6, 0.0, 1.0);
            ${MIX_OUT}
        }`
}

// --------------------------------------------------------------------------
// Heat — animated fbm UV displacement plus chromatic shimmer.
// --------------------------------------------------------------------------
export class HeatEffect extends Effect {
    static readonly KEY = 'reef.Heat'
    static readonly FRAGMENT = `${HEAD}${HASH}${NOISE}${SAFE_SAMPLE}
        uniform float uHeat;
        uniform float uSpeed;
        void main() {
            vec2 q = outTexCoord * 6.0;
            q.y += uTime * uSpeed * 0.6;
            vec2 d = vec2(fbm(q), fbm(q + 11.0)) - 0.5;
            d *= 0.05 * uHeat;
            float r = safeSample(outTexCoord + d * 1.05).r;
            float g = safeSample(outTexCoord + d).g;
            float b = safeSample(outTexCoord + d * 0.95).b;
            vec3 outRgb = vec3(r, g, b);
            vec4 src = safeSample(outTexCoord);
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
// Jelly — sinusoidal squish + rotational wobble around centre.
// --------------------------------------------------------------------------
export class JellyEffect extends Effect {
    static readonly KEY: string = 'reef.Jelly'
    static readonly FRAGMENT: string = `${HEAD}${SAFE_SAMPLE}
        uniform float uHeat;
        uniform float uInside;
        uniform float uSpeed;
        void main() {
            vec2 p = (outTexCoord - 0.5) / uInside;
            float t = uTime * uSpeed;
            p.x += sin(p.y * 6.0 + t) * 0.06 * uHeat;
            p.y += sin(p.x * 6.0 + t * 1.13) * 0.06 * uHeat;
            float a = sin(t * 0.7) * 0.04 * uHeat;
            vec2 rot = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
            vec4 src = safeSample(rot + 0.5);
            vec3 outRgb = src.rgb;
            ${MIX_OUT}
        }`
    alpha: number = 1
    heat: number = 1
    inside: number = 1.05
    speed: number = 1.5
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uHeat', this.heat)
        pm.setUniform('uInside', this.inside)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// JellyAutoMove — intentional alias of JellyEffect registered under a separate
// KEY for API parity. Shares JellyEffect.FRAGMENT exactly; visual behaviour is
// identical. Differentiate at call-site by supplying distinct uniform values.
// --------------------------------------------------------------------------
export class JellyAutoMoveEffect extends JellyEffect {
    static readonly KEY: string = 'reef.JellyAutoMove'
}

// --------------------------------------------------------------------------
// Liquid — fbm distortion + edge highlight, gives a wet look.
// --------------------------------------------------------------------------
export class LiquidEffect extends Effect {
    static readonly KEY: string = 'reef.Liquid'
    static readonly FRAGMENT: string = `${HEAD}${HASH}${NOISE}${SAFE_SAMPLE}
        uniform float uHeat;
        uniform float uSpeed;
        uniform float uEdge;
        uniform float uLight;
        void main() {
            vec2 q = outTexCoord * 5.5;
            q.y += uTime * uSpeed * 0.45;
            vec2 d = (vec2(fbm(q), fbm(q + 1.7)) - 0.5) * 0.07 * uHeat;
            vec4 src = safeSample(outTexCoord + d);
            float fres = pow(1.0 - abs(outTexCoord.y - 0.5) * 2.0, mix(1.5, 8.0, uEdge));
            float ripple = sin((outTexCoord.y + uTime * 0.4) * 30.0) * 0.5 + 0.5;
            vec3 highlight = vec3(0.45, 0.65, 0.95) * fres * ripple * uLight * 0.25;
            vec3 outRgb = clamp(src.rgb + highlight, 0.0, 1.0);
            ${MIX_OUT}
        }`
    alpha: number = 1
    heat: number = 1
    speed: number = 1
    edge: number = 0.7
    light: number = 3
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uHeat', this.heat)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uEdge', this.edge)
        pm.setUniform('uLight', this.light)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Liquify — vertical melt plus liquid wobble, looks like a Witch's brew.
// --------------------------------------------------------------------------
export class LiquifyEffect extends Effect {
    static readonly KEY: string = 'reef.Liquify'
    static readonly FRAGMENT: string = `${HEAD}${HASH}${NOISE}${SAFE_SAMPLE}
        uniform float uTurnToLiquid;
        uniform float uHeat;
        uniform float uSpeed;
        void main() {
            vec2 uv = outTexCoord;
            float drip = sin(outTexCoord.x * 30.0 + uTime * uSpeed) * 0.5 + 0.5;
            uv.y -= uTurnToLiquid * (1.0 - uv.y) * (0.6 + 0.4 * drip);
            vec2 q = uv * 5.0;
            q.y += uTime * uSpeed * 0.3;
            vec2 d = (vec2(fbm(q), fbm(q + 1.7)) - 0.5) * 0.05 * uHeat;
            vec4 src = safeSample(uv + d);
            vec3 outRgb = src.rgb;
            ${MIX_OUT}
        }`
    alpha: number = 1
    turnToLiquid: number = 0.15
    heat: number = 4
    speed: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uTurnToLiquid', this.turnToLiquid)
        pm.setUniform('uHeat', this.heat)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Slim — intentional alias of LiquifyEffect registered under a separate KEY
// for API parity. Shares LiquifyEffect.FRAGMENT exactly; visual behaviour is
// identical. Differentiate at call-site by supplying distinct uniform values.
// --------------------------------------------------------------------------
export class SlimEffect extends LiquifyEffect {
    static readonly KEY: string = 'reef.Slim'
}
