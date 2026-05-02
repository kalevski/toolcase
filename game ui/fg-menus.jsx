/* global React, Panel, Eyebrow, Title, Divider, ItemSlot, Key, Portrait, ResourceBar */
// Menu / dialog components

// ────────────────────────────────────────────────────────────────
// Main Menu
// ────────────────────────────────────────────────────────────────
function MainMenu() {
  const items = ["Continue", "New Game", "Load Saga", "Multiplayer", "Settings", "Codex", "Quit to Desktop"];
  return (
    <div style={{
      width: 520, height: 600, position: "relative",
      background:
        "radial-gradient(70% 50% at 50% 25%, #3a2a18 0%, #0a0604 70%), linear-gradient(180deg, #0a0604, #000)",
      border: "1px solid var(--fg-gold-deep)",
      padding: "60px 40px 40px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
      overflow: "hidden",
    }}>
      <div style={{ fontFamily: "var(--fg-display)", fontSize: 12, letterSpacing: "0.5em", color: "var(--fg-parch-dim)", textTransform: "uppercase" }}>
        Chapter the Third
      </div>
      <div style={{
        fontFamily: "var(--fg-display)", fontWeight: 700,
        fontSize: 44, lineHeight: 1.1, letterSpacing: "0.06em",
        color: "var(--fg-gold-bright)",
        textShadow: "0 2px 0 #000, 0 0 24px rgba(232, 200, 120, 0.35)",
        textAlign: "center",
      }}>
        EMBERFALL
      </div>
      <div className="fg-divider" style={{ width: 280 }}>
        <div className="fg-diamond" />
      </div>
      <div style={{ fontFamily: "var(--fg-body)", fontStyle: "italic", color: "var(--fg-parch-3)", fontSize: 14, textAlign: "center", maxWidth: 360 }}>
        “The crown was hollow long before the king’s neck cooled.”
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 16, width: 240 }}>
        {items.map((t, i) => (
          <div key={t} style={{
            padding: "10px 14px",
            fontFamily: "var(--fg-display)",
            letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 13,
            color: i === 0 ? "var(--fg-gold-bright)" : "var(--fg-parch)",
            background: i === 0 ? "linear-gradient(90deg, rgba(201,169,97,0.25), transparent 70%)" : "transparent",
            borderLeft: i === 0 ? "2px solid var(--fg-gold-bright)" : "2px solid transparent",
            cursor: "pointer", textAlign: "left",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            {i === 0 && <span style={{ color: "var(--fg-gold-bright)" }}>◆</span>}
            <span style={{ flex: 1 }}>{t}</span>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: "auto",
        display: "flex", justifyContent: "space-between", width: "100%",
        fontFamily: "var(--fg-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "var(--fg-parch-dim)",
      }}>
        <span>v 1.04.7 · Build 8821</span>
        <span>© Hollow Crown</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Pause Menu (overlay-style)
// ────────────────────────────────────────────────────────────────
function PauseMenu() {
  const items = ["Resume", "Inventory", "Map & Codex", "Skills", "Settings", "Save & Quit"];
  return (
    <div style={{
      width: 360, padding: "30px 24px",
      background: "linear-gradient(180deg, rgba(20,12,8,0.96), rgba(10,6,4,0.96))",
      border: "1px solid var(--fg-gold-deep)",
      boxShadow: "inset 0 0 0 1px var(--fg-gold-shadow), 0 20px 50px rgba(0,0,0,0.8)",
    }}>
      <div style={{ textAlign: "center" }}>
        <Eyebrow>The world holds its breath</Eyebrow>
        <div style={{
          fontFamily: "var(--fg-display)", fontSize: 26, marginTop: 6,
          letterSpacing: "0.12em", color: "var(--fg-gold-bright)",
        }}>PAUSED</div>
      </div>
      <div className="fg-divider" style={{ margin: "16px 0" }}>
        <div className="fg-diamond" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items.map((t, i) => (
          <div key={t} style={{
            padding: "9px 12px",
            fontFamily: "var(--fg-display)", letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 12,
            color: i === 0 ? "var(--fg-gold-bright)" : "var(--fg-parch)",
            background: i === 0 ? "rgba(201,169,97,0.12)" : "transparent",
            borderLeft: i === 0 ? "2px solid var(--fg-gold-bright)" : "2px solid transparent",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{t}</span>
            <Key>{["Esc","I","M","K","O","Q"][i]}</Key>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Confirm dialog
// ────────────────────────────────────────────────────────────────
function ConfirmDialog() {
  return (
    <Panel style={{ width: 380, padding: 0 }}>
      <div style={{ padding: "16px 20px 8px", textAlign: "center" }}>
        <Eyebrow>Abandon Run</Eyebrow>
        <div style={{ fontFamily: "var(--fg-display)", fontSize: 22, marginTop: 8, letterSpacing: "0.06em", color: "var(--fg-gold-bright)" }}>
          Forsake the Vault?
        </div>
      </div>
      <div className="fg-divider" style={{ padding: "0 20px" }}>
        <div className="fg-diamond" />
      </div>
      <div style={{ padding: "12px 24px 8px", fontFamily: "var(--fg-body)", color: "var(--fg-parch-2)", fontSize: 14, textAlign: "center", lineHeight: 1.5 }}>
        Unbanked relics will be lost to the dark. Your shards will reset to the last bonfire.
      </div>
      <div style={{ display: "flex", gap: 10, padding: 16, justifyContent: "center" }}>
        <button className="fg-btn fg-btn-ghost">Stay</button>
        <button className="fg-btn fg-btn-danger">Forsake</button>
      </div>
    </Panel>
  );
}

// ────────────────────────────────────────────────────────────────
// Dialogue box (NPC speech with portrait + choices)
// ────────────────────────────────────────────────────────────────
function DialogueBox() {
  const choices = [
    { text: "What do you guard, watcher?", tag: "[Inquisitive]" },
    { text: "Step aside or be unmade.",    tag: "[Threaten · STR 14]" },
    { text: "I carry the silvered token.", tag: "[Persuade · CHA 12]", req: true },
    { text: "Leave.", tag: "" },
  ];
  return (
    <div style={{ width: 720 }}>
      <Panel style={{ padding: 18, display: "flex", gap: 16 }}>
        <div style={{ flexShrink: 0 }}>
          <Portrait glyph="◉" size={88} />
          <div style={{ marginTop: 8, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--fg-display)", fontSize: 14, color: "var(--fg-gold-bright)", letterSpacing: "0.1em" }}>
              VOREN
            </div>
            <div style={{ fontFamily: "var(--fg-mono)", fontSize: 10, color: "var(--fg-parch-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              Watcher of Ash
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--fg-body)", fontSize: 16, lineHeight: 1.6, color: "var(--fg-parch)" }}>
            <span style={{ color: "var(--fg-gold-bright)", fontFamily: "var(--fg-display)", letterSpacing: "0.12em", fontSize: 14, marginRight: 8 }}>“</span>
            You walk where my brothers fell. The gate behind me drinks the names of the careless — and yours, stranger, has the taste of <em style={{ color: "var(--fg-gold-bright)", fontStyle: "italic" }}>old smoke</em>.
            <span style={{ color: "var(--fg-gold-bright)", fontFamily: "var(--fg-display)", letterSpacing: "0.12em", fontSize: 14, marginLeft: 4 }}>”</span>
          </div>
        </div>
      </Panel>
      <div style={{ height: 8 }} />
      <Panel style={{ padding: 6 }}>
        {choices.map((c, i) => (
          <div key={i} style={{
            padding: "9px 14px",
            display: "flex", alignItems: "center", gap: 10,
            background: i === 0 ? "linear-gradient(90deg, rgba(201,169,97,0.18), transparent)" : "transparent",
            borderLeft: i === 0 ? "2px solid var(--fg-gold-bright)" : "2px solid transparent",
            cursor: "pointer",
          }}>
            <span style={{ width: 14, color: "var(--fg-gold)", fontFamily: "var(--fg-display)", fontSize: 12 }}>{i+1}.</span>
            <span style={{ flex: 1, fontFamily: "var(--fg-body)", fontSize: 14, color: i === 0 ? "var(--fg-gold-bright)" : "var(--fg-parch)" }}>
              {c.text}
            </span>
            {c.tag && (
              <span style={{
                fontFamily: "var(--fg-mono)", fontSize: 10,
                color: c.req ? "var(--fg-arcane-bright)" : "var(--fg-parch-3)",
                letterSpacing: "0.1em",
              }}>{c.tag}</span>
            )}
          </div>
        ))}
      </Panel>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Loading screen
// ────────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      width: 700, height: 380, position: "relative",
      background: "radial-gradient(70% 60% at 50% 40%, #2a1f10 0%, #0a0604 80%)",
      border: "1px solid var(--fg-gold-deep)",
      padding: 32, display: "flex", flexDirection: "column", justifyContent: "space-between",
      overflow: "hidden",
    }}>
      <div>
        <Eyebrow style={{ color: "var(--fg-parch-3)" }}>Loading the Mire</Eyebrow>
        <div style={{
          fontFamily: "var(--fg-display)", fontSize: 32, color: "var(--fg-gold-bright)",
          letterSpacing: "0.06em", marginTop: 6,
        }}>Ravenmoor Underdeep</div>
      </div>
      <div style={{
        padding: "16px 20px",
        background: "rgba(10,6,4,0.6)",
        border: "1px solid rgba(201,169,97,0.25)",
        maxWidth: 460,
      }}>
        <div style={{ fontFamily: "var(--fg-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--fg-gold)", marginBottom: 6 }}>
          ✦ Wisdom of the road
        </div>
        <div style={{ fontFamily: "var(--fg-body)", fontStyle: "italic", color: "var(--fg-parch-2)", fontSize: 14, lineHeight: 1.5 }}>
          Hold the parry stance through a heavy strike to riposte. The riposte cannot be blocked — but neither can yours, if you are clumsy.
        </div>
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--fg-mono)", fontSize: 10, color: "var(--fg-parch-3)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>
          <span>Forging World</span>
          <span style={{ color: "var(--fg-gold-bright)" }}>62%</span>
        </div>
        <div className="fg-bar" style={{ height: 10, "--c-base": "#c9a961", "--c-bright": "#f0d27a", "--c-shadow": "#5a4422" }}>
          <div className="fg-bar-fill" style={{ width: "62%" }} />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Game Over
// ────────────────────────────────────────────────────────────────
function GameOverScreen() {
  return (
    <div style={{
      width: 480, padding: "40px 30px",
      background: "radial-gradient(60% 50% at 50% 30%, #3a0a08 0%, #0a0202 80%)",
      border: "1px solid var(--fg-blood)",
      textAlign: "center",
    }}>
      <div style={{
        fontFamily: "var(--fg-display)", fontSize: 56, fontWeight: 700,
        color: "var(--fg-blood-bright)", letterSpacing: "0.18em",
        textShadow: "0 2px 0 #000, 0 0 24px rgba(212, 74, 58, 0.6)",
      }}>YOU DIED</div>
      <div className="fg-divider" style={{ margin: "20px auto", width: 240, color: "var(--fg-blood)" }}>
        <div className="fg-diamond" style={{ background: "linear-gradient(135deg, #f57052, #5a1a14)" }} />
      </div>
      <div style={{ fontFamily: "var(--fg-body)", fontStyle: "italic", color: "var(--fg-parch-3)", fontSize: 14, marginBottom: 24 }}>
        Felled by the Marrow King · 03:14 of campaign
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button className="fg-btn fg-btn-ghost">Title Screen</button>
        <button className="fg-btn fg-btn-primary">Try Again</button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Save slot list
// ────────────────────────────────────────────────────────────────
function SaveSlots() {
  const slots = [
    { idx: 1, name: "Ardyn the Warden", lvl: 47, where: "Ravenmoor · Underdeep", time: "42h 18m", date: "Today · 19:04" },
    { idx: 2, name: "Lirien Ash-Caller", lvl: 28, where: "The Pale March",       time: "12h 03m", date: "2 days ago" },
    { idx: 3, name: "—", empty: true },
    { idx: 4, name: "Cinder (Ironpath)", lvl: 60, where: "Crown of Bone",        time: "88h 55m", date: "Last week" },
  ];
  return (
    <Panel style={{ width: 540, padding: 0 }}>
      <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Eyebrow>Saga Records</Eyebrow>
          <Title size={20} style={{ marginTop: 4 }}>Load Saga</Title>
        </div>
        <span style={{ fontFamily: "var(--fg-mono)", fontSize: 11, color: "var(--fg-parch-3)", letterSpacing: "0.14em" }}>
          3 / 8 USED
        </span>
      </div>
      <div className="fg-divider" style={{ padding: "0 20px" }}>
        <div className="fg-diamond" />
      </div>
      {slots.map(s => (
        <div key={s.idx} className={`fg-row ${s.idx === 1 ? "is-selected" : ""}`}>
          <div style={{ width: 32, fontFamily: "var(--fg-display)", color: "var(--fg-gold)", fontSize: 14, letterSpacing: "0.12em" }}>
            {String(s.idx).padStart(2, "0")}
          </div>
          {s.empty ? (
            <div style={{ flex: 1, fontFamily: "var(--fg-body)", fontStyle: "italic", color: "var(--fg-parch-dim)" }}>
              Empty slot — begin a new saga
            </div>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "var(--fg-display)", fontSize: 14, color: "var(--fg-parch)", letterSpacing: "0.06em" }}>
                  {s.name} <span style={{ color: "var(--fg-gold-bright)" }}>· Lv {s.lvl}</span>
                </div>
                <div style={{ fontFamily: "var(--fg-body)", fontSize: 12, color: "var(--fg-parch-3)", marginTop: 2 }}>
                  {s.where}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--fg-mono)", fontSize: 11, color: "var(--fg-gold-bright)" }}>{s.time}</div>
                <div style={{ fontFamily: "var(--fg-mono)", fontSize: 10, color: "var(--fg-parch-3)" }}>{s.date}</div>
              </div>
            </>
          )}
        </div>
      ))}
    </Panel>
  );
}

Object.assign(window, {
  MainMenu, PauseMenu, ConfirmDialog, DialogueBox, LoadingScreen, GameOverScreen, SaveSlots,
});
