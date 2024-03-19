import { retry } from "@toolcase/base"

const callSimpleFn = () => {
    const canSucceed = Math.random() * 10000 > 7000
    if (!canSucceed) {
        throw new Error('hehe')
    }
    return 1
}

const callAPI = async () => new Promise<number>((resolve, reject) => {
    setTimeout(() => {
        const canSucceed = Math.random() * 10000 > 7000
        if (canSucceed) {
            resolve(1)
        } else {
            reject(new Error('hehe'))
        }
    }, Math.floor(Math.random() * 1000) + 100)
})

class RetryExample {

    async run() {
        const result = await retry(callAPI, {
            minTimeout: 500,
            retries: 5,
            factor: 1.5,
            randomize: true
        })
        console.log({ result })
    }

}

export default RetryExample


