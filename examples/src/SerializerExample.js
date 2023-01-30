import { Serializer } from '@toolcase/base'

class SerializerExample {

    run() {
        let serializer = new Serializer()
        serializer.define('state', [
            { key: 'array1', type: Serializer.FieldType.UINT32, rule: 'repeated' },
            { key: 'array2', type: Serializer.FieldType.STRING, rule: 'repeated' },
            { key: 'string1', type: Serializer.FieldType.STRING, rule: 'optional', default: 'sa' }
        ])


        let payload = serializer.encode('state', { array2: [1] })
        let output = serializer.decode('state', payload)

        console.log(output)
        console.log(output.toJSON())
        console.log(output.$type.toObject(output, {
            defaults: true
        }))
    }

}

export default SerializerExample