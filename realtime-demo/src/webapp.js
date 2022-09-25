import { WSClient } from '@toolcase/realtime.js'

const decoder = new window.TextDecoder('utf-8')

const client = new WSClient('ws://localhost:3000')
client.connect('test')

client.on('client:connect', () => {
    client.send('my_topic', 'test')
})

client.on('client:disconnect', payload => {
    console.log('reason:', decoder.decode(payload))
})

client.on('my_topic', (payload) => {
    console.log(decoder.decode(payload))
})