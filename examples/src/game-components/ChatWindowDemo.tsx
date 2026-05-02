import { GcPage, GcSection, GcRow } from './_demo'
import '@toolcase/game-components'

export const ChatWindowDemo = () => (
    <GcPage category="HUD — Communications" title="gc-chat-window" lede="An in-game chat panel with channel tabs, message history, and system messages.">
        <GcSection title="Multi-channel">
            <GcRow label="Default">
                <gc-chat-window messages={JSON.stringify([
                    { id: '1', sender: 'Knight92', body: 'GG everyone!' },
                    { id: '2', sender: 'WizardX', body: 'wp', color: '#c93ad2' },
                    { id: '3', sender: 'You', body: 'gg wp no re' },
                    { id: '4', sender: '', body: 'You disconnected from server.', system: true },
                    { id: '5', sender: 'Ranger', body: 'need healer for dungeon run', color: '#3aa256' },
                ])} channels={JSON.stringify([
                    { id: 'all', label: 'All', color: '#fff' },
                    { id: 'team', label: 'Team', color: '#3aa256' },
                    { id: 'guild', label: 'Guild', color: '#ffd35a' },
                    { id: 'whisper', label: 'PM', color: '#c93ad2' },
                ])} active-channel="all" />
            </GcRow>
        </GcSection>
    </GcPage>
)

export default ChatWindowDemo
