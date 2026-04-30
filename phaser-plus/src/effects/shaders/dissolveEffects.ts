import Effect from '../Effect'
import { HEAD, HASH, NOISE, LUMINANCE, SAMPLE_SRC, MIX_OUT } from './_prelude'

// --------------------------------------------------------------------------
// DesintegrationFX — fbm-threshold dissolve with glowing burn edge.
// --------------------------------------------------------------------------
export class DesintegrationFXEffect extends Effect {
    static readonly KEY = 'reef.DesintegrationFX'
    static readonly FRAGMENT = `${HEAD}${HASH}${NOISE}
        uniform float uSeed;
        uniform float uAmount;
        uniform vec3 uColor;
        void main() {
            ${SAMPLE_SRC}
            float n = fbm(outTexCoord * 6.0 + uSeed * 11.0);
            float burn = smoothstep(uAmount - 0.04, uAmount + 0.06, n);
            float ember = smoothstep(uAmount - 0.04, uAmount, n) * (1.0 - burn);
            float a = src.a * burn;
            vec3 outRgb = mix(uColor * 1.4, src.rgb, burn);
            gl_FragColor = vec4(clamp(mix(src.rgb, outRgb, uAlpha), 0.0, 1.0), a);
        }`
    alpha: number = 1
    seed: number = 1
    amount: number = 0.45
    r: number = 1.0; g: number = 0.55; b: number = 0.10
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uSeed', this.seed)
        pm.setUniform('uAmount', this.amount)
        pm.setUniform('uColor', [this.r, this.g, this.b])
    }
}

// --------------------------------------------------------------------------
// DestroyedFX — Voronoi cracks + per-cell shatter dissolve.
// --------------------------------------------------------------------------
export class DestroyedFXEffect extends Effect {
    static readonly KEY = 'reef.DestroyedFX'
    static readonly FRAGMENT = `${HEAD}${HASH}
        uniform float uSeed;
        uniform float uAmount;
        void main() {
            ${SAMPLE_SRC}
            vec2 cellId = floor(outTexCoord * 28.0);
            vec2 cellUv = fract(outTexCoord * 28.0);
            float jitter = hash(cellId + uSeed);

            float visible = step(uAmount, jitter);
            vec2 toCenter = abs(cellUv - 0.5) * 2.0;
            float crack = smoothstep(0.85, 1.0, max(toCenter.x, toCenter.y));
            float a = src.a * visible * (1.0 - crack * 0.7);

            vec3 outRgb = src.rgb * (1.0 - crack * 0.3);
            gl_FragColor = vec4(clamp(mix(src.rgb, outRgb, uAlpha), 0.0, 1.0), a);
        }`
    alpha: number = 1
    seed: number = 1
    amount: number = 0.3
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uSeed', this.seed)
        pm.setUniform('uAmount', this.amount)
    }
}

// --------------------------------------------------------------------------
// CompressionFX — JPEG-style block snap + per-block colour quantisation +
// chroma sub-sampling for an authentic compression artefact.
// --------------------------------------------------------------------------
export class CompressionFXEffect extends Effect {
    static readonly KEY = 'reef.CompressionFX'
    static readonly FRAGMENT = `${HEAD}${LUMINANCE}
        uniform float uBlocks;
        uniform float uQuality;
        void main() {
            vec2 q = floor(outTexCoord * uBlocks) / uBlocks;
            vec2 chroma = floor(outTexCoord * uBlocks * 0.5) / (uBlocks * 0.5);
            vec4 src = texture2D(uMainSampler, outTexCoord);
            vec4 lumS = texture2D(uMainSampler, q);
            vec4 chS  = texture2D(uMainSampler, chroma);
            float quant = max(2.0, uQuality * 12.0);
            vec3 yuv = vec3(luma(lumS.rgb), chS.r - chS.g * 0.5, chS.b - chS.g * 0.5);
            yuv = floor(yuv * quant) / quant;
            vec3 outRgb = vec3(
                yuv.x + yuv.y,
                yuv.x - 0.5 * yuv.y - 0.5 * yuv.z,
                yuv.x + yuv.z
            );
            ${MIX_OUT}
        }`
    alpha: number = 1
    blocks: number = 64
    quality: number = 0.4
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uBlocks', Math.max(1, this.blocks))
        pm.setUniform('uQuality', this.quality)
    }
}

// --------------------------------------------------------------------------
// Pixel — UV pixelation, samples at the centre of each block.
// --------------------------------------------------------------------------
export class PixelEffect extends Effect {
    static readonly KEY = 'reef.Pixel'
    static readonly FRAGMENT = `${HEAD}
        uniform float uOffset;
        void main() {
            vec2 size = vec2(uOffset);
            vec2 q = (floor(outTexCoord * size) + 0.5) / size;
            vec4 src = texture2D(uMainSampler, q);
            vec3 outRgb = src.rgb;
            ${MIX_OUT}
        }`
    alpha: number = 1
    offset: number = 32
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uOffset', Math.max(1, this.offset))
    }
}

// --------------------------------------------------------------------------
// Pixel_8_Bits_Black_ — pixelation + ordered dither + b/w levels.
// --------------------------------------------------------------------------
export class Pixel8BitsBlackEffect extends Effect {
    static readonly KEY = 'reef.Pixel8BitsBlack'
    static readonly FRAGMENT = `${HEAD}${LUMINANCE}
        uniform float uSize;
        uniform float uLevels;
        void main() {
            float pix = max(8.0, 96.0 / uSize);
            vec2 q = (floor(outTexCoord * pix) + 0.5) / pix;
            vec4 src = texture2D(uMainSampler, q);
            float l = luma(src.rgb);
            float bayer = mod(floor(outTexCoord.x * pix) + floor(outTexCoord.y * pix), 2.0) * 0.05;
            l = floor((l + bayer) * uLevels) / uLevels;
            vec3 outRgb = vec3(l);
            ${MIX_OUT}
        }`
    alpha: number = 1
    size: number = 1
    levels: number = 4
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uSize', this.size)
        pm.setUniform('uLevels', Math.max(2, this.levels))
    }
}

// --------------------------------------------------------------------------
// Pixel_8_Bits_Commodore_64 — pixelate + nearest-match 16-colour palette.
// --------------------------------------------------------------------------
export class Pixel8BitsCommodoreEffect extends Effect {
    static readonly KEY = 'reef.Pixel8BitsCommodore'
    static readonly FRAGMENT = `${HEAD}
        uniform float uSize;
        const int N = 16;
        vec3 pal(int i) {
            if (i==0)  return vec3(0.0, 0.0, 0.0);
            if (i==1)  return vec3(1.0, 1.0, 1.0);
            if (i==2)  return vec3(0.53, 0.0, 0.0);
            if (i==3)  return vec3(0.66, 1.0, 0.93);
            if (i==4)  return vec3(0.80, 0.27, 0.84);
            if (i==5)  return vec3(0.0, 0.79, 0.32);
            if (i==6)  return vec3(0.0, 0.0, 0.67);
            if (i==7)  return vec3(0.93, 0.93, 0.47);
            if (i==8)  return vec3(0.88, 0.47, 0.0);
            if (i==9)  return vec3(0.40, 0.27, 0.0);
            if (i==10) return vec3(1.0, 0.47, 0.47);
            if (i==11) return vec3(0.20, 0.20, 0.20);
            if (i==12) return vec3(0.47, 0.47, 0.47);
            if (i==13) return vec3(0.40, 1.0, 0.40);
            if (i==14) return vec3(0.40, 0.40, 1.0);
            return vec3(0.73, 0.73, 0.73);
        }
        void main() {
            float pix = max(8.0, 96.0 / uSize);
            vec2 q = (floor(outTexCoord * pix) + 0.5) / pix;
            vec4 src = texture2D(uMainSampler, q);
            float best = 1e9;
            vec3 chosen = src.rgb;
            for (int i = 0; i < N; i++) {
                vec3 p = pal(i);
                vec3 diff = p - src.rgb;
                float d = dot(diff, diff);
                if (d < best) { best = d; chosen = p; }
            }
            vec3 outRgb = chosen;
            ${MIX_OUT}
        }`
    alpha: number = 1
    size: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uSize', this.size)
    }
}

// --------------------------------------------------------------------------
// Pixel_8_Bits_Gameboy — pixelate + 4-tone DMG green palette.
// --------------------------------------------------------------------------
export class Pixel8BitsGameboyEffect extends Effect {
    static readonly KEY = 'reef.Pixel8BitsGameboy'
    static readonly FRAGMENT = `${HEAD}${LUMINANCE}
        uniform float uSize;
        void main() {
            float pix = max(8.0, 96.0 / uSize);
            vec2 q = (floor(outTexCoord * pix) + 0.5) / pix;
            vec4 src = texture2D(uMainSampler, q);
            float l = luma(src.rgb);
            vec3 c0 = vec3(0.06, 0.22, 0.06);
            vec3 c1 = vec3(0.19, 0.38, 0.19);
            vec3 c2 = vec3(0.55, 0.67, 0.06);
            vec3 c3 = vec3(0.61, 0.74, 0.06);
            vec3 outRgb = l < 0.25 ? c0 : (l < 0.5 ? c1 : (l < 0.75 ? c2 : c3));
            ${MIX_OUT}
        }`
    alpha: number = 1
    size: number = 1
    applyUniforms(pm: any): void {
        pm.setUniform('uAlpha', this.alpha)
        pm.setUniform('uSize', this.size)
    }
}
