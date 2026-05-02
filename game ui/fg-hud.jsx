/* global React, Panel, Eyebrow, Title, Divider, ResourceBar, ItemSlot, Key, Portrait, BuffIcon, ArtboardBackdrop */
// HUD components — health, hotbar, minimap, buffs, kill feed, crosshair

const { useState: useStateHud, useEffect: useEffectHud } = React;

// ────────────────────────────────────────────────────────────────
// Player frame: portrait + hp/mp/stamina + class
// ────────────────────────────────────────────────────────────────
function PlayerFrame() {
  return (
    <Panel style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, width: 320 }}>
      <Portrait glyph="A" size={56} level={47} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: "var(--fg-display)", color: "var(--fg-gold-bright)", fontSize: 14, letterSpacing: "0.1em" }}>
            ARDYN&nbsp;THORNE
          </span>
          <span style={{ fontFamily: "var(--fg-mono)", fontSize: 10, color: "var(--fg-parch-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Warden
          </span>
        </div>
        <ResourceBar value={742} max={950} kind="hp" height={12} />
        <ResourceBar value={310} max={520} kind="mp" height={10} />
        <ResourceBar value={88}  max={100} kind="stamina" height={8} />
      </div>
    </Panel>
  );
}

// ────────────────────────────────────────────────────────────────
// Hotbar / Action bar
// ────────────────────────────────────────────────────────────────
function Hotbar() {
  const slots = [
    { glyph: "⚔", hotkey: "1", rarity: "rare", cooldown: 0 },
    { glyph: "🛡", hotkey: "2", rarity: "uncommon" },
    { glyph: "✦", hotkey: "3", rarity: "epic", cooldown: 65 },
    { glyph: "🔥", hotkey: "4", rarity: "legendary", cooldown: 30 },
    { glyph: "❄", hotkey: "5", rarity: "rare" },
    { glyph: "☩", hotkey: "6", rarity: "uncommon" },
    { glyph: "⚕", hotkey: "Q", rarity: "common", qty: 12 },
    { glyph: "🜍", hotkey: "E", rarity: "rare", qty: 3 },
    { glyph: "", hotkey: "R" },
    { glyph: "", hotkey: "F" },
  ];
  return (
    <Panel style={{ padding: 10, display: "inline-flex", gap: 6 }}>
      {slots.map((s, i) => <ItemSlot key={i} {...s} size={52} />)}
    </Panel>
  );
}

// ────────────────────────────────────────────────────────────────
// Buff / Debuff strip
// ────────────────────────────────────────────────────────────────
function BuffBar() {
  return (
    <Panel style={{ padding: 8, display: "inline-flex", flexDirection: "column", gap: 6, width: 220 }}>
      <Eyebrow>Aegis &amp; Affliction</Eyebrow>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <BuffIcon glyph="☆" time="2:14" kind="buff" />
        <BuffIcon glyph="✦" time="0:48" kind="buff" />
        <BuffIcon glyph="◈" time="∞" kind="buff" />
        <BuffIcon glyph="❖" time="0:12" kind="buff" />
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <BuffIcon glyph="☠" time="0:08" kind="debuff" />
        <BuffIcon glyph="🜍" time="0:24" kind="debuff" />
        <BuffIcon glyph="❄" time="0:03" kind="debuff" color="var(--fg-frost)" />
      </div>
    </Panel>
  );
}

// ────────────────────────────────────────────────────────────────
// Minimap (compass + radial map sketch)
// ────────────────────────────────────────────────────────────────
function Minimap() {
  return (
    <Panel style={{ padding: 8, width: 200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Eyebrow>Ravenmoor</Eyebrow>
        <span style={{ fontFamily: "var(--fg-mono)", fontSize: 10, color: "var(--fg-parch-3)" }}>−214,&nbsp;88</span>
      </div>
      <div style={{
        position: "relative", width: "100%", aspectRatio: "1",
        background:
          "radial-gradient(50% 50% at 50% 50%, #3a2a18 0%, #1a1108 70%, #0a0604 100%)",
        border: "1px solid var(--fg-gold-deep)",
        boxShadow: "inset 0 0 0 1px #000, inset 0 0 24px rgba(0,0,0,0.7)",
        overflow: "hidden",
      }}>
        {/* compass ring */}
        {["N","E","S","W"].map((d,i) => (
          <span key={d} style={{
            position: "absolute",
            top: i===0 ? 4 : i===2 ? "auto" : "50%",
            bottom: i===2 ? 4 : "auto",
            left: i===3 ? 4 : i===1 ? "auto" : "50%",
            right: i===1 ? 4 : "auto",
            transform: i===0||i===2 ? "translateX(-50%)" : "translateY(-50%)",
            fontFamily: "var(--fg-display)", fontSize: 11,
            color: d==="N" ? "var(--fg-blood-bright)" : "var(--fg-gold)",
            letterSpacing: "0.08em",
          }}>{d}</span>
        ))}
        {/* paths */}
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.7 }}>
          <path d="M 20 80 Q 60 60 100 90 T 180 70" stroke="var(--fg-parch-3)" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
          <path d="M 100 20 Q 110 60 100 100 T 80 180" stroke="var(--fg-parch-3)" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
        </svg>
        {/* POIs */}
        <div style={{ position: "absolute", left: "30%", top: "32%", color: "var(--fg-gold-bright)" }}>♦</div>
        <div style={{ position: "absolute", left: "72%", top: "60%", color: "var(--fg-blood-bright)" }}>!</div>
        <div style={{ position: "absolute", left: "20%", top: "70%", color: "var(--fg-mana-bright)" }}>⚑</div>
        {/* player arrow */}
        <div style={{
          position: "absolute", left: "50%", top: "50%",
          width: 0, height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderBottom: "12px solid var(--fg-gold-bright)",
          transform: "translate(-50%, -50%) rotate(45deg)",
          filter: "drop-shadow(0 0 4px #000)",
        }} />
      </div>
    </Panel>
  );
}

// ────────────────────────────────────────────────────────────────
// Quest tracker
// ────────────────────────────────────────────────────────────────
function QuestTracker() {
  return (
    <Panel style={{ padding: 12, width: 280 }}>
      <Eyebrow>Active Quest</Eyebrow>
      <div style={{ fontFamily: "var(--fg-display)", color: "var(--fg-gold-bright)", fontSize: 15, letterSpacing: "0.04em", marginTop: 4 }}>
        The Hollow Crown
      </div>
      <div className="fg-divider" style={{ margin: "8px 0" }}>
        <div className="fg-diamond" />
      </div>
      {[
        { done: true,  text: "Speak with the Watcher of Ash" },
        { done: true,  text: "Recover the silvered locket" },
        { done: false, text: "Slay the Marrow King", count: "0 / 1" },
        { done: false, text: "Return to Ravenmoor", muted: true },
      ].map((o,i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "4px 0",
          color: o.done ? "var(--fg-parch-dim)" : o.muted ? "var(--fg-parch-dim)" : "var(--fg-parch)",
          fontFamily: "var(--fg-body)", fontSize: 13,
          textDecoration: o.done ? "line-through" : "none",
        }}>
          <span style={{ color: o.done ? "var(--fg-stamina)" : "var(--fg-gold)", width: 12 }}>
            {o.done ? "✓" : "◇"}
          </span>
          <span style={{ flex: 1 }}>{o.text}</span>
          {o.count && (
            <span style={{ fontFamily: "var(--fg-mono)", color: "var(--fg-gold-bright)", fontSize: 11 }}>
              {o.count}
            </span>
          )}
        </div>
      ))}
    </Panel>
  );
}

// ────────────────────────────────────────────────────────────────
// Crosshair / Reticle (stylized rune cross)
// ────────────────────────────────────────────────────────────────
function Crosshair() {
  return (
    <div style={{ position: "relative", width: 80, height: 80 }}>
      <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: 24, background: "var(--fg-gold-bright)", transform: "translateX(-50%)", boxShadow: "0 0 4px #000" }} />
      <div style={{ position: "absolute", left: "50%", bottom: 0, width: 1, height: 24, background: "var(--fg-gold-bright)", transform: "translateX(-50%)", boxShadow: "0 0 4px #000" }} />
      <div style={{ position: "absolute", top: "50%", left: 0, height: 1, width: 24, background: "var(--fg-gold-bright)", transform: "translateY(-50%)", boxShadow: "0 0 4px #000" }} />
      <div style={{ position: "absolute", top: "50%", right: 0, height: 1, width: 24, background: "var(--fg-gold-bright)", transform: "translateY(-50%)", boxShadow: "0 0 4px #000" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 18, height: 18, transform: "translate(-50%, -50%) rotate(45deg)", border: "1px solid var(--fg-gold)", boxShadow: "0 0 6px rgba(232,200,120,0.4)" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 3, height: 3, transform: "translate(-50%, -50%) rotate(45deg)", background: "var(--fg-blood-bright)", boxShadow: "0 0 6px var(--fg-blood-bright)" }} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Kill / event feed
// ────────────────────────────────────────────────────────────────
function KillFeed() {
  const events = [
    ["Ardyn",      "⚔",  "Marrow Stalker", "var(--fg-gold)"],
    ["Lirien",     "✦",  "Ashfen Witch",   "var(--fg-arcane-bright)"],
    ["Marrow King","☠",  "Ardyn",          "var(--fg-blood-bright)"],
    ["Ardyn",      "🜍", "Pit Hound",      "var(--fg-poison)"],
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 280 }}>
      {events.map(([a, ic, b, c], i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "5px 10px",
          background: "linear-gradient(90deg, rgba(20,12,8,0.85), rgba(20,12,8,0.3))",
          borderLeft: `2px solid ${c}`,
          fontFamily: "var(--fg-body)", fontSize: 13, color: "var(--fg-parch)",
        }}>
          <span style={{ color: "var(--fg-gold-bright)" }}>{a}</span>
          <span style={{ color: c, fontSize: 14 }}>{ic}</span>
          <span style={{ color: "var(--fg-parch-3)" }}>{b}</span>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Floating combat numbers
// ────────────────────────────────────────────────────────────────
function FloatingDamage() {
  return (
    <div style={{ position: "relative", height: 100, display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
      {[
        { v: "−84", c: "var(--fg-blood-bright)", crit: false },
        { v: "−312!", c: "#ffd25a", crit: true },
        { v: "+126", c: "var(--fg-stamina-bright)", crit: false },
        { v: "−47", c: "var(--fg-arcane-bright)", crit: false },
        { v: "MISS", c: "var(--fg-parch-3)", crit: false },
      ].map((d,i) => (
        <span key={i} style={{
          fontFamily: "var(--fg-display)",
          fontWeight: 700,
          fontSize: d.crit ? 28 : 18,
          color: d.c,
          textShadow: `0 1px 2px #000, 0 0 8px ${d.c}`,
          letterSpacing: "0.04em",
          transform: `translateY(${[-12, -28, -6, -18, -2][i]}px)`,
        }}>{d.v}</span>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Interact prompt
// ────────────────────────────────────────────────────────────────
function InteractPrompt() {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "8px 14px",
      background: "linear-gradient(90deg, rgba(20,12,8,0.9), rgba(40,28,16,0.7))",
      border: "1px solid var(--fg-gold-deep)",
      boxShadow: "inset 0 1px 0 rgba(232,200,120,0.18), 0 4px 12px rgba(0,0,0,0.5)",
    }}>
      <Key>E</Key>
      <span style={{ fontFamily: "var(--fg-body)", fontSize: 14, color: "var(--fg-parch)" }}>
        Open the iron-bound chest
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Compass strip (top-of-screen directional)
// ────────────────────────────────────────────────────────────────
function CompassStrip() {
  const ticks = [];
  for (let i = -90; i <= 90; i += 15) ticks.push(i);
  const dirs = { 0: "N", 90: "E", "-90": "W", 180: "S" };
  return (
    <div style={{
      position: "relative",
      width: 360, height: 32,
      background: "linear-gradient(180deg, rgba(10,6,4,0.9), rgba(20,12,8,0.7))",
      border: "1px solid var(--fg-gold-deep)",
      boxShadow: "inset 0 1px 0 rgba(232,200,120,0.2)",
      overflow: "hidden",
    }}>
      {ticks.map(t => {
        const major = t % 45 === 0;
        return (
          <div key={t} style={{
            position: "absolute",
            left: `${50 + (t/90) * 50}%`,
            top: 0, bottom: 0,
            transform: "translateX(-50%)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
          }}>
            <div style={{
              width: 1,
              height: major ? 12 : 6,
              background: major ? "var(--fg-gold-bright)" : "var(--fg-parch-3)",
            }} />
            {major && (
              <span style={{
                fontFamily: "var(--fg-display)", fontSize: 11,
                color: t === 0 ? "var(--fg-blood-bright)" : "var(--fg-gold-bright)",
                letterSpacing: "0.08em", marginTop: 2,
              }}>
                {dirs[t] || `${t}°`}
              </span>
            )}
          </div>
        );
      })}
      {/* center caret */}
      <div style={{
        position: "absolute", top: -1, left: "50%",
        width: 0, height: 0,
        borderLeft: "5px solid transparent",
        borderRight: "5px solid transparent",
        borderTop: "6px solid var(--fg-blood-bright)",
        transform: "translateX(-50%)",
      }} />
    </div>
  );
}

Object.assign(window, {
  PlayerFrame, Hotbar, BuffBar, Minimap, QuestTracker,
  Crosshair, KillFeed, FloatingDamage, InteractPrompt, CompassStrip,
});
