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
        return {
            status: 'OK',
            count: this.count === undefined ? undefined : this.count,
            data: this.data,
        }
    }

}

export default RESTResponse
