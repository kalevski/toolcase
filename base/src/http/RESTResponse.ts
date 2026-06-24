class RESTResponse<T = any> {

    readonly status: number

    readonly data: T

    readonly count: number | undefined

    constructor(status: number, data: T, count: number | null = null) {
        this.status = status
        this.data = data
        if (typeof count === 'number') {
            this.count = count
        }
    }

    toJSON() {
        const result: { status: string, code: number, count?: number, data: T } = {
            status: this.status >= 400 ? 'rejected' : 'OK',
            code: this.status,
            data: this.data,
        }
        if (this.count !== undefined) {
            result.count = this.count
        }
        return result
    }

}

export default RESTResponse
