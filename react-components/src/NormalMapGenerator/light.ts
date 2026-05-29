// Real-time lit-preview renderer for NormalMapGenerator (task 003).
// WebGL fragment-shader path with a Canvas2D per-pixel fallback. Both operate
// in top-down normalized image space so light coordinates match the preview.

export interface ResolvedLight {
    /** Position in normalized image space [0..1], z = height. */
    x: number
    y: number
    z: number
    /** RGB in 0..1. */
    color: [number, number, number]
    intensity: number
}

export interface ShadeParams {
    albedo: Uint8ClampedArray
    normal: Uint8ClampedArray
    width: number
    height: number
    light: ResolvedLight
    ambient: number
    /** RGB in 0..1. */
    ambientColor: [number, number, number]
    specular: boolean
    shininess: number
    /** 'lit-surface' mode → force albedo white (shading only). */
    surfaceOnly: boolean
    /** Bumped when the source (albedo) changes — gates texture re-upload. */
    albedoVersion: number
    /** Bumped when the working/normal buffer changes (task 002 edits). */
    normalVersion: number
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uAlbedo;
uniform sampler2D uNormal;
uniform vec3 uLightPos;
uniform vec3 uLightColor;
uniform float uIntensity;
uniform float uAmbient;
uniform vec3 uAmbientColor;
uniform bool uSpecular;
uniform float uShininess;
uniform bool uSurfaceOnly;

void main() {
    // Sample in top-down image space so light coords match the preview.
    vec2 suv = vec2(vUv.x, 1.0 - vUv.y);
    vec4 tex = texture2D(uAlbedo, suv);
    vec3 albedo = uSurfaceOnly ? vec3(1.0) : tex.rgb;
    vec3 N = normalize(texture2D(uNormal, suv).rgb * 2.0 - 1.0);
    vec3 L = normalize(vec3(uLightPos.xy - suv, uLightPos.z));
    float diff = max(dot(N, L), 0.0);
    vec3 color = albedo * (uAmbient * uAmbientColor + diff * uIntensity * uLightColor);
    if (uSpecular) {
        vec3 V = vec3(0.0, 0.0, 1.0);
        vec3 H = normalize(L + V);
        color += pow(max(dot(N, H), 0.0), uShininess) * uLightColor * uIntensity;
    }
    gl_FragColor = vec4(color, tex.a);
}`

const compile = (gl: WebGLRenderingContext, type: number, src: string): WebGLShader => {
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh)
        gl.deleteShader(sh)
        throw new Error(`shader compile failed: ${log}`)
    }
    return sh
}

/** Holds a reusable GL context/program + two textures; falls back to Canvas2D when WebGL is unavailable. */
export class LitRenderer {
    private canvas: HTMLCanvasElement
    private gl: WebGLRenderingContext | null = null
    private program: WebGLProgram | null = null
    private albedoTex: WebGLTexture | null = null
    private normalTex: WebGLTexture | null = null
    private uniforms: Record<string, WebGLUniformLocation | null> = {}
    private albedoVersion = -1
    private normalVersion = -1
    private dims = { w: 0, h: 0 }
    // Once GL setup fails (no context, or shader compile/link error) we stop
    // retrying and stay on the Canvas2D path for this renderer's lifetime.
    private glDisabled = false

    constructor() {
        this.canvas = document.createElement('canvas')
    }

    private initGl(): boolean {
        if (this.gl) return true
        if (this.glDisabled) return false
        try {
            const attrs: WebGLContextAttributes = { alpha: true, premultipliedAlpha: false, antialias: false }
            const gl = (this.canvas.getContext('webgl', attrs) ||
                this.canvas.getContext('experimental-webgl', attrs)) as WebGLRenderingContext | null
            if (!gl) {
                this.glDisabled = true
                return false
            }

            const program = gl.createProgram()!
            const vs = compile(gl, gl.VERTEX_SHADER, VERT)
            const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
            gl.attachShader(program, vs)
            gl.attachShader(program, fs)
            gl.linkProgram(program)
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(`program link failed: ${gl.getProgramInfoLog(program)}`)
            }
            gl.deleteShader(vs)
            gl.deleteShader(fs)
            this.program = program
            gl.useProgram(program)

            // Full-screen quad.
            const buf = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, buf)
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
            const aPos = gl.getAttribLocation(program, 'aPos')
            gl.enableVertexAttribArray(aPos)
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

            for (const u of [
                'uAlbedo',
                'uNormal',
                'uLightPos',
                'uLightColor',
                'uIntensity',
                'uAmbient',
                'uAmbientColor',
                'uSpecular',
                'uShininess',
                'uSurfaceOnly',
            ]) {
                this.uniforms[u] = gl.getUniformLocation(program, u)
            }

            this.albedoTex = gl.createTexture()
            this.normalTex = gl.createTexture()
            for (const tex of [this.albedoTex, this.normalTex]) {
                gl.bindTexture(gl.TEXTURE_2D, tex)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            }
            this.gl = gl
            return true
        } catch {
            // Compile/link failed on a context that otherwise exists — drop GL
            // resources and fall back to Canvas2D for good.
            this.glDisabled = true
            this.gl = null
            this.program = null
            this.albedoTex = null
            this.normalTex = null
            return false
        }
    }

    private upload(tex: WebGLTexture, rgba: Uint8ClampedArray, w: number, h: number) {
        const gl = this.gl!
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            w,
            h,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength),
        )
    }

    /** Shades into the internal canvas and returns it (sized `width`×`height`). */
    shade(p: ShadeParams): HTMLCanvasElement {
        if (this.initGl()) return this.shadeGl(p)
        return this.shade2d(p)
    }

    private shadeGl(p: ShadeParams): HTMLCanvasElement {
        const gl = this.gl!
        if (this.dims.w !== p.width || this.dims.h !== p.height) {
            this.canvas.width = p.width
            this.canvas.height = p.height
            this.dims = { w: p.width, h: p.height }
            gl.viewport(0, 0, p.width, p.height)
            this.albedoVersion = -1
            this.normalVersion = -1
        }
        gl.useProgram(this.program)

        if (this.albedoVersion !== p.albedoVersion) {
            this.upload(this.albedoTex!, p.albedo, p.width, p.height)
            this.albedoVersion = p.albedoVersion
        }
        if (this.normalVersion !== p.normalVersion) {
            this.upload(this.normalTex!, p.normal, p.width, p.height)
            this.normalVersion = p.normalVersion
        }

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.albedoTex)
        gl.uniform1i(this.uniforms.uAlbedo, 0)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.normalTex)
        gl.uniform1i(this.uniforms.uNormal, 1)

        const l = p.light
        gl.uniform3f(this.uniforms.uLightPos, l.x, l.y, l.z)
        gl.uniform3f(this.uniforms.uLightColor, l.color[0], l.color[1], l.color[2])
        gl.uniform1f(this.uniforms.uIntensity, l.intensity)
        gl.uniform1f(this.uniforms.uAmbient, p.ambient)
        gl.uniform3f(this.uniforms.uAmbientColor, p.ambientColor[0], p.ambientColor[1], p.ambientColor[2])
        gl.uniform1i(this.uniforms.uSpecular, p.specular ? 1 : 0)
        gl.uniform1f(this.uniforms.uShininess, p.shininess)
        gl.uniform1i(this.uniforms.uSurfaceOnly, p.surfaceOnly ? 1 : 0)

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        return this.canvas
    }

    private shade2d(p: ShadeParams): HTMLCanvasElement {
        const { albedo, normal, width, height, light, ambient, ambientColor, specular, shininess, surfaceOnly } = p
        this.canvas.width = width
        this.canvas.height = height
        const ctx = this.canvas.getContext('2d')!
        const out = ctx.createImageData(width, height)
        const d = out.data

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const o = (y * width + x) * 4
                const ar = surfaceOnly ? 1 : albedo[o] / 255
                const ag = surfaceOnly ? 1 : albedo[o + 1] / 255
                const ab = surfaceOnly ? 1 : albedo[o + 2] / 255

                let nx = normal[o] / 127.5 - 1
                let ny = normal[o + 1] / 127.5 - 1
                let nz = normal[o + 2] / 127.5 - 1
                const nl = Math.hypot(nx, ny, nz) || 1
                nx /= nl
                ny /= nl
                nz /= nl

                const su = (x + 0.5) / width
                const sv = (y + 0.5) / height
                let lx = light.x - su
                let ly = light.y - sv
                let lz = light.z
                const ll = Math.hypot(lx, ly, lz) || 1
                lx /= ll
                ly /= ll
                lz /= ll

                const diff = Math.max(nx * lx + ny * ly + nz * lz, 0)
                let r = ar * (ambient * ambientColor[0] + diff * light.intensity * light.color[0])
                let g = ag * (ambient * ambientColor[1] + diff * light.intensity * light.color[1])
                let b = ab * (ambient * ambientColor[2] + diff * light.intensity * light.color[2])

                if (specular) {
                    // Half-vector with view (0,0,1).
                    let hx = lx
                    let hy = ly
                    let hz = lz + 1
                    const hl = Math.hypot(hx, hy, hz) || 1
                    hx /= hl
                    hy /= hl
                    hz /= hl
                    const spec = Math.pow(Math.max(nx * hx + ny * hy + nz * hz, 0), shininess) * light.intensity
                    r += spec * light.color[0]
                    g += spec * light.color[1]
                    b += spec * light.color[2]
                }

                d[o] = Math.min(255, r * 255)
                d[o + 1] = Math.min(255, g * 255)
                d[o + 2] = Math.min(255, b * 255)
                d[o + 3] = albedo[o + 3]
            }
        }

        ctx.putImageData(out, 0, 0)
        return this.canvas
    }

    dispose() {
        const gl = this.gl
        if (!gl) return
        if (this.program) gl.deleteProgram(this.program)
        if (this.albedoTex) gl.deleteTexture(this.albedoTex)
        if (this.normalTex) gl.deleteTexture(this.normalTex)
        gl.getExtension('WEBGL_lose_context')?.loseContext()
        this.gl = null
        this.program = null
    }
}
