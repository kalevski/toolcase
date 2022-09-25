import { Serializer } from '@toolcase/base'

let serializer = new Serializer()

serializer.define('message', [
    { key: 'topic', type: 'string', rule: 'required' },
    { key: 'payload', type: 'bytes', rule: 'required' },
    { key: 'sender', type: 'string', rule: 'optional' }
])

serializer.define('my_data', [
    { key: 'message', type: 'string', 'rule': 'repeated' }
])

let message = serializer.encode('my_data', {
    message: ['test1', 'test2']
})

let overNetwork = serializer.encode('message', {
    topic: 'my_topic',
    payload: message,
    sender: 'me'
})


let decodedTop = serializer.decode('message', overNetwork)
console.log(decodedTop)

let actualData = serializer.decode('my_data', decodedTop.payload)
console.log(actualData)