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
        const result: { status: string, count?: number, data: T } = {
            status: 'OK',
            data: this.data,
        }
        if (this.count !== undefined) {
            result.count = this.count
        }
        return result
    }

}

export default RESTResponse
