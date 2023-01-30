import { Serializer } from '@toolcase/base'

class SerializerExample {

    run() {
        let serializer = new Serializer()
        serializer.define('state', [
            { key: 'array1', type: Serializer.FieldType.UINT32, rule: 'repeated' },
            { key: 'array2', type: Serializer.FieldType.STRING, rule: 'repeated' }
        ])

        let payload = serializer.encode('state', { array1: [] })
        let output = serializer.decode('state', payload)

        console.log(output)
    }

}

export default SerializerExample