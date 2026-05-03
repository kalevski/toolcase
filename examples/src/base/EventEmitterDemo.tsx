import { useState } from 'react'
import { EventEmitter } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const emitter = new EventEmitter()

emitter.on('message', (text) => console.log('Received:', text))
emitter.once('connect', () => console.log('Connected! (once)'))

emitter.emit('message', 'Hello World')
emitter.emit('connect')
emitter.emit('connect') // won't fire — once removes itself

emitter.off('message')
console.log('Listener count:', emitter.listenerCount('message'))`

export const EventEmitterDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const emitter = new EventEmitter()

        emitter.on('message', (text: string) => console.log('Received:', text))
        emitter.once('connect', () => console.log('Connected! (once)'))

        console.log('Listener count for "message":', emitter.listenerCount('message'))
        emitter.emit('message', 'Hello World')
        emitter.emit('connect')
        emitter.emit('connect')
        console.log('Event names:', JSON.stringify(emitter.eventNames()))

        emitter.off('message')
        console.log('After off(), listener count:', emitter.listenerCount('message'))
    }))
    return (
        <DemoSection
            title="EventEmitter"
            description="Typed event emitter with on, once, off, and emit."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default EventEmitterDemo
