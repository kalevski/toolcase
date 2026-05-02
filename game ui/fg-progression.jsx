/* global React, Panel, Eyebrow, Title, Divider, ItemSlot, Key, Portrait, BuffIcon, ResourceBar, Toggle, Check, Slider */
// Progression, social, settings, feedback components

// ─── Skill / Talent tree ─────────────────────────────────────
function SkillTree() {
  const nodes = [
    { id: "a", x: 50, y: 16, glyph: "⚔", rarity: "legendary", state: "owned" },
    { id: "b", x: 22, y: 40, glyph: "✦", rarity: "epic",      state: "owned" },
    { id: "c", x: 78, y: 40, glyph: "🛡", rarity: "epic",      state: "owned" },
    { id: "d", x: 12, y: 64, glyph: "🔥", rarity: "rare",      state: "available" },
    { id: "e", x: 36, y: 64, glyph: "❄", rarity: "rare",      state: "available" },
    { id: "f", x: 64, y: 64, glyph: "☩", rarity: "rare",      state: "locked" },
    { id: "g", x: 88, y: 64, glyph: "☠", rarity: "rare",      state: "locked" },
    { id: "h", x: 30, y: 88, glyph: "✶", rarity: "mythic",    state: "locked" },
    { id: "i", x: 70, y: 88, glyph: "◉", rarity: "mythic",    state: "locked" },
  ];
  const edges = [["a","b"],["a","c"],["b","d"],["b","e"],["c","f"],["c","g"],["d","h"],["e","h"],["f","i"],["g","i"]];
  const get = id => nodes.find(n => n.id === id);
  return (
    <Panel style={{ width: 460, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <Eyebrow>Path of Ash</Eyebrow>
          <Title size={18} style={{ marginTop: 4 }}>Pyromancer</Title>
        </div>
        <div style={{ fontFamily: "var(--fg-mono)", fontSize: 12, color: "var(--fg-gold-bright)", letterSpacing: "0.14em" }}>
          ◆ 4 unspent
        </div>
      </div>
      <div className="fg-divider" style={{ margin: "10px 0 14px" }}><div className="fg-diamond" /></div>
      <div style={{
        position: "relative",
        height: 360,
        background: "radial-gradient(60% 60% at 50% 30%, rgba(201,169,97,0.06), transparent 70%)",
        border: "1px solid rgba(201,169,97,0.18)",
      }}>
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          {edges.map(([a,b], i) => {
            const A = get(a), B = get(b);
            const owned = A.state === "owned" && B.state !== "locked";
            return (
              <line key={i}
                x1={`${A.x}%`} y1={`${A.y}%`}
                x2={`${B.x}%`} y2={`${B.y}%`}
                stroke={owned ? "var(--fg-gold)" : "rgba(201,169,97,0.2)"}
                strokeWidth={owned ? 2 : 1}
                strokeDasharray={owned ? "0" : "4 4"}
              />
            );
          })}
        </svg>
        {nodes.map(n => (
          <div key={n.id} style={{
            position: "absolute", left: `${n.x}%`, top: `${n.y}%`,
            transform: "translate(-50%, -50%)",
          }}>
            <ItemSlot
              glyph={n.glyph}
              rarity={n.state === "locked" ? null : n.rarity}
              locked={n.state === "locked"}
              size={n.glyph === "✶" || n.glyph === "◉" ? 56 : 44}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── XP bar / level header ─────────────────────────────────
function LevelHeader() {
  return (
    <Panel style={{ padding: "12px 16px", width: 420 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--fg-display)", fontSize: 26, color: "var(--fg-gold-bright)", letterSpacing: "0.06em" }}>47</span>
          <div>
            <Eyebrow>Level</Eyebrow>
            <div style={{ fontFamily: "var(--fg-body)", color: "var(--fg-parch-2)", fontSize: 13 }}>Warden of the Hollow</div>
          </div>
        </div>
        <div style={{ textAlign: "right", fontFamily: "var(--fg-mono)", fontSize: 11, color: "var(--fg-parch-3)" }}>
          <div>NEXT TIER</div>
          <div style={{ color: "var(--fg-gold-bright)" }}>4,820 / 12,000</div>
        </div>
      </div>
      <ResourceBar value={4820} max={12000} kind="xp" height={8} showText={false} />
    </Panel>
  );
}

// ─── Party panel ─────────────────────────────────────
function PartyPanel() {
  const members = [
    { name: "Ardyn",  cls: "Warden",     hp: 742, max: 950, mp: 310, mmax: 520, glyph: "A", lvl: 47, leader: true },
    { name: "Lirien", cls: "Ash-Caller", hp: 620, max: 720, mp: 480, mmax: 720, glyph: "L", lvl: 42 },
    { name: "Bram",   cls: "Ironpath",   hp: 1180,max: 1250,mp: 80,  mmax: 200, glyph: "B", lvl: 51 },
    { name: "Sera",   cls: "Verdant",    hp: 0,   max: 680, mp: 0,   mmax: 640, glyph: "S", lvl: 38, dead: true },
  ];
  return (
    <Panel style={{ width: 280, padding: 12 }}>
      <Eyebrow>Fellowship</Eyebrow>
      <Title size={16} style={{ marginTop: 4 }}>The Hollow Four</Title>
      <div className="fg-divider" style={{ margin: "10px 0" }}><div className="fg-diamond" /></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {members.map((m, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, opacity: m.dead ? 0.5 : 1 }}>
            <Portrait glyph={m.glyph} size={40} level={m.lvl} ring={m.leader ? "var(--fg-legendary)" : null} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: "var(--fg-display)", fontSize: 12, color: "var(--fg-gold-bright)", letterSpacing: "0.08em" }}>
                  {m.leader && "◆ "}{m.name}
                </span>
                <span style={{ fontFamily: "var(--fg-mono)", fontSize: 9, color: "var(--fg-parch-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  {m.dead ? "fallen" : m.cls}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                <ResourceBar value={m.hp}  max={m.max}  kind="hp" height={6} showText={false} />
                <ResourceBar value={m.mp} max={m.mmax} kind="mp" height={4} showText={false} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ─── Settings panel (controls / sliders / toggles) ─────────
function SettingsPanel() {
  return (
    <Panel style={{ width: 480, padding: 0 }}>
      <div style={{ padding: "16px 20px" }}>
        <Eyebrow>Codex of Auspices</Eyebrow>
        <Title size={20} style={{ marginTop: 4 }}>Settings</Title>
      </div>
      <div style={{ display: "flex", borderTop: "1px solid rgba(201,169,97,0.2)", borderBottom: "1px solid rgba(201,169,97,0.2)" }}>
        {[
          { t: "Display",  i: "⛯", on: true },
          { t: "Audio",     i: "♪" },
          { t: "Controls", i: "⚲" },
          { t: "Gameplay", i: "⚔" },
          { t: "Access.",  i: "✶" },
        ].map((s,i) => (
          <div key={s.t} style={{
            flex: 1, padding: "12px 0", textAlign: "center",
            fontFamily: "var(--fg-display)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
            color: s.on ? "var(--fg-gold-bright)" : "var(--fg-parch-3)",
            background: s.on ? "rgba(201,169,97,0.12)" : "transparent",
            borderRight: i < 4 ? "1px solid rgba(201,169,97,0.2)" : "none",
            borderBottom: s.on ? "2px solid var(--fg-gold-bright)" : "2px solid transparent",
            cursor: "pointer",
          }}>
            <div style={{ fontSize: 16, marginBottom: 2 }}>{s.i}</div>
            {s.t}
          </div>
        ))}
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <Slider label="Master Volume" value={84} suffix="%" />
        <Slider label="Music"        value={62} suffix="%" />
        <Slider label="Effects"      value={92} suffix="%" />
        <Slider label="Field of View" value={92} suffix="°" />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--fg-display)", letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 12, color: "var(--fg-parch)" }}>Subtitles</div>
            <div style={{ fontFamily: "var(--fg-body)", fontSize: 12, color: "var(--fg-parch-3)" }}>Show dialogue captions during cinematics.</div>
          </div>
          <Toggle on={true} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "var(--fg-display)", letterSpacing: "0.12em", textTransform: "uppercase", fontSize: 12, color: "var(--fg-parch)" }}>Screen Shake</div>
            <div style={{ fontFamily: "var(--fg-body)", fontSize: 12, color: "var(--fg-parch-3)" }}>Camera tremors on heavy strikes.</div>
          </div>
          <Toggle on={false} />
        </div>
      </div>
    </Panel>
  );
}

// ─── Key rebind list ─────────────────────────────────
function KeyBindList() {
  const binds = [
    ["Light Attack",   "M1"],
    ["Heavy Attack",   "M2"],
    ["Parry / Block",  "Shift"],
    ["Dodge Roll",     "Space"],
    ["Sprint",         "Ctrl"],
    ["Interact",       "E"],
    ["Inventory",      "I"],
    ["Skill 1",        "1"],
    ["Skill 2",        "2"],
    ["Listen",         "Q", "rebinding"],
  ];
  return (
    <Panel style={{ width: 360, padding: 0 }}>
      <div style={{ padding: "16px 20px" }}>
        <Eyebrow>Glyphs of Command</Eyebrow>
        <Title size={18} style={{ marginTop: 4 }}>Key Bindings</Title>
      </div>
      <div className="fg-divider" style={{ padding: "0 20px" }}><div className="fg-diamond" /></div>
      {binds.map(([action, k, state], i) => (
        <div key={i} className="fg-row" style={{ padding: "9px 20px" }}>
          <span style={{ flex: 1, fontFamily: "var(--fg-body)", fontSize: 14 }}>{action}</span>
          {state === "rebinding" ? (
            <span style={{
              padding: "3px 10px",
              fontFamily: "var(--fg-mono)", fontSize: 11,
              color: "var(--fg-blood-bright)",
              border: "1px dashed var(--fg-blood)",
              animation: "fg-pulse 1s ease-in-out infinite",
            }}>press a key…</span>
          ) : (
            <Key>{k}</Key>
          )}
        </div>
      ))}
    </Panel>
  );
}

// ─── Achievement / journal entry ─────────────────────────────────
function AchievementToast() {
  return (
    <Panel style={{ width: 380, padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
      <ItemSlot glyph="🏆" rarity="legendary" size={48} />
      <div style={{ flex: 1 }}>
        <Eyebrow>Achievement Unlocked</Eyebrow>
        <div style={{ fontFamily: "var(--fg-display)", fontSize: 15, color: "var(--fg-gold-bright)", letterSpacing: "0.04em", marginTop: 2 }}>
          Slayer of the Marrow King
        </div>
        <div style={{ fontFamily: "var(--fg-body)", fontSize: 12, color: "var(--fg-parch-3)" }}>
          Defeat the king beneath the bone-orchard.
        </div>
      </div>
      <span style={{ fontFamily: "var(--fg-mono)", fontSize: 11, color: "var(--fg-arcane-bright)" }}>+250 ◆</span>
    </Panel>
  );
}

// ─── Boss bar (top of screen) ─────────────────────────────────
function BossBar() {
  return (
    <div style={{ width: 600 }}>
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--fg-display)", fontSize: 11, letterSpacing: "0.4em", color: "var(--fg-blood-bright)", textTransform: "uppercase" }}>
          ✦ Lord of the Bone Orchard ✦
        </span>
        <div style={{ fontFamily: "var(--fg-display)", fontSize: 22, color: "var(--fg-gold-bright)", letterSpacing: "0.12em", marginTop: 2, textShadow: "0 0 12px rgba(212,74,58,0.4)" }}>
          THE&nbsp;MARROW&nbsp;KING
        </div>
      </div>
      <div className="fg-bar" style={{
        height: 16,
        "--c-base": "#a8302a", "--c-bright": "#e0584a", "--c-shadow": "#3a0a08",
        position: "relative",
      }}>
        <div className="fg-bar-fill" style={{ width: "68%" }} />
        {/* phase ticks */}
        {[33, 66].map(p => (
          <div key={p} style={{
            position: "absolute", left: `${p}%`, top: 0, bottom: 0,
            width: 2, background: "rgba(255,255,255,0.5)",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontFamily: "var(--fg-mono)", fontSize: 10, color: "var(--fg-parch-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
        <span>Phase II · Of Bone &amp; Bramble</span>
        <span style={{ color: "var(--fg-blood-bright)" }}>13,820 / 20,000</span>
      </div>
    </div>
  );
}

// ─── Chat / event log ─────────────────────────────────
function ChatWindow() {
  const lines = [
    { ch: "Party",  c: "var(--fg-mana-bright)",   from: "Lirien", txt: "I’ll mark the next ward — give me a beat." },
    { ch: "Party",  c: "var(--fg-mana-bright)",   from: "Bram",   txt: "Holding the line. Pull two, no more." },
    { ch: "World",  c: "var(--fg-stamina-bright)", from: "Halric", txt: "Restock at the bazaar before nightfall." },
    { ch: "Combat", c: "var(--fg-blood-bright)",   from: "",       txt: "Critical strike — Marrow Stalker for 312." },
    { ch: "Whisper",c: "var(--fg-arcane-bright)",  from: "Sera",   txt: "Meet me at the dead orchard. Alone." },
  ];
  return (
    <Panel style={{ width: 380, padding: 0 }}>
      <div style={{ display: "flex", padding: "8px 12px", gap: 6, borderBottom: "1px solid rgba(201,169,97,0.2)" }}>
        {["All","Party","World","Whisper","Combat"].map((t,i) => (
          <span key={t} style={{
            padding: "3px 8px",
            fontFamily: "var(--fg-display)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
            color: i === 0 ? "var(--fg-gold-bright)" : "var(--fg-parch-3)",
            border: i === 0 ? "1px solid var(--fg-gold-deep)" : "1px solid transparent",
            cursor: "pointer",
          }}>{t}</span>
        ))}
      </div>
      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ fontFamily: "var(--fg-body)", fontSize: 13, color: "var(--fg-parch-2)", lineHeight: 1.4 }}>
            <span style={{ color: l.c, fontFamily: "var(--fg-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              [{l.ch}]
            </span>{" "}
            {l.from && <span style={{ color: "var(--fg-gold-bright)" }}>{l.from}:</span>}{" "}
            <span>{l.txt}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: 8, borderTop: "1px solid rgba(201,169,97,0.2)", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontFamily: "var(--fg-mono)", fontSize: 11, color: "var(--fg-gold-bright)", letterSpacing: "0.12em" }}>[Party]&gt;</span>
        <span style={{ flex: 1, fontFamily: "var(--fg-body)", fontSize: 13, color: "var(--fg-parch-3)", fontStyle: "italic" }}>
          Type a message…
        </span>
        <span style={{
          width: 1, height: 14, background: "var(--fg-gold-bright)",
          animation: "fg-blink 1s steps(1) infinite",
        }} />
      </div>
    </Panel>
  );
}

// ─── Radial emote / ping wheel ─────────────────────────────────
function RadialWheel() {
  const items = [
    { glyph: "✋", label: "Halt" },
    { glyph: "👁", label: "Enemy" },
    { glyph: "❓", label: "Inquire" },
    { glyph: "✚", label: "Heal me" },
    { glyph: "⚐", label: "On me" },
    { glyph: "✦", label: "Loot" },
    { glyph: "☠", label: "Danger" },
    { glyph: "⚔", label: "Attack" },
  ];
  const R = 90;
  return (
    <div style={{
      position: "relative",
      width: 260, height: 260,
      borderRadius: "50%",
      background: "radial-gradient(50% 50% at 50% 50%, rgba(20,12,8,0.95) 0%, rgba(20,12,8,0.4) 70%, transparent 90%)",
      border: "1px solid var(--fg-gold-deep)",
      boxShadow: "inset 0 0 40px rgba(0,0,0,0.7), 0 0 24px rgba(0,0,0,0.6)",
    }}>
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        transform: "translate(-50%, -50%)",
        width: 60, height: 60, borderRadius: "50%",
        background: "radial-gradient(50% 50% at 50% 50%, var(--fg-gold-deep) 0%, transparent 70%)",
        border: "1px solid var(--fg-gold)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--fg-display)", fontSize: 10, letterSpacing: "0.2em", color: "var(--fg-gold-bright)",
        textTransform: "uppercase",
      }}>Ping</div>
      {items.map((it, i) => {
        const a = (i / items.length) * Math.PI * 2 - Math.PI / 2;
        const x = 130 + Math.cos(a) * R;
        const y = 130 + Math.sin(a) * R;
        const sel = i === 1;
        return (
          <div key={i} style={{
            position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          }}>
            <div style={{
              width: 40, height: 40,
              background: sel ? "linear-gradient(135deg, var(--fg-gold-bright), var(--fg-gold-deep))" : "linear-gradient(180deg, #2a1f14, #0e0905)",
              border: `1px solid ${sel ? "var(--fg-gold-bright)" : "var(--fg-gold-deep)"}`,
              boxShadow: sel ? "0 0 12px rgba(232,200,120,0.6)" : "inset 0 1px 0 rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
              color: sel ? "#1a120a" : "var(--fg-parch)",
              transform: "rotate(45deg)",
            }}>
              <span style={{ transform: "rotate(-45deg)" }}>{it.glyph}</span>
            </div>
            <span style={{ fontFamily: "var(--fg-display)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: sel ? "var(--fg-gold-bright)" : "var(--fg-parch-3)", marginTop: 6 }}>
              {it.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Subtitle / caption ─────────────────────────────────
function Subtitle() {
  return (
    <div style={{ width: 560, textAlign: "center" }}>
      <div style={{ fontFamily: "var(--fg-display)", fontSize: 11, letterSpacing: "0.32em", color: "var(--fg-gold-bright)", textTransform: "uppercase", marginBottom: 4 }}>
        Voren
      </div>
      <div style={{
        fontFamily: "var(--fg-body)", fontSize: 18, lineHeight: 1.5,
        color: "var(--fg-parch)",
        textShadow: "0 1px 0 #000, 0 0 8px #000, 0 0 16px #000",
        fontStyle: "italic",
      }}>
        Tread softly, stranger — the stones beneath you keep older debts than mine.
      </div>
    </div>
  );
}

Object.assign(window, {
  SkillTree, LevelHeader, PartyPanel, SettingsPanel, KeyBindList,
  AchievementToast, BossBar, ChatWindow, RadialWheel, Subtitle,
});
