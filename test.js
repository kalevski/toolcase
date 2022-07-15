const JSONSchema = require('./base/src/JSONSchema')

let jsonSchema = new JSONSchema({
    type: 'object',
    flexible: true,
    properties: {
        hehe: {
            type: 'string',
            required: true
        }
    }
})

jsonSchema.validate({
    
})

