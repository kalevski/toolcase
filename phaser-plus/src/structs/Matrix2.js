import { Math as M } from 'phaser'

class Matrix2 extends Float32Array {

    /** @type {Float32Array} */
    adjoint = new Float32Array(4)

    /** @type {Matrix2} */
    inverse = null

    /** @type {number} */
    determinant = 0

    /**
     * 
     * @param {number} v00 
     * @param {number} v01 
     * @param {number} v10 
     * @param {number} v11 
     * @param {Matrix2} [inverse=null] 
     */
    constructor(v00 = 1, v01 = 1, v10 = 1, v11 = 1, inverse = null) {
        super(4)
        this.set(v00, v01, v10, v11, inverse)
    }

    get v00() {
        return this[0]
    }

    get v01() {
        return this[1]
    }

    get v10() {
        return this[2]
    }

    get v11() {
        return this[3]
    }

    /**
     * 
     * @param {number} x 
     * @param {number} y 
     * @param {M.Vector2} out 
     * @returns {M.Vector2}
     */
    translate(x, y, out = new M.Vector2()) {
        out.x = Math.round((x * this[0] + y * this[1]) * 10000) / 10000
        out.y = Math.round((x * this[2] + y * this[3])  * 10000) / 10000
        return out
    }

    set(v00, v01, v10, v11, inverse) {
        this[0] = v00
        this[1] = v01
        this[2] = v10
        this[3] = v11

        this.adjoint[0] = v11
        this.adjoint[1] = -v01
        this.adjoint[2] = -v10
        this.adjoint[3] = v00

        this.determinant = 1 / (this[0] * this[3] - this[1] * this[2])

        if (inverse !== null) {
            this.inverse = inverse
            return
        }

        let i00 = this.adjoint[0] * this.determinant
        let i01 = this.adjoint[1] * this.determinant
        let i10 = this.adjoint[2] * this.determinant
        let i11 = this.adjoint[3] * this.determinant
        
        this.inverse = new Matrix2(i00, i01, i10, i11, this)
    }

}

Matrix2.getISO = (width, height) => {
    return new Matrix2(width, -width, height / 2, height / 2)
}

export default Matrix2