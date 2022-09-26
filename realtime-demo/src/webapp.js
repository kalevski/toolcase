import { Serializer } from '@toolcase/base'
import { WSClient } from '@toolcase/realtime.js'

const decoder = new window.TextDecoder('utf-8')
const serializer = new Serializer()

serializer.define('test', [
    { key: 'types', type: 'int32', rule: 'repeated' }
])

serializer.define('my_topic', [
    { key: 'names', type: 'bool', rule: 'repeated' },
    { key: 'test', type: 'test', rule: 'required' }
])


const client = new WSClient('ws://localhost:3000')
client.connect('test')

client.on('client:connect', () => {
    client.send('my_topic', 'test')
})

client.on('client:disconnect', payload => {
    console.log('reason:', decoder.decode(payload))
})

client.on('my_topic', (payload) => {
    let data = serializer.decode('my_topic', payload)
    console.log(JSON.stringify(data))
    console.log(JSON.stringify(data).length)
})