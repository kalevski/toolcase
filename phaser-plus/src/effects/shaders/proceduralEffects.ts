import Effect from '../Effect'
import { HEAD, HASH, NOISE, LUMINANCE, SAMPLE_SRC, MIX_OUT } from './_prelude'

// --------------------------------------------------------------------------
// Noise — static procedural film grain mixed multiplicatively.
// --------------------------------------------------------------------------
export class NoiseEffect extends Effect {
    static readonly KEY = 'reef.Noise'
    static readonly FRAGMENT = `${HEAD}${HASH}
        uniform float uNoise;
        void main() {
            ${SAMPLE_SRC}
            float n = hash(outTexCoord * resolution) - 0.5;
            vec3 outRgb = src.rgb * (1.0 + n * uNoise);
            ${MIX_OUT}
        }`
    alpha: number = 1
    noise: number = 0.5
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uNoise', this.noise)
    }
}

// --------------------------------------------------------------------------
// NoiseAnimated — animated TV static with breathing intensity.
// --------------------------------------------------------------------------
export class NoiseAnimatedEffect extends Effect {
    static readonly KEY = 'reef.NoiseAnimated'
    static readonly FRAGMENT = `${HEAD}${HASH}
        uniform float uNoise;
        void main() {
            ${SAMPLE_SRC}
            float seed = floor(uTime * 60.0);
            float n = hash(outTexCoord * resolution + seed) - 0.5;
            float breath = 0.7 + 0.3 * sin(uTime * 1.5);
            vec3 outRgb = src.rgb * (1.0 + n * uNoise * breath);
            ${MIX_OUT}
        }`
    alpha: number = 1
    noise: number = 0.5
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uNoise', this.noise)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Blood — drift toward red plus animated drip streaks.
// --------------------------------------------------------------------------
export class BloodEffect extends Effect {
    static readonly KEY = 'reef.Blood'
    static readonly FRAGMENT = `${HEAD}${HASH}${NOISE}
        uniform float uTurnToBlood;
        uniform float uBlood;
        void main() {
            ${SAMPLE_SRC}
            vec3 reddened = mix(src.rgb, vec3(0.60, 0.04, 0.04) * (0.6 + 0.4 * src.r), uTurnToBlood);

            float column = floor(outTexCoord.x * 80.0);
            float seed = hash(vec2(column));
            float dripStart = seed * 0.4 + 0.05;
            float dripLen = 0.2 + seed * 0.5;
            float drift = mod(uTime * (0.05 + seed * 0.05), 1.2) - 0.2;
            float local = (outTexCoord.y - dripStart - drift) / dripLen;
            float drip = step(0.0, local) * (1.0 - smoothstep(0.0, 1.0, local));

            float n = vnoise(vec2(column, outTexCoord.y * 30.0));
            vec3 dripCol = vec3(0.55, 0.0, 0.0) * (0.7 + n * 0.3);
            vec3 outRgb = mix(reddened, dripCol, drip * uBlood);
            ${MIX_OUT}
        }`
    alpha: number = 1
    turnToBlood: number = 0.4
    blood: number = 0.6
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uTurnToBlood', this.turnToBlood)
        pm.setUniform('uBlood', this.blood)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// BurningFX — bottom-to-top char sweep with palette ember edge.
// --------------------------------------------------------------------------
export class BurningFXEffect extends Effect {
    static readonly KEY = 'reef.BurningFX'
    static readonly FRAGMENT = `${HEAD}${HASH}${NOISE}
        uniform float uColors;
        uniform float uSpeed;
        void main() {
            ${SAMPLE_SRC}
            float t = mod(uTime * uSpeed * 0.25, 1.6) - 0.3;
            float n = fbm(outTexCoord * vec2(20.0, 6.0)) * 0.18;
            float p = outTexCoord.y + n;
            float ember = smoothstep(t - 0.05, t + 0.04, p);
            float charred = smoothstep(t + 0.04, t + 0.18, p);
            vec3 emberCol = mix(
                vec3(1.0, 0.20, 0.02),
                vec3(1.0, 0.80, 0.20),
                clamp(uColors / 4.0, 0.0, 1.0)
            );
            vec3 charCol = vec3(0.05, 0.02, 0.02);
            vec3 outRgb = mix(charCol, emberCol, ember);
            outRgb = mix(outRgb, src.rgb, charred);
            ${MIX_OUT}
        }`
    alpha: number = 1
    colors: number = 1
    speed: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uColors', this.colors)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Fire — fbm flame with rising tongues, bottom-anchored mask.
// --------------------------------------------------------------------------
export class FireEffect extends Effect {
    static readonly KEY = 'reef.Fire'
    static readonly FRAGMENT = `${HEAD}${HASH}${NOISE}
        uniform float uFreq;
        uniform float uIntensity;
        uniform float uSpeed;
        void main() {
            ${SAMPLE_SRC}
            vec2 q = outTexCoord * vec2(uFreq * 0.04, uFreq * 0.06);
            q.y -= uTime * uSpeed * 1.3;
            float n = fbm(q) + fbm(q * 2.5 + vec2(7.3)) * 0.3;
            float gradient = pow(1.0 - outTexCoord.y, 1.4);
            float fire = smoothstep(0.35, 0.95, n * gradient * uIntensity);
            vec3 dark = vec3(0.20, 0.00, 0.00);
            vec3 mid  = vec3(1.00, 0.35, 0.05);
            vec3 hot  = vec3(1.00, 0.90, 0.45);
            vec3 white = vec3(1.00, 1.00, 0.92);
            vec3 fireCol = mix(dark, mid, smoothstep(0.0, 0.4, fire));
            fireCol = mix(fireCol, hot, smoothstep(0.4, 0.75, fire));
            fireCol = mix(fireCol, white, smoothstep(0.85, 1.0, fire));
            vec3 outRgb = mix(src.rgb, fireCol, fire);
            ${MIX_OUT}
        }`
    alpha: number = 1
    freq: number = 80
    intensity: number = 1.2
    speed: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uFreq', this.freq)
        pm.setUniform('uIntensity', this.intensity)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// FireAdditive — same flame, additive blend on top of source.
// --------------------------------------------------------------------------
export class FireAdditiveEffect extends Effect {
    static readonly KEY = 'reef.FireAdditive'
    static readonly FRAGMENT = `${HEAD}${HASH}${NOISE}
        uniform float uFreq;
        uniform float uIntensity;
        uniform float uSpeed;
        void main() {
            ${SAMPLE_SRC}
            vec2 q = outTexCoord * vec2(uFreq * 0.04, uFreq * 0.06);
            q.y -= uTime * uSpeed * 1.3;
            float n = fbm(q);
            float gradient = pow(1.0 - outTexCoord.y, 1.4);
            float fire = smoothstep(0.35, 0.95, n * gradient * uIntensity);
            vec3 hot = vec3(1.00, 0.55, 0.10) * fire * 1.4;
            vec3 outRgb = clamp(src.rgb + hot, 0.0, 1.0);
            ${MIX_OUT}
        }`
    alpha: number = 1
    freq: number = 80
    intensity: number = 1.2
    speed: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uFreq', this.freq)
        pm.setUniform('uIntensity', this.intensity)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Smoke — drifting fbm wisps from `uColor1` to `uColor2`.
// --------------------------------------------------------------------------
export class SmokeEffect extends Effect {
    static readonly KEY = 'reef.Smoke'
    static readonly FRAGMENT = `${HEAD}${HASH}${NOISE}
        uniform float uFreq;
        uniform float uSpeed;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        void main() {
            ${SAMPLE_SRC}
            vec2 q = outTexCoord * vec2(uFreq * 0.03, uFreq * 0.04);
            q.y -= uTime * uSpeed * 0.6;
            float n = fbm(q + vec2(uTime * 0.2, 0.0));
            float wisp = smoothstep(0.35, 0.85, n) * (1.0 - outTexCoord.y * 0.5);
            vec3 smoke = mix(uColor1, uColor2, smoothstep(0.4, 0.8, n));
            vec3 outRgb = mix(src.rgb, smoke, wisp);
            ${MIX_OUT}
        }`
    alpha: number = 1
    freq: number = 64
    speed: number = 1
    c1r: number = 0.20; c1g: number = 0.20; c1b: number = 0.25
    c2r: number = 0.85; c2g: number = 0.85; c2b: number = 0.92
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uFreq', this.freq)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uColor1', [this.c1r, this.c1g, this.c1b])
        pm.setUniform('uColor2', [this.c2r, this.c2g, this.c2b])
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Frozen — pale tint, micro UV jitter, drifting sparkle highlights.
// --------------------------------------------------------------------------
export class FrozenEffect extends Effect {
    static readonly KEY = 'reef.Frozen'
    static readonly FRAGMENT = `${HEAD}${HASH}
        uniform float uDensity;
        void main() {
            float seedT = floor(uTime * 6.0);
            vec2 jitter = (vec2(hash(outTexCoord * resolution + seedT), hash(outTexCoord * resolution * 1.3 + seedT)) - 0.5) * 0.005 * uDensity;
            vec4 src = texture2D(uMainSampler, clamp(outTexCoord + jitter, 0.0, 1.0));
            vec3 frost = mix(src.rgb, vec3(0.78, 0.93, 1.00), 0.55 * uDensity);
            float sparkle = step(0.985, hash(floor(outTexCoord * 90.0) + seedT));
            float crystal = smoothstep(0.85, 1.0, hash(floor(outTexCoord * 30.0)));
            vec3 outRgb = clamp(frost + sparkle * vec3(0.6, 0.8, 1.0) + crystal * vec3(0.12), 0.0, 1.0);
            ${MIX_OUT}
        }`
    alpha: number = 1
    density: number = 0.7
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uDensity', this.density)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Ice — refraction-style UV displacement plus crystal shards.
// --------------------------------------------------------------------------
export class IceEffect extends Effect {
    static readonly KEY = 'reef.Ice'
    static readonly FRAGMENT = `${HEAD}${HASH}${NOISE}${LUMINANCE}
        uniform float uFreq;
        uniform float uIntensity;
        void main() {
            vec2 q = outTexCoord * uFreq * 0.08;
            float a = vnoise(q);
            float b = vnoise(q + 5.3);
            vec2 disp = (vec2(a, b) - 0.5) * 0.012 * uIntensity;
            vec4 src = texture2D(uMainSampler, clamp(outTexCoord + disp, 0.0, 1.0));
            float crystals = smoothstep(0.55, 0.95, fbm(q));
            vec3 ice = mix(vec3(0.45, 0.65, 0.85), vec3(0.95, 1.00, 1.00), crystals);
            float gloss = pow(crystals, 2.0);
            vec3 outRgb = mix(src.rgb, ice, crystals * uIntensity) + gloss * 0.18;
            ${MIX_OUT}
        }`
    alpha: number = 1
    freq: number = 80
    intensity: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uFreq', this.freq)
        pm.setUniform('uIntensity', this.intensity)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// Lightning — drifting fbm field, threshold to bright forks plus glow.
// --------------------------------------------------------------------------
export class LightningEffect extends Effect {
    static readonly KEY = 'reef.Lightning'
    static readonly FRAGMENT = `${HEAD}${HASH}${NOISE}
        uniform float uIntensity;
        uniform float uSpeed;
        void main() {
            ${SAMPLE_SRC}
            float flicker = step(0.4, hash(vec2(floor(uTime * 6.0), 1.0)));
            vec2 q = outTexCoord * vec2(50.0, 8.0);
            q.y += uTime * uSpeed * 0.8;
            float field = fbm(q);
            float bolt = smoothstep(0.92, 0.98, field);
            float glow = smoothstep(0.78, 0.95, field) * 0.5;
            vec3 spark = vec3(0.55, 0.78, 1.20);
            vec3 outRgb = clamp(src.rgb + (bolt + glow) * spark * uIntensity * (0.4 + flicker * 0.6), 0.0, 1.0);
            ${MIX_OUT}
        }`
    alpha: number = 1
    intensity: number = 1.4
    speed: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uIntensity', this.intensity)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// LightningBolt — single dominant bolt that wanders across the sprite.
// --------------------------------------------------------------------------
export class LightningBoltEffect extends Effect {
    static readonly KEY = 'reef.LightningBolt'
    static readonly FRAGMENT = `${HEAD}${HASH}${NOISE}
        uniform float uIntensity;
        uniform float uSpeed;
        void main() {
            ${SAMPLE_SRC}
            float t = uTime * uSpeed;
            float jitter = (fbm(vec2(outTexCoord.y * 20.0, t * 4.0)) - 0.5) * 0.18;
            float drift = sin(t * 0.7) * 0.1;
            float dist = abs(outTexCoord.x - 0.5 - jitter - drift);
            float core = smoothstep(0.025, 0.0, dist);
            float halo = smoothstep(0.10, 0.0, dist) * 0.4;
            float strobe = step(0.65, hash(vec2(floor(t * 8.0), 0.0)));
            vec3 outRgb = clamp(src.rgb + (core + halo) * vec3(0.6, 0.8, 1.3) * uIntensity * (0.3 + strobe * 0.7), 0.0, 1.0);
            ${MIX_OUT}
        }`
    alpha: number = 1
    intensity: number = 1.6
    speed: number = 1
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uIntensity', this.intensity)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// PlasmaRainbow — animated trig-sum plasma in rainbow palette.
// --------------------------------------------------------------------------
export class PlasmaRainbowEffect extends Effect {
    static readonly KEY = 'reef.PlasmaRainbow'
    static readonly FRAGMENT = `${HEAD}
        uniform float uColors;
        uniform float uOffset;
        uniform float uSpeed;
        uniform float uMix;
        void main() {
            ${SAMPLE_SRC}
            float t = uTime * uSpeed;
            vec2 p = outTexCoord * uOffset;
            float v = sin(p.x + t)
                    + sin(p.y * 1.3 + t * 0.7)
                    + sin((p.x + p.y) * 0.5 + t * 1.3)
                    + sin(length(p - 0.5 * uOffset) + t * 1.7);
            float h = fract(v * (1.0 / max(0.1, uColors)));
            vec3 rainbow = clamp(vec3(
                abs(h * 6.0 - 3.0) - 1.0,
                2.0 - abs(h * 6.0 - 2.0),
                2.0 - abs(h * 6.0 - 4.0)
            ), 0.0, 1.0);
            vec3 outRgb = mix(src.rgb, src.rgb * rainbow * 1.4, uMix);
            ${MIX_OUT}
        }`
    alpha: number = 1
    colors: number = 6
    offset: number = 8
    speed: number = 1
    mix: number = 0.7
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uColors', this.colors)
        pm.setUniform('uOffset', this.offset)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uMix', this.mix)
        pm.setUniform('uTime', time)
    }
}

// --------------------------------------------------------------------------
// PlasmaShield — single-colour plasma overlay used as a force field skin.
// --------------------------------------------------------------------------
export class PlasmaShieldEffect extends Effect {
    static readonly KEY = 'reef.PlasmaShield'
    static readonly FRAGMENT = `${HEAD}
        uniform float uOffset;
        uniform float uSpeed;
        uniform vec3 uColor;
        void main() {
            ${SAMPLE_SRC}
            float t = uTime * uSpeed;
            vec2 p = outTexCoord * uOffset;
            float v = sin(p.x + t)
                    + sin(p.y * 1.3 + t * 0.7)
                    + sin((p.x + p.y) * 0.5 + t * 1.3);
            float plasma = clamp(0.5 + v * 0.166, 0.0, 1.0);
            float pulse = 0.85 + 0.15 * sin(uTime * 3.0);
            vec3 outRgb = clamp(src.rgb + uColor * plasma * 0.7 * pulse, 0.0, 1.0);
            ${MIX_OUT}
        }`
    alpha: number = 1
    offset: number = 8
    speed: number = 1.5
    r: number = 0.45; g: number = 0.75; b: number = 1.10
    applyUniforms(pm: any, time: number): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uOffset', this.offset)
        pm.setUniform('uSpeed', this.speed)
        pm.setUniform('uColor', [this.r, this.g, this.b])
        pm.setUniform('uTime', time)
    }
}
