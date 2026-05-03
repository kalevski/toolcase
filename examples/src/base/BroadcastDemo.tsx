import { useState } from 'react'
import { Broadcast } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `class GameServer extends Broadcast {
  start() {
    this.emit('status', 'starting')
    this.emit('status', 'running')
  }
  stop() { this.emit('status', 'stopped') }
}

const server = new GameServer()
server.on('status', (s) => console.log('Server status:', s))
server.start()
server.stop()`

export const BroadcastDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        class GameServer extends Broadcast {
            start() {
                this.emit('status', 'starting')
                this.emit('status', 'running')
            }
            stop() {
                this.emit('status', 'stopped')
            }
        }

        const server = new GameServer()
        server.on('status', (s: string) => console.log('Server status:', s))
        server.start()
        server.stop()
        console.log('Listener count:', server.listenerCount('status'))
        server.removeAllListeners()
        console.log('After removeAll:', server.listenerCount('status'))
    }))
    return (
        <DemoSection
            title="Broadcast"
            description="Base class that adds pub/sub events to any class via composition."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default BroadcastDemo
