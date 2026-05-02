/* global React */
// Fantasy Game UI — primitive components shared across artboards

const { useState, useEffect, useRef } = React;

// ────────────────────────────────────────────────────────────────
// Panel — gilded square frame with corner notches
// ────────────────────────────────────────────────────────────────
function Panel({ children, style, className = "", bordered = true, corners = true, parchment = false, ...rest }) {
  const cls = [
    "fg-panel",
    bordered && "fg-bordered",
    corners && "fg-corners",
    parchment && "fg-parchment",
    className,
  ].filter(Boolean).join(" ");
  return (
    <div className={cls} style={style} {...rest}>
      {children}
    </div>
  );
}

// Eyebrow + Title + Divider helpers
function Eyebrow({ children, style }) {
  return <div className="fg-eyebrow" style={style}>{children}</div>;
}
function Title({ children, size = 18, style }) {
  return (
    <div className="fg-title" style={{ fontSize: size, ...style }}>{children}</div>
  );
}
function Divider({ style }) {
  return (
    <div className="fg-divider" style={style}>
      <div className="fg-diamond" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Resource bar (HP / MP / Stamina / XP)
// ────────────────────────────────────────────────────────────────
function ResourceBar({
  value, max, kind = "hp", label, ghost,
  showText = true, height = 18, segments = false,
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const ghostPct = ghost != null ? Math.max(0, Math.min(100, (ghost / max) * 100)) : null;

  const palette = {
    hp:      { base: "#a8302a", bright: "#e0584a", shadow: "#5a1410" },
    mp:      { base: "#3a6cc9", bright: "#7aaef0", shadow: "#1a2e6a" },
    stamina: { base: "#6f9f3a", bright: "#a8d65a", shadow: "#2a4818" },
    xp:      { base: "#c9a961", bright: "#f0d27a", shadow: "#5a4422" },
    shield:  { base: "#c5cfd6", bright: "#f0f4f8", shadow: "#5a6470" },
    rage:    { base: "#d44a3a", bright: "#f57052", shadow: "#5a1a14" },
  }[kind] || { base: "#888", bright: "#ccc", shadow: "#333" };

  return (
    <div style={{ width: "100%" }}>
      {label && (
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontFamily: "var(--fg-mono)", fontSize: 10, letterSpacing: "0.18em",
          textTransform: "uppercase", color: "var(--fg-parch-3)",
          marginBottom: 4,
        }}>
          <span>{label}</span>
          {showText && <span style={{ color: "var(--fg-parch)" }}>{Math.round(value)}/{max}</span>}
        </div>
      )}
      <div className="fg-bar" style={{
        height,
        "--c-base": palette.base,
        "--c-bright": palette.bright,
        "--c-shadow": palette.shadow,
      }}>
        {ghostPct != null && ghostPct > pct && (
          <div className="fg-bar-ghost" style={{ left: `${pct}%`, width: `${ghostPct - pct}%` }} />
        )}
        <div className="fg-bar-fill" style={{ width: `${pct}%` }} />
        {!label && showText && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--fg-mono)", fontSize: 11,
            color: "var(--fg-parch)", textShadow: "0 1px 2px #000, 0 0 3px #000",
            letterSpacing: "0.08em",
          }}>
            {Math.round(value)} / {max}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Item slot — for inventory, hotbar, equipment
// ────────────────────────────────────────────────────────────────
function ItemSlot({
  glyph, qty, hotkey, rarity, size = 56, cooldown, locked, onClick, style,
}) {
  return (
    <div
      className={`fg-slot ${rarity ? `r-${rarity}` : ""} ${!glyph ? "is-empty" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.42, ...style }}
      onClick={onClick}
    >
      {hotkey && <div className="fg-slot-key">{hotkey}</div>}
      {glyph && <span style={{ filter: locked ? "grayscale(1) brightness(0.5)" : "none" }}>{glyph}</span>}
      {qty != null && qty > 1 && <div className="fg-slot-qty">{qty}</div>}
      {cooldown != null && cooldown > 0 && (
        <div style={{
          position: "absolute", inset: 0,
          background: `conic-gradient(from -90deg, rgba(0,0,0,0.75) ${cooldown * 3.6}deg, transparent 0)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--fg-mono)", fontSize: 14, color: "#fff",
          textShadow: "0 1px 2px #000",
        }}>
          {Math.ceil(cooldown / 10)}
        </div>
      )}
      {locked && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--fg-gold-deep)", fontSize: 22,
        }}>
          <i className="bi bi-lock-fill" />
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Key cap (for hotkey hints)
// ────────────────────────────────────────────────────────────────
function Key({ children, style }) {
  return <span className="fg-key" style={style}>{children}</span>;
}

// ────────────────────────────────────────────────────────────────
// Toggle / Checkbox
// ────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <div
      className={`fg-toggle ${on ? "on" : ""}`}
      onClick={() => onChange && onChange(!on)}
    />
  );
}
function Check({ on, onChange }) {
  return (
    <div
      className={`fg-check ${on ? "on" : ""}`}
      onClick={() => onChange && onChange(!on)}
    />
  );
}

// ────────────────────────────────────────────────────────────────
// Slider
// ────────────────────────────────────────────────────────────────
function Slider({ value, max = 100, label, suffix = "" }) {
  const pct = (value / max) * 100;
  return (
    <div>
      {label && (
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontFamily: "var(--fg-mono)", fontSize: 10,
          letterSpacing: "0.16em", textTransform: "uppercase",
          color: "var(--fg-parch-3)", marginBottom: 6,
        }}>
          <span>{label}</span>
          <span style={{ color: "var(--fg-gold-bright)" }}>{value}{suffix}</span>
        </div>
      )}
      <div className="fg-slider">
        <div className="fg-slider-fill" style={{ width: `${pct}%` }} />
        <div className="fg-slider-handle" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Portrait (circular medallion with initials/glyph)
// ────────────────────────────────────────────────────────────────
function Portrait({ glyph = "✦", size = 64, ring, level }) {
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div
        className="fg-portrait fg-portrait-circle"
        style={{
          width: size, height: size, fontSize: size * 0.4,
          borderColor: ring || "var(--fg-gold-deep)",
        }}
      >
        {glyph}
      </div>
      {level != null && (
        <div style={{
          position: "absolute", bottom: -4, right: -4,
          minWidth: 22, height: 22, padding: "0 5px",
          background: "linear-gradient(180deg, #3a2a18, #1a120a)",
          border: "1px solid var(--fg-gold)",
          fontFamily: "var(--fg-mono)", fontSize: 11, fontWeight: 700,
          color: "var(--fg-gold-bright)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 4px #000",
        }}>{level}</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Buff / Debuff icon (square with timer)
// ────────────────────────────────────────────────────────────────
function BuffIcon({ glyph, time, kind = "buff", color, size = 36 }) {
  return (
    <div style={{
      position: "relative",
      width: size, height: size,
      background: kind === "buff"
        ? "linear-gradient(135deg, #2a3a1a, #0a1006)"
        : "linear-gradient(135deg, #3a1a14, #100604)",
      border: `1px solid ${color || (kind === "buff" ? "var(--fg-stamina)" : "var(--fg-blood)")}`,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.5,
      color: color || (kind === "buff" ? "var(--fg-stamina-bright)" : "var(--fg-blood-bright)"),
    }}>
      {glyph}
      {time && (
        <div style={{
          position: "absolute", bottom: -1, right: 1,
          fontFamily: "var(--fg-mono)", fontSize: 10,
          color: "var(--fg-parch)", textShadow: "0 1px 2px #000",
        }}>{time}</div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Artboard helpers — wrap content with a label-friendly bg
// ────────────────────────────────────────────────────────────────
function ArtboardBackdrop({ children, kind = "dark", style }) {
  // kind: dark | scene | parch
  const bg = {
    dark: "radial-gradient(120% 90% at 50% 0%, #1f180e 0%, #0a0604 80%)",
    scene:
      "radial-gradient(60% 50% at 50% 30%, #4a3a22 0%, #1a1108 60%, #0a0604 100%), " +
      "linear-gradient(180deg, #1a1308 0%, #0a0604 100%)",
    parch: "linear-gradient(180deg, #1a1308 0%, #0a0604 100%)",
  }[kind];
  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      background: bg, padding: 24,
      ...style,
    }}>
      {children}
    </div>
  );
}

Object.assign(window, {
  Panel, Eyebrow, Title, Divider,
  ResourceBar, ItemSlot, Key,
  Toggle, Check, Slider,
  Portrait, BuffIcon,
  ArtboardBackdrop,
});
