/* global React, Panel, Eyebrow, Title, Divider, ItemSlot, Key, Portrait, ResourceBar */
// Inventory, items, shop, paperdoll, tooltip

// Item tooltip — name + rarity + stats + lore
function ItemTooltip() {
  return (
    <div style={{
      width: 280,
      background: "linear-gradient(180deg, rgba(20,12,8,0.97), rgba(10,6,4,0.97))",
      border: "1px solid var(--fg-legendary)",
      boxShadow: "0 0 0 1px #000, 0 0 24px rgba(232, 162, 58, 0.35), 0 12px 30px rgba(0,0,0,0.7)",
      padding: 14,
      fontFamily: "var(--fg-body)",
    }}>
      <div style={{ fontFamily: "var(--fg-display)", color: "var(--fg-legendary)", fontSize: 17, letterSpacing: "0.04em" }}>
        Maw of the Hollow Crown
      </div>
      <div style={{ fontFamily: "var(--fg-mono)", fontSize: 10, color: "var(--fg-parch-3)", letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 2 }}>
        Legendary · Two-handed Greatsword
      </div>
      <div className="fg-divider" style={{ margin: "10px 0" }}><div className="fg-diamond" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "4px 10px", fontSize: 13 }}>
        <span style={{ color: "var(--fg-parch-3)" }}>Damage</span>
        <span style={{ color: "var(--fg-parch)", fontFamily: "var(--fg-mono)" }}>184–212 <span style={{ color: "var(--fg-stamina-bright)" }}>+18</span></span>
        <span style={{ color: "var(--fg-parch-3)" }}>Crit</span>
        <span style={{ color: "var(--fg-parch)", fontFamily: "var(--fg-mono)" }}>14% / x2.4</span>
        <span style={{ color: "var(--fg-parch-3)" }}>Weight</span>
        <span style={{ color: "var(--fg-parch)", fontFamily: "var(--fg-mono)" }}>9.4</span>
      </div>
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(201,169,97,0.2)" }}>
        <div style={{ fontSize: 12, color: "var(--fg-arcane-bright)", marginBottom: 2 }}>◆ Marrow Drink</div>
        <div style={{ fontSize: 12, color: "var(--fg-parch-2)" }}>On crit, restore 4% HP and gain <em style={{ color: "var(--fg-blood-bright)" }}>Bloodfever</em> for 6s.</div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(201,169,97,0.2)" }}>
        <div className="fg-italic-lore" style={{ fontSize: 12, lineHeight: 1.5 }}>
          “Forged from a king’s last vow and a smith’s last breath. It remembers both.”
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontFamily: "var(--fg-mono)", fontSize: 10, color: "var(--fg-parch-3)", letterSpacing: "0.12em" }}>
        <span>Bound · Soul</span>
        <span><span style={{ color: "var(--fg-gold-bright)" }}>◈</span> 14,820</span>
      </div>
    </div>
  );
}

// Inventory grid
function InventoryGrid() {
  const items = [
    { glyph: "⚔", rarity: "rare" },
    { glyph: "🛡", rarity: "uncommon" },
    { glyph: "🧪", rarity: "common", qty: 8 },
    { glyph: "🧪", rarity: "common", qty: 12 },
    { glyph: "🜍", rarity: "rare", qty: 4 },
    { glyph: "✦", rarity: "epic" },
    null, null,
    { glyph: "🗝", rarity: "uncommon" },
    { glyph: "📜", rarity: "common", qty: 3 },
    { glyph: "💎", rarity: "legendary" },
    { glyph: "⚒", rarity: "uncommon" },
    null, null, null, null,
    { glyph: "👑", rarity: "mythic" },
    null, null, null,
    { glyph: "🍖", rarity: "common", qty: 6 },
    null, null, null,
  ];
  return (
    <Panel style={{ width: 380, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <Eyebrow>Satchel</Eyebrow>
          <Title size={18} style={{ marginTop: 4 }}>Inventory</Title>
        </div>
        <div style={{ textAlign: "right", fontFamily: "var(--fg-mono)", fontSize: 11, color: "var(--fg-parch-3)", letterSpacing: "0.14em" }}>
          <div>13 / 24</div>
          <div style={{ color: "var(--fg-gold-bright)" }}>26.4 / 60.0 wt</div>
        </div>
      </div>
      <div className="fg-divider" style={{ margin: "10px 0" }}><div className="fg-diamond" /></div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, fontFamily: "var(--fg-display)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase" }}>
        {["All","Arms","Armor","Consume","Quest","Misc"].map((t,i) => (
          <span key={t} style={{
            padding: "4px 8px",
            color: i === 0 ? "var(--fg-gold-bright)" : "var(--fg-parch-3)",
            borderBottom: i === 0 ? "2px solid var(--fg-gold-bright)" : "2px solid transparent",
            cursor: "pointer",
          }}>{t}</span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
        {items.map((it, i) => (
          <ItemSlot key={i} {...(it || {})} size={52} />
        ))}
      </div>
      <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(201,169,97,0.25)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--fg-mono)", fontSize: 11, color: "var(--fg-parch-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Currency</span>
        <span style={{ display: "flex", gap: 14, fontFamily: "var(--fg-mono)", fontSize: 13 }}>
          <span style={{ color: "var(--fg-gold-bright)" }}>◉ 4,218</span>
          <span style={{ color: "var(--fg-arcane-bright)" }}>◆ 24</span>
          <span style={{ color: "var(--fg-blood-bright)" }}>✦ 3</span>
        </span>
      </div>
    </Panel>
  );
}

// Equipment paperdoll
function Paperdoll() {
  const slots = [
    { row: 1, col: 1, glyph: "⛑", rarity: "rare",      label: "Helm" },
    { row: 1, col: 3, glyph: "📿", rarity: "epic",      label: "Amulet" },
    { row: 2, col: 1, glyph: "🛡", rarity: "uncommon",  label: "Shoulders" },
    { row: 2, col: 3, glyph: "🧥", rarity: "rare",      label: "Cloak" },
    { row: 3, col: 1, glyph: "👕", rarity: "epic",      label: "Chest" },
    { row: 3, col: 3, glyph: "✋", rarity: "uncommon",  label: "Gloves" },
    { row: 4, col: 1, glyph: "👖", rarity: "rare",      label: "Greaves" },
    { row: 4, col: 3, glyph: "💍", rarity: "legendary", label: "Ring" },
    { row: 5, col: 1, glyph: "👢", rarity: "uncommon",  label: "Boots" },
    { row: 5, col: 3, glyph: "💍", rarity: "rare",      label: "Ring" },
    { row: 6, col: 1, glyph: "⚔", rarity: "legendary", label: "Main" },
    { row: 6, col: 3, glyph: "🛡", rarity: "rare",      label: "Off" },
  ];
  return (
    <Panel style={{ width: 320, padding: 18 }}>
      <Eyebrow>The Vestments</Eyebrow>
      <Title size={18} style={{ marginTop: 4, marginBottom: 12 }}>Equipment</Title>
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 100px 1fr", gridTemplateRows: "repeat(6, auto)", gap: 8, alignItems: "center" }}>
        {slots.map((s,i) => (
          <div key={i} style={{ gridRow: s.row, gridColumn: s.col, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <ItemSlot glyph={s.glyph} rarity={s.rarity} size={48} />
            <span style={{ fontFamily: "var(--fg-mono)", fontSize: 9, color: "var(--fg-parch-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{s.label}</span>
          </div>
        ))}
        {/* center silhouette */}
        <div style={{
          gridRow: "1 / span 6", gridColumn: 2,
          height: "100%",
          background: "radial-gradient(50% 60% at 50% 40%, rgba(201,169,97,0.08), transparent 70%)",
          border: "1px dashed rgba(201,169,97,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--fg-display)", fontSize: 60, color: "rgba(201,169,97,0.18)",
        }}>
          ✦
        </div>
      </div>
      <div className="fg-divider" style={{ margin: "16px 0 10px" }}><div className="fg-diamond" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", fontFamily: "var(--fg-mono)", fontSize: 12 }}>
        <span style={{ color: "var(--fg-parch-3)" }}>ARMOR</span>      <span style={{ color: "var(--fg-gold-bright)", textAlign: "right" }}>418</span>
        <span style={{ color: "var(--fg-parch-3)" }}>RESIST</span>     <span style={{ color: "var(--fg-mana-bright)", textAlign: "right" }}>32%</span>
        <span style={{ color: "var(--fg-parch-3)" }}>DAMAGE</span>     <span style={{ color: "var(--fg-blood-bright)", textAlign: "right" }}>184–212</span>
        <span style={{ color: "var(--fg-parch-3)" }}>WEIGHT</span>     <span style={{ color: "var(--fg-parch)",    textAlign: "right" }}>26.4</span>
      </div>
    </Panel>
  );
}

// Shop
function ShopPanel() {
  const items = [
    { glyph: "⚔", rarity: "rare",      name: "Knell-Steel Longsword", price: 1240 },
    { glyph: "🏹", rarity: "uncommon", name: "Yew Hunter's Bow",       price: 480 },
    { glyph: "🧪", rarity: "common",   name: "Heart-Salve",            price: 64 },
    { glyph: "📜", rarity: "epic",     name: "Tome of the Pale March", price: 3800 },
    { glyph: "💎", rarity: "rare",     name: "Soulbright Shard",       price: 920 },
    { glyph: "🛡", rarity: "uncommon", name: "Ironbark Buckler",       price: 360 },
  ];
  return (
    <Panel style={{ width: 460, padding: 0 }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <Portrait glyph="⚒" size={48} />
        <div style={{ flex: 1 }}>
          <Eyebrow>Ravenmoor Bazaar</Eyebrow>
          <Title size={18}>Halric the Trader</Title>
        </div>
        <div style={{ textAlign: "right", fontFamily: "var(--fg-mono)", fontSize: 12, color: "var(--fg-parch-3)" }}>
          <div>YOUR PURSE</div>
          <div style={{ color: "var(--fg-gold-bright)", fontSize: 16 }}>◉ 4,218</div>
        </div>
      </div>
      <div style={{ display: "flex", padding: "0 20px", gap: 4 }}>
        {["Buy", "Sell", "Repair", "Identify"].map((t,i) => (
          <span key={t} style={{
            padding: "8px 14px",
            fontFamily: "var(--fg-display)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
            color: i === 0 ? "var(--fg-gold-bright)" : "var(--fg-parch-3)",
            borderBottom: i === 0 ? "2px solid var(--fg-gold-bright)" : "2px solid transparent",
            cursor: "pointer",
          }}>{t}</span>
        ))}
      </div>
      <div className="fg-divider" style={{ padding: "0 20px" }}><div className="fg-diamond" /></div>
      {items.map((it, i) => (
        <div key={i} className={`fg-row ${i === 0 ? "is-selected" : ""}`}>
          <ItemSlot glyph={it.glyph} rarity={it.rarity} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--fg-display)", fontSize: 14, color: `var(--fg-${it.rarity})`, letterSpacing: "0.04em" }}>{it.name}</div>
            <div style={{ fontFamily: "var(--fg-mono)", fontSize: 10, color: "var(--fg-parch-3)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              {it.rarity}
            </div>
          </div>
          <div style={{ fontFamily: "var(--fg-mono)", color: "var(--fg-gold-bright)", fontSize: 14 }}>
            ◉ {it.price.toLocaleString()}
          </div>
        </div>
      ))}
    </Panel>
  );
}

Object.assign(window, { ItemTooltip, InventoryGrid, Paperdoll, ShopPanel });
