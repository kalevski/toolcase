/**
 * Shared GLSL prelude for reef effect fragment shaders.
 *
 * `HEAD` declares the standard uniforms Phaser provides plus reef's `uTime`
 * and `uAlpha`. `HASH`, `NOISE` are procedural-noise helpers used by animated
 * effects. `RGB_HSV` / `HSV_RGB` are colour conversions. `LUMINANCE` is the
 * BT.601 luminance dot.
 *
 * Effects sample the source via `SAMPLE_SRC` and end with `MIX_OUT` which:
 *   - mixes processed colour with the source by `uAlpha`
 *   - clamps to LDR (0..1) to avoid overflow
 *   - preserves source alpha so transparent silhouette pixels stay clear
 */
export const HEAD = /* glsl */ `
#pragma phaserTemplate(shaderName)
precision mediump float;
uniform sampler2D uMainSampler;
uniform vec2 resolution;
varying vec2 outTexCoord;
uniform float uAlpha;
uniform float uTime;
`

export const HASH = /* glsl */ `
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
vec2 hash2(vec2 p) {
    return fract(sin(vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
    )) * 43758.5453);
}
`

export const NOISE = /* glsl */ `
float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
        v += amp * vnoise(p);
        p = p * 2.03 + 17.7;
        amp *= 0.5;
    }
    return v;
}
`

export const RGB_HSV = /* glsl */ `
vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
`

export const LUMINANCE = /* glsl */ `
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
`

/** Sample with UV clamped to [0,1]; safe to use after a UV displacement. */
export const SAFE_SAMPLE = /* glsl */ `
vec4 safeSample(vec2 uv) {
    return texture2D(uMainSampler, clamp(uv, vec2(0.0), vec2(1.0)));
}
`

export const SAMPLE_SRC = /* glsl */ `vec4 src = texture2D(uMainSampler, outTexCoord);`

/** Mix `outRgb` with `src.rgb` by `uAlpha` and preserve source alpha. */
export const MIX_OUT = /* glsl */ `
gl_FragColor = vec4(clamp(mix(src.rgb, outRgb, uAlpha), 0.0, 1.0), src.a);
`
