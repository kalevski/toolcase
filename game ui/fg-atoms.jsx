/* global React, Panel, Eyebrow, Title, Divider */
// Smaller reusable building blocks (atoms) — used inside the complex components

// ─── GildedFrame — bare gilded border, no corner notches ───
function GildedFrame({ children, style, padding = 0, tone = "dark" }) {
  const bg = tone === "dark"
    ? "linear-gradient(180deg, #1a1308 0%, #0e0905 100%)"
    : tone === "leather"
      ? "linear-gradient(180deg, #2a1f14, #1a1308)"
      : "transparent";
  return (
    <div style={{
      background: bg,
      border: "1px solid var(--fg-gold-deep)",
      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 1px 0 rgba(232,200,120,0.12)",
      padding,
      ...style,
    }}>{children}</div>
  );
}

// ─── RuneCorner — single CSS-clipped gilded corner accent ───
function RuneCorner({ at = "tl", size = 12 }) {
  const pos = {
    tl: { top: -1, left: -1, transform: "none" },
    tr: { top: -1, right: -1, transform: "scaleX(-1)" },
    bl: { bottom: -1, left: -1, transform: "scaleY(-1)" },
    br: { bottom: -1, right: -1, transform: "scale(-1, -1)" },
  }[at];
  return (
    <div style={{
      position: "absolute",
      width: size, height: size,
      background: "linear-gradient(135deg, var(--fg-gold-bright), var(--fg-gold) 35%, var(--fg-gold-deep) 60%, #2a1c0e)",
      clipPath: "polygon(0 0, 100% 0, 100% 35%, 65% 35%, 65% 100%, 0 100%)",
      pointerEvents: "none",
      ...pos,
    }} />
  );
}

// ─── MetalButton — atomic button (used by all CTA buttons) ───
function MetalButton({ children, variant = "default", size = "md", style, ...rest }) {
  const cls = `fg-btn ${variant === "primary" ? "fg-btn-primary" : variant === "danger" ? "fg-btn-danger" : variant === "ghost" ? "fg-btn-ghost" : ""}`;
  const sizeStyle = size === "sm" ? { padding: "6px 14px", fontSize: 11 } : size === "lg" ? { padding: "12px 28px", fontSize: 14 } : null;
  return (
    <button className={cls} style={{ ...sizeStyle, ...style }} {...rest}>{children}</button>
  );
}

// ─── IconBadge — small framed glyph (used in dialogs, toasts, headers) ───
function IconBadge({ glyph, size = 32, color = "var(--fg-gold-bright)", bg }) {
  return (
    <div style={{
      width: size, height: size,
      background: bg || "linear-gradient(180deg, #2a1f14, #0a0604)",
      border: "1px solid var(--fg-gold-deep)",
      boxShadow: "inset 0 1px 0 rgba(232,200,120,0.18), 0 1px 2px rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.5, color,
    }}>{glyph}</div>
  );
}

// ─── StatRow — label + value, mono numerals (used everywhere) ───
function StatRow({ label, value, accent = "var(--fg-gold-bright)", trend }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "3px 0",
    }}>
      <span style={{ fontFamily: "var(--fg-mono)", fontSize: 10, letterSpacing: "0.16em",
                     textTransform: "uppercase", color: "var(--fg-parch-3)" }}>{label}</span>
      <span style={{ fontFamily: "var(--fg-mono)", fontSize: 13, color: accent }}>
        {value}
        {trend && <span style={{ color: trend > 0 ? "var(--fg-stamina-bright)" : "var(--fg-blood-bright)", marginLeft: 6, fontSize: 11 }}>
          {trend > 0 ? "▲" : "▼"}{Math.abs(trend)}
        </span>}
      </span>
    </div>
  );
}

// ─── TabBar — gilded tab strip (settings, shop, inventory) ───
function TabBar({ tabs, active = 0, onChange, size = "md" }) {
  const fs = size === "sm" ? 10 : 11;
  return (
    <div style={{ display: "flex", gap: 0 }}>
      {tabs.map((t, i) => {
        const on = i === active;
        const label = typeof t === "string" ? t : t.label;
        const icon = typeof t === "string" ? null : t.icon;
        return (
          <span key={label} onClick={() => onChange && onChange(i)} style={{
            padding: "8px 14px",
            fontFamily: "var(--fg-display)", fontSize: fs, letterSpacing: "0.18em", textTransform: "uppercase",
            color: on ? "var(--fg-gold-bright)" : "var(--fg-parch-3)",
            background: on ? "rgba(201,169,97,0.12)" : "transparent",
            borderBottom: on ? "2px solid var(--fg-gold-bright)" : "2px solid transparent",
            cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            {icon && <span style={{ fontSize: fs + 2 }}>{icon}</span>}
            {label}
          </span>
        );
      })}
    </div>
  );
}

// ─── ListRow — selectable row used in saves, shop, key list ───
function ListRow({ children, selected, onClick, leftAccent = "var(--fg-gold)" }) {
  return (
    <div onClick={onClick} style={{
      padding: "10px 14px",
      borderTop: "1px solid rgba(201, 169, 97, 0.15)",
      display: "flex", alignItems: "center", gap: 12,
      cursor: "pointer",
      background: selected ? "linear-gradient(90deg, rgba(201,169,97,0.18), transparent)" : "transparent",
      boxShadow: selected ? `inset 3px 0 0 ${leftAccent}` : "none",
      transition: "background 0.15s ease",
    }}>{children}</div>
  );
}

// ─── ProgressArc — circular progress (cooldowns, charge, casting) ───
function ProgressArc({ value, max = 100, size = 64, stroke = 4, color = "var(--fg-gold-bright)", glyph, label }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth={stroke + 2} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(201,169,97,0.2)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          strokeLinecap="butt"
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--fg-display)", color: color, fontSize: glyph ? size * 0.32 : size * 0.24,
        letterSpacing: "0.04em",
      }}>
        {glyph || `${Math.round(pct * 100)}%`}
        {label && <span style={{ fontFamily: "var(--fg-mono)", fontSize: 9, color: "var(--fg-parch-3)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>{label}</span>}
      </div>
    </div>
  );
}

// ─── RarityChip — small pill marking rarity (used in tooltips / shop rows) ───
function RarityChip({ rarity = "common" }) {
  return (
    <span style={{
      fontFamily: "var(--fg-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
      color: `var(--fg-${rarity})`,
      padding: "2px 6px",
      border: `1px solid var(--fg-${rarity})`,
      background: "rgba(0,0,0,0.4)",
    }}>{rarity}</span>
  );
}

// ─── CurrencyChip — coin + amount (used in shop, inventory, tooltips) ───
function CurrencyChip({ glyph = "◉", amount, color = "var(--fg-gold-bright)" }) {
  return (
    <span style={{ fontFamily: "var(--fg-mono)", fontSize: 13, color, display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span>{glyph}</span><span>{amount.toLocaleString()}</span>
    </span>
  );
}

// ─── LoreText — italic flavor text (used in tooltips, loading, dialogs) ───
function LoreText({ children, style }) {
  return (
    <div style={{
      fontFamily: "var(--fg-body)", fontStyle: "italic",
      color: "var(--fg-parch-3)", fontSize: 13, lineHeight: 1.5,
      ...style,
    }}>{children}</div>
  );
}

// ─── PanelHeader — eyebrow + title in one (used by every Panel-header pattern) ───
function PanelHeader({ eyebrow, title, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Title size={18} style={{ marginTop: 4 }}>{title}</Title>
      </div>
      {right}
    </div>
  );
}

// ─── MenuItem — uniform menu row (main menu, pause menu) ───
function MenuItem({ label, hotkey, selected, icon }) {
  return (
    <div style={{
      padding: "10px 14px",
      fontFamily: "var(--fg-display)", letterSpacing: "0.16em", textTransform: "uppercase", fontSize: 13,
      color: selected ? "var(--fg-gold-bright)" : "var(--fg-parch)",
      background: selected ? "linear-gradient(90deg, rgba(201,169,97,0.22), transparent 70%)" : "transparent",
      borderLeft: selected ? "2px solid var(--fg-gold-bright)" : "2px solid transparent",
      display: "flex", alignItems: "center", gap: 10,
      cursor: "pointer",
    }}>
      {selected && <span style={{ color: "var(--fg-gold-bright)" }}>◆</span>}
      {!selected && icon && <span>{icon}</span>}
      <span style={{ flex: 1 }}>{label}</span>
      {hotkey && <span className="fg-key">{hotkey}</span>}
    </div>
  );
}

// ─── ScrollText — vertical lore text block ───
function ScrollText({ title, children }) {
  return (
    <div style={{ padding: 14, background: "rgba(10,6,4,0.6)", border: "1px solid rgba(201,169,97,0.25)" }}>
      {title && <div style={{ fontFamily: "var(--fg-mono)", fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--fg-gold)", marginBottom: 6 }}>✦ {title}</div>}
      <LoreText>{children}</LoreText>
    </div>
  );
}

Object.assign(window, {
  GildedFrame, RuneCorner, MetalButton, IconBadge, StatRow, TabBar, ListRow,
  ProgressArc, RarityChip, CurrencyChip, LoreText, PanelHeader, MenuItem, ScrollText,
});
