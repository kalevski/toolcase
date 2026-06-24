import { Math as M } from 'phaser'

/**
 * 2x2 linear transform stored on top of a Float32Array(4).
 * Caches `adjoint`, `determinant` and `inverse` after every `setValues`.
 */
export default class Matrix2 extends Float32Array {

    static readonly PRECISION = 10000

    adjoint: Float32Array = new Float32Array(4)

    inverse!: Matrix2

    determinant: number = 0

    constructor(v00 = 1, v01 = 0, v10 = 0, v11 = 1, inverse: Matrix2 | null = null) {
        super(4)
        this.setValues(v00, v01, v10, v11, inverse)
    }

    get v00(): number { return this[0] as number }
    get v01(): number { return this[1] as number }
    get v10(): number { return this[2] as number }
    get v11(): number { return this[3] as number }

    /**
     * Apply the 2×2 linear transform to point (x, y) and write the result into `out`.
     * This is a pure matrix–vector multiply (M·[x,y]ᵀ) — there is no translation
     * component; a 2×2 matrix cannot encode one (that requires an affine / 3×3 form).
     */
    transformPoint(x: number, y: number, out: M.Vector2 = new M.Vector2()): M.Vector2 {
        const p = Matrix2.PRECISION
        out.x = Math.round((x * this.v00 + y * this.v01) * p) / p
        out.y = Math.round((x * this.v10 + y * this.v11) * p) / p
        return out
    }

    /** @deprecated Use `transformPoint` instead — this method does not translate. */
    translate(x: number, y: number, out?: M.Vector2): M.Vector2 {
        return this.transformPoint(x, y, out)
    }

    setValues(v00: number, v01: number, v10: number, v11: number, inverse: Matrix2 | null = null): void {
        this.set([v00, v01, v10, v11], 0)
        this.adjoint.set([v11, -v01, -v10, v00], 0)
        this.determinant = v00 * v11 - v01 * v10

        if (inverse !== null) {
            this.inverse = inverse
            return
        }

        if (this.determinant === 0 || !isFinite(this.determinant)) {
            this.inverse = new Matrix2(NaN, NaN, NaN, NaN, this)
            return
        }

        const invDet = 1 / this.determinant
        this.inverse = new Matrix2(v11 * invDet, -v01 * invDet, -v10 * invDet, v00 * invDet, this)
    }

    static createISO(size: number = 64): Matrix2 {
        return new Matrix2(size, -size, size / 2, size / 2)
    }

    static create(x: number = 1, y: number = 1, angleX: number = 0, angleY: number = 0): Matrix2 {
        const a = new M.Vector2(x, 0)
        const b = new M.Vector2(0, y)
        a.rotate(M.DegToRad(angleX))
        b.rotate(M.DegToRad(angleY))
        return new Matrix2(a.x, a.y, b.x, b.y)
    }

}
