import { JSONSchema } from '@toolcase/base'

class JSONSchemaExample {

    async run() {
        const validator = new JSONSchema({
            type: 'object',
            required: true,
            properties: {
                test: { type: 'string', required: false }
            }
        })

        try {
            console.log(validator.validate({ test: 2 }))
        } catch (error) {
            console.error(error)
        }
    }

}

export default JSONSchemaExample