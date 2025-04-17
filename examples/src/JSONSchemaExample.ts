import { JSONSchema } from '@toolcase/base'

class JSONSchemaExample {

    async run() {
        const validator = new JSONSchema({
            type: 'object',
            properties: {
                subscriptions: {
                    required: false,
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                        key: { type: 'string', required: true },
                        params: { type: 'object', required: false, flexible: true },
                        },
                    },
                },
                updates: {
                    required: false,
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                        key: { type: 'string', required: true },
                        payload: { type: 'object', required: false, flexible: true },
                        },
                    },
                },
            },
        })

        try {
            console.log(validator.validate({
                "subscriptions": [
                    { "key": "active_opportunity_editors", "params": { "test": 1 } }
                ],
                "updates": [
                    { key: '' }
                ]
            }))
        } catch (error) {
            console.error(error)
        }
    }

}

export default JSONSchemaExample