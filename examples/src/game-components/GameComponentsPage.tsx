import { useEffect, useRef, useState } from 'react'
import '@toolcase/game-components'
import './jsx.d'

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <section style={{ marginBottom: 32, padding: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
        <h2 style={{ marginTop: 0, color: '#e6e8ec', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 8 }}>{title}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>{children}</div>
    </section>
)

const Demo = ({ label, children, style }: { label: string, children: React.ReactNode, style?: React.CSSProperties }) => (
    <div style={{ ...style }}>
        <div style={{ fontSize: 11, opacity: 0.6, color: '#e6e8ec', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
        {children}
    </div>
)

export const GameComponentsPage = () => {
    const [hp, setHp] = useState(72)
    const [ghost, setGhost] = useState(95)
    const [heading, setHeading] = useState(0)
    const [combo, setCombo] = useState(0)
    const [score, setScore] = useState(12345)
    const [pageIndex, setPageIndex] = useState(0)
    const [paused, setPaused] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [wheelOpen, setWheelOpen] = useState(false)
    const [particleBurst, setParticleBurst] = useState(0)
    const [shakeBurst, setShakeBurst] = useState(0)
    const [flashTrigger, setFlashTrigger] = useState(0)
    const [letterboxOn, setLetterboxOn] = useState(false)
    const dialogueRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const interval = window.setInterval(() => {
            setHeading((value) => (value + 2) % 360)
            setHp((value) => Math.max(0, value - (Math.random() < 0.3 ? 2 : 0)))
        }, 200)
        return () => window.clearInterval(interval)
    }, [])

    useEffect(() => {
        const settle = window.setTimeout(() => setGhost(hp), 600)
        return () => window.clearTimeout(settle)
    }, [hp])

    useEffect(() => {
        const handle = (event: Event) => {
            const detail = (event as CustomEvent).detail
            console.log('main-menu select', detail)
        }
        const node = document.querySelector('gc-main-menu#demo-menu')
        node?.addEventListener('select', handle)
        return () => node?.removeEventListener('select', handle)
    }, [])

    return (
        <div style={{ padding: 24, color: '#e6e8ec', background: '#0a0c10', minHeight: '100vh' }}>
            <h1 style={{ marginTop: 0 }}>@toolcase/game-components</h1>
            <p style={{ opacity: 0.7, maxWidth: 720 }}>
                Native HTML5 Web Components for game UIs. Each tag uses Shadow DOM for isolated styling and
                emits standard <code>CustomEvent</code>s. Frameworks-agnostic — these examples render them inside React.
            </p>

            <Section title="Layout">
                <Demo label="gc-panel">
                    <gc-panel padding="16px"><span style={{ color: '#e6e8ec' }}>Panel with border</span></gc-panel>
                </Demo>
                <Demo label="gc-stack">
                    <gc-stack direction="horizontal" gap="8px">
                        <span style={{ padding: 8, background: 'rgba(255,255,255,0.06)', color: '#e6e8ec' }}>A</span>
                        <span style={{ padding: 8, background: 'rgba(255,255,255,0.06)', color: '#e6e8ec' }}>B</span>
                        <span style={{ padding: 8, background: 'rgba(255,255,255,0.06)', color: '#e6e8ec' }}>C</span>
                    </gc-stack>
                </Demo>
                <Demo label="gc-grid 4×2">
                    <gc-grid columns="4" gap="4px">
                        {Array.from({ length: 8 }).map((_, i) => <span key={i} style={{ padding: 8, background: 'rgba(106,169,255,0.1)', color: '#e6e8ec', textAlign: 'center' }}>{i + 1}</span>)}
                    </gc-grid>
                </Demo>
                <Demo label="gc-aspect-ratio-box 16:9">
                    <div style={{ width: 200 }}>
                        <gc-aspect-ratio-box ratio="16/9">
                            <div style={{ width: '100%', height: '100%', background: 'rgba(106,169,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e6e8ec' }}>16:9</div>
                        </gc-aspect-ratio-box>
                    </div>
                </Demo>
                <Demo label="gc-list">
                    <gc-list items={JSON.stringify([
                        { id: 'new', label: 'New Game', icon: '🎮' },
                        { id: 'continue', label: 'Continue', icon: '💾' },
                        { id: 'options', label: 'Options', icon: '⚙' },
                        { id: 'quit', label: 'Quit', icon: '↩', disabled: true },
                    ])} selected-id="new" />
                </Demo>
            </Section>

            <Section title="Inputs">
                <Demo label="gc-combo-box">
                    <gc-combo-box options={JSON.stringify([
                        { value: 'fr', label: 'French' }, { value: 'en', label: 'English' }, { value: 'es', label: 'Spanish' }, { value: 'jp', label: 'Japanese' },
                    ])} placeholder="Pick language" />
                </Demo>
                <Demo label="gc-key-binder">
                    <gc-key-binder value="Ctrl + W" />
                </Demo>
                <Demo label="gc-gamepad-button-prompt">
                    <gc-stack direction="horizontal" gap="8px">
                        <gc-gamepad-button-prompt glyph="A" label="Jump" />
                        <gc-gamepad-button-prompt glyph="B" label="Roll" />
                        <gc-gamepad-button-prompt glyph="cross" label="Confirm" />
                        <gc-gamepad-button-prompt glyph="circle" label="Cancel" />
                        <gc-gamepad-button-prompt glyph="dpad-up" />
                    </gc-stack>
                </Demo>
            </Section>

            <Section title="HUD — Resource Bars">
                <Demo label="gc-health-bar with ghost damage">
                    <div style={{ width: 220 }}>
                        <gc-health-bar value={hp} max={100} ghost={ghost} show-text label="HP" />
                    </div>
                </Demo>
                <Demo label="gc-mana-bar segmented">
                    <div style={{ width: 220 }}>
                        <gc-mana-bar value={70} max={100} segments={5} show-text label="MP" />
                    </div>
                </Demo>
                <Demo label="gc-stamina-bar">
                    <div style={{ width: 220 }}>
                        <gc-stamina-bar value={45} max={100} />
                    </div>
                </Demo>
                <Demo label="gc-circular-progress">
                    <gc-stack direction="horizontal" gap="12px">
                        <gc-circular-progress value="0.7" max="1" size="48" thickness="4" show-text />
                        <gc-circular-progress value="0.3" max="1" size="48" thickness="4" color="var(--gc-warning)" show-text />
                    </gc-stack>
                </Demo>
            </Section>

            <Section title="HUD — Reticles & Combat">
                <Demo label="gc-crosshair (4 variants)">
                    <gc-stack direction="horizontal" gap="32px">
                        <div style={{ position: 'relative', width: 60, height: 60, background: 'rgba(255,255,255,0.04)' }}><gc-crosshair variant="classic" /></div>
                        <div style={{ position: 'relative', width: 60, height: 60, background: 'rgba(255,255,255,0.04)' }}><gc-crosshair variant="dot" /></div>
                        <div style={{ position: 'relative', width: 60, height: 60, background: 'rgba(255,255,255,0.04)' }}><gc-crosshair variant="circle" size="12" /></div>
                        <div style={{ position: 'relative', width: 60, height: 60, background: 'rgba(255,255,255,0.04)' }}><gc-crosshair variant="cross" spread="6" /></div>
                    </gc-stack>
                </Demo>
                <Demo label="gc-ammo-counter">
                    <gc-ammo-counter mag={18} mag-max={30} reserve={120} weapon-name="AR-15" />
                </Demo>
                <Demo label="gc-hit-marker (toggle)">
                    <button onClick={() => { const el = document.querySelector('gc-hit-marker.demo') as HTMLElement; el?.setAttribute('show', ''); el?.setAttribute('crit', '') }} style={{ padding: '4px 10px' }}>Trigger crit</button>
                    <div style={{ position: 'relative', width: 80, height: 80, marginTop: 8, background: 'rgba(255,255,255,0.04)' }}>
                        <gc-hit-marker class="demo" crit duration="500" />
                    </div>
                </Demo>
            </Section>

            <Section title="HUD — Navigation & Markers">
                <Demo label="gc-compass-bar (live)">
                    <gc-compass-bar heading={heading} fov="120" markers={JSON.stringify([
                        { id: 'q1', heading: 45, color: '#ffd35a', icon: '◆', label: 'Quest' },
                        { id: 'p1', heading: 200, color: '#3aa256', icon: '▼', label: 'Friend' },
                    ])} />
                </Demo>
                <Demo label="gc-compass-rose (live)">
                    <gc-compass-rose heading={heading} size="80" />
                </Demo>
                <Demo label="gc-minimap">
                    <gc-minimap world-width="1000" world-height="1000" markers={JSON.stringify([
                        { id: 'p', x: 500, y: 500, color: '#fff', size: 8 },
                        { id: 'e1', x: 320, y: 420, color: '#d23a3a', size: 5 },
                        { id: 'e2', x: 600, y: 700, color: '#d23a3a', size: 5 },
                        { id: 'q', x: 750, y: 250, color: '#ffd35a', size: 7 },
                    ])} />
                </Demo>
                <Demo label="gc-waypoint-marker">
                    <div style={{ position: 'relative', width: 200, height: 100, background: 'rgba(255,255,255,0.04)' }}>
                        <gc-waypoint-marker x="100" y="50" label="Cave" distance="120m" />
                    </div>
                </Demo>
                <Demo label="gc-objective-marker">
                    <div style={{ position: 'relative', width: 160, height: 80, background: 'rgba(255,255,255,0.04)' }}>
                        <gc-objective-marker x="80" y="60" label="Boss" distance="50m" />
                    </div>
                </Demo>
            </Section>

            <Section title="HUD — Skills & Buffs">
                <Demo label="gc-skill-bar">
                    <gc-skill-bar slots={JSON.stringify([
                        { id: 'q', icon: '⚔', hotkey: 'Q', cooldown: 1 },
                        { id: 'w', icon: '🛡', hotkey: 'W', cooldown: 0.4, remaining: 6 },
                        { id: 'e', icon: '🔥', hotkey: 'E', cooldown: 1, charges: 2 },
                        { id: 'r', icon: '⚡', hotkey: 'R', cooldown: 0.1, remaining: 18 },
                    ])} />
                </Demo>
                <Demo label="gc-buff-bar">
                    <gc-buff-bar buffs={JSON.stringify([
                        { id: 'haste', icon: '⚡', name: 'Haste', remaining: 15, duration: 30 },
                        { id: 'shield', icon: '🛡', name: 'Shield', remaining: 4, duration: 10, stacks: 3 },
                        { id: 'poison', icon: '☠', name: 'Poison', remaining: 8, duration: 12, debuff: true },
                    ])} />
                </Demo>
                <Demo label="gc-quest-tracker">
                    <gc-quest-tracker tracker-title="Active Quests" quests={JSON.stringify([
                        { id: 'q1', name: 'The Ancient Tomb', objectives: [
                            { id: 'a', text: 'Find the entrance', completed: true },
                            { id: 'b', text: 'Defeat guardians', progress: 2, target: 5 },
                            { id: 'c', text: 'Loot the chamber', optional: true },
                        ] },
                    ])} />
                </Demo>
                <Demo label="gc-interact-prompt">
                    <gc-interact-prompt show key-label="E" text="Open chest" hold-progress="0.6" />
                </Demo>
            </Section>

            <Section title="HUD — Display">
                <Demo label="gc-score-display">
                    <gc-score-display score={score} multiplier="3" label="Score" />
                </Demo>
                <Demo label="gc-combo-counter (click to add)">
                    <button onClick={() => setCombo((value) => value + 1)} style={{ padding: '4px 10px', marginBottom: 8 }}>Add combo</button>
                    <gc-combo-counter combo={combo} timer="0.6" />
                </Demo>
                <Demo label="gc-speedometer">
                    <gc-speedometer value="120" max="220" rpm="0.7" gear="4" />
                </Demo>
                <Demo label="gc-subtitle">
                    <gc-subtitle text="It is dangerous to go alone." speaker="Old Man" />
                </Demo>
                <Demo label="gc-dialogue-box">
                    <gc-dialogue-box ref={dialogueRef as never} speaker="Innkeeper" text="Welcome traveler! What brings you to Riverwood?" choices={JSON.stringify([
                        { id: 'rumors', label: 'Heard any rumors?' },
                        { id: 'room', label: 'I need a room.' },
                        { id: 'leave', label: 'Goodbye.' },
                    ])} />
                </Demo>
            </Section>

            <Section title="HUD — Communications">
                <Demo label="gc-kill-feed">
                    <gc-kill-feed entries={JSON.stringify([
                        { id: '1', killerName: 'Player1', victimName: 'Bot42', weapon: '🔫', headshot: true },
                        { id: '2', killerName: 'You', victimName: 'Bot17', weapon: '🗡' },
                        { id: '3', killerName: 'Bot07', victimName: 'Player3', weapon: '💣' },
                    ])} />
                </Demo>
                <Demo label="gc-chat-window">
                    <gc-chat-window messages={JSON.stringify([
                        { id: '1', sender: 'Knight92', body: 'GG everyone!' },
                        { id: '2', sender: 'WizardX', body: 'wp', color: '#c93ad2' },
                        { id: '3', sender: '', body: 'You disconnected from server.', system: true },
                    ])} channels={JSON.stringify([
                        { id: 'all', label: 'All', color: '#fff' },
                        { id: 'team', label: 'Team', color: '#3aa256' },
                        { id: 'guild', label: 'Guild', color: '#ffd35a' },
                    ])} active-channel="all" />
                </Demo>
            </Section>

            <Section title="Navigation">
                <Demo label="gc-main-menu" style={{ width: 360, height: 320, background: 'rgba(255,255,255,0.02)' }}>
                    <gc-main-menu id="demo-menu" menu-title="MAIN" subtitle="A working menu" items={JSON.stringify([
                        { id: 'play', label: 'Play' },
                        { id: 'load', label: 'Load Game' },
                        { id: 'options', label: 'Options' },
                        { id: 'quit', label: 'Quit' },
                    ])} />
                </Demo>
                <Demo label="gc-page-indicator">
                    <gc-stack direction="vertical" gap="8px">
                        <gc-page-indicator count="5" index={pageIndex} />
                        <button onClick={() => setPageIndex((value) => (value + 1) % 5)} style={{ padding: '4px 10px' }}>Next page</button>
                    </gc-stack>
                </Demo>
                <Demo label="gc-nav-button">
                    <gc-stack direction="horizontal" gap="8px">
                        <gc-nav-button kind="back" />
                        <gc-nav-button kind="close" />
                    </gc-stack>
                </Demo>
            </Section>

            <Section title="Dialogs / Overlays">
                <Demo label="gc-confirm-dialog">
                    <button onClick={() => setConfirmOpen(true)} style={{ padding: '6px 12px' }}>Open confirm</button>
                    {confirmOpen && (
                        <gc-confirm-dialog
                            open
                            dialog-title="Delete save?"
                            message="This action cannot be undone."
                            confirm-label="Delete"
                            danger
                            ref={(node: HTMLElement | null) => {
                                if (!node) return
                                node.addEventListener('confirm', () => setConfirmOpen(false))
                                node.addEventListener('cancel', () => setConfirmOpen(false))
                            }}
                        />
                    )}
                </Demo>
                <Demo label="gc-pause-screen">
                    <button onClick={() => setPaused(true)} style={{ padding: '6px 12px' }}>Pause</button>
                    {paused && (
                        <gc-pause-screen open ref={(node: HTMLElement | null) => {
                            if (!node) return
                            node.addEventListener('resume', () => setPaused(false))
                            node.addEventListener('quit', () => setPaused(false))
                            node.addEventListener('select', (event: Event) => {
                                const id = (event as CustomEvent).detail.id
                                if (id === 'restart' || id === 'quit' || id === 'resume') setPaused(false)
                            })
                        }} />
                    )}
                </Demo>
                <Demo label="gc-radial-wheel">
                    <button onClick={() => setWheelOpen(true)} style={{ padding: '6px 12px' }}>Open emote wheel</button>
                    {wheelOpen && (
                        <gc-radial-wheel open options={JSON.stringify([
                            { id: 'wave', icon: '👋', label: 'Wave' },
                            { id: 'laugh', icon: '😂', label: 'Laugh' },
                            { id: 'dance', icon: '💃', label: 'Dance' },
                            { id: 'cry', icon: '😢', label: 'Cry' },
                            { id: 'point', icon: '👉', label: 'Point' },
                            { id: 'salute', icon: '🫡', label: 'Salute' },
                        ])} center-label="Emotes"
                            ref={(node: HTMLElement | null) => {
                                if (!node) return
                                node.addEventListener('close', () => setWheelOpen(false))
                                node.addEventListener('select', (event: Event) => console.log('wheel', (event as CustomEvent).detail))
                            }} />
                    )}
                </Demo>
            </Section>

            <Section title="Inventory">
                <Demo label="gc-item-slot variants">
                    <gc-stack direction="horizontal" gap="6px">
                        <gc-item-slot item={JSON.stringify({ id: '1', icon: '⚔', rarity: 'common' })} />
                        <gc-item-slot item={JSON.stringify({ id: '2', icon: '🏹', rarity: 'rare', qty: 12 })} />
                        <gc-item-slot item={JSON.stringify({ id: '3', icon: '🛡', rarity: 'epic', equipped: true })} />
                        <gc-item-slot item={JSON.stringify({ id: '4', icon: '💎', rarity: 'legendary' })} selected />
                        <gc-item-slot item={JSON.stringify({ id: '5', icon: '🔒', locked: true })} />
                    </gc-stack>
                </Demo>
                <Demo label="gc-inventory-grid">
                    <gc-inventory-grid columns="6" slot-size="44" items={JSON.stringify([
                        { id: '1', icon: '⚔', rarity: 'common' },
                        { id: '2', icon: '🏹', rarity: 'uncommon', qty: 7 },
                        { id: '3', icon: '🛡', rarity: 'rare' },
                        { id: '4', icon: '💎', rarity: 'epic' },
                        { id: '5', icon: '⚡', rarity: 'legendary' },
                        { id: '6', icon: '🔥', rarity: 'mythic' },
                        null, null, null, null, null, null,
                    ])} />
                </Demo>
                <Demo label="gc-item-tooltip">
                    <gc-item-tooltip item={JSON.stringify({
                        id: 'sword', name: 'Sword of Dawn', rarity: 'epic', description: 'Forged in the first light.',
                        stats: [{ label: 'Damage', value: '47-54', delta: 8 }, { label: 'Crit', value: '12%' }],
                        lore: '— "When the sun rises, evil retreats." —',
                    })} />
                </Demo>
                <Demo label="gc-loot-list">
                    <gc-loot-list items={JSON.stringify([
                        { item: { id: 'g', name: 'Gold', icon: '🪙', rarity: 'common' }, qty: 245 },
                        { item: { id: 'p', name: 'Health Potion', icon: '🧪', rarity: 'uncommon' }, qty: 3 },
                        { item: { id: 'r', name: 'Ruby', icon: '💎', rarity: 'rare' } },
                    ])} />
                </Demo>
                <Demo label="gc-currency-display">
                    <gc-stack direction="vertical" gap="4px">
                        <gc-currency-display amount="2450" currency-icon="🪙" label="Gold" />
                        <gc-currency-display amount="42" currency-icon="💎" label="Gems" color="#6aa9ff" />
                    </gc-stack>
                </Demo>
            </Section>

            <Section title="Progression">
                <Demo label="gc-ability-card">
                    <gc-ability-card ability-name="Fireball" icon="🔥" rarity="epic" description="Hurl a ball of flame that explodes on impact, dealing area damage." cost="40 MP" cooldown="2.5s" range="30m" keybind="Q" />
                </Demo>
                <Demo label="gc-perk-picker">
                    <div style={{ width: 540 }}>
                        <gc-perk-picker columns="3" perks={JSON.stringify([
                            { id: 'a', name: 'Quick Hands', icon: '✋', description: 'Reload 30% faster.', selected: true },
                            { id: 'b', name: 'Eagle Eye', icon: '🦅', description: 'Headshots deal 2× damage.' },
                            { id: 'c', name: 'Iron Skin', icon: '🛡', description: '+15% damage resistance.', locked: true },
                        ])} />
                    </div>
                </Demo>
                <Demo label="gc-achievement-list">
                    <div style={{ width: 420 }}>
                        <gc-achievement-list achievements={JSON.stringify([
                            { id: '1', name: 'First Blood', description: 'Win your first match.', unlocked: true, points: 10 },
                            { id: '2', name: 'Dedicated', description: 'Play 100 matches.', progress: 72, target: 100, points: 25 },
                            { id: '3', name: '???', secret: true, points: 50 },
                        ])} />
                    </div>
                </Demo>
                <Demo label="gc-battle-pass">
                    <div style={{ width: 600 }}>
                        <gc-battle-pass current-level="3" current-xp="450" has-premium tiers={JSON.stringify([
                            { level: 1, xpRequired: 1000, free: { icon: '🎁', label: 'Skin', claimed: true }, premium: { icon: '💎', label: 'Gems', claimed: true } },
                            { level: 2, xpRequired: 1000, free: { icon: '🎨', label: 'Spray', claimed: true }, premium: { icon: '🔫', label: 'Weapon' } },
                            { level: 3, xpRequired: 1000, free: { icon: '🪙', label: '500g' }, premium: { icon: '👑', label: 'Title' } },
                            { level: 4, xpRequired: 1000, free: { icon: '🎵', label: 'Song' }, premium: { icon: '🎭', label: 'Mask' } },
                            { level: 5, xpRequired: 1000, free: { icon: '🌟', label: 'Badge' }, premium: { icon: '⚔', label: 'Skin' } },
                        ])} />
                    </div>
                </Demo>
            </Section>

            <Section title="Social">
                <Demo label="gc-friends-list">
                    <gc-friends-list friends={JSON.stringify([
                        { id: '1', name: 'Knight92', status: 'in-game', activity: 'Playing CS' },
                        { id: '2', name: 'WizardX', status: 'online' },
                        { id: '3', name: 'NinjaQ', status: 'away' },
                        { id: '4', name: 'OldTimer', status: 'offline' },
                    ])} />
                </Demo>
                <Demo label="gc-party-panel">
                    <gc-party-panel capacity="4" members={JSON.stringify([
                        { id: '1', name: 'You', host: true, ready: true, role: 'DPS' },
                        { id: '2', name: 'WizardX', ready: true, role: 'Heal' },
                        { id: '3', name: 'NinjaQ', ready: false, role: 'Tank' },
                    ])} />
                </Demo>
                <Demo label="gc-player-card">
                    <gc-player-card player-name="Knight92" card-title="The Unbroken" rank="Diamond II" level="48" online-status="in-game" stats={JSON.stringify([
                        { label: 'Wins', value: '247' },
                        { label: 'K/D', value: '2.34' },
                        { label: 'Playtime', value: '142h' },
                    ])} actions={JSON.stringify([
                        { id: 'invite', label: 'Invite' },
                        { id: 'block', label: 'Block', danger: true },
                    ])} />
                </Demo>
            </Section>

            <Section title="Effects">
                <Demo label="gc-shake-container">
                    <button onClick={() => setShakeBurst((value) => value + 1)} style={{ padding: '4px 10px', marginBottom: 8 }}>Shake</button>
                    <gc-shake-container trigger={String(shakeBurst)} intensity="8">
                        <div style={{ padding: 16, background: 'rgba(106,169,255,0.15)', borderRadius: 4, color: '#e6e8ec' }}>I get rattled.</div>
                    </gc-shake-container>
                </Demo>
                <Demo label="gc-particle-emitter">
                    <button onClick={() => setParticleBurst((value) => value + 1)} style={{ padding: '4px 10px', marginBottom: 8 }}>Burst</button>
                    <div style={{ width: 200, height: 160, background: 'rgba(255,255,255,0.04)' }}>
                        <gc-particle-emitter burst={String(particleBurst)} count="40" colors={JSON.stringify(['#ffd35a', '#ff8a3a', '#fff'])} width="200" height="160" />
                    </div>
                </Demo>
                <Demo label="gc-screen-flash (whole screen!)">
                    <button onClick={() => setFlashTrigger((value) => value + 1)} style={{ padding: '4px 10px' }}>Flash damage</button>
                    <gc-screen-flash trigger={String(flashTrigger)} flash-color="#ff5a5a" flash-opacity="0.35" />
                </Demo>
                <Demo label="gc-letterbox-bars">
                    <button onClick={() => setLetterboxOn((value) => !value)} style={{ padding: '4px 10px' }}>Toggle cinematic</button>
                    {letterboxOn ? <gc-letterbox-bars show /> : <gc-letterbox-bars />}
                </Demo>
            </Section>

            <Section title="Utility">
                <Demo label="gc-network-status-icon">
                    <gc-stack direction="horizontal" gap="16px">
                        <gc-network-status-icon ping="32" show-label />
                        <gc-network-status-icon ping="180" show-label />
                        <gc-network-status-icon ping="320" loss="0.08" show-label />
                    </gc-stack>
                </Demo>
                <Demo label="gc-platform-icon">
                    <gc-stack direction="horizontal" gap="16px">
                        <gc-platform-icon platform="pc" label />
                        <gc-platform-icon platform="ps" label />
                        <gc-platform-icon platform="xbox" label />
                        <gc-platform-icon platform="switch" label />
                    </gc-stack>
                </Demo>
                <Demo label="gc-version-label">
                    <gc-version-label version="1.4.2" build="42-canary" branch="main" />
                </Demo>
                <Demo label="gc-debug-overlay">
                    <gc-debug-overlay fps="58" draw-calls="1247" triangles="142800" mem-mb="245.7" />
                </Demo>
            </Section>

            <Section title="Settings (sample)">
                <div style={{ width: 600 }}>
                    <gc-volume-slider value="0.7" />
                    <gc-graphics-preset-picker value="high" />
                    <gc-fov-slider value="90" />
                    <gc-fullscreen-toggle checked />
                    <gc-vsync-toggle />
                    <gc-fps-cap-select value="144" />
                    <gc-reset-to-defaults />
                </div>
            </Section>
        </div>
    )
}
