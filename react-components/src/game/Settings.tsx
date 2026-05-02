import React from 'react'

export interface SettingsCategory {
    id: string
    label: React.ReactNode
    icon?: React.ReactNode
    body?: React.ReactNode
}

export interface SettingsCategoryListProps {
    categories: SettingsCategory[]
    selectedId?: string
    onSelect?: (id: string) => void
    style?: React.CSSProperties
    className?: string
}

export const SettingsCategoryList: React.FC<SettingsCategoryListProps> = ({ categories, selectedId, onSelect, style, className }) => {
    const [internal, setInternal] = React.useState(categories[0]?.id)
    const active = selectedId ?? internal
    return (
        <div className={className} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, color: '#e6e8ec', height: '100%', ...style }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {categories.map((category) => {
                    const selected = category.id === active
                    return (
                        <li key={category.id}><button type="button" onClick={() => { setInternal(category.id); onSelect?.(category.id) }} style={{ width: '100%', display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', background: selected ? 'rgba(255,255,255,0.08)' : 'transparent', color: '#e6e8ec', border: 'none', borderLeft: `2px solid ${selected ? '#6aa9ff' : 'transparent'}`, cursor: 'pointer', textAlign: 'left' }}>{category.icon}<span>{category.label}</span></button></li>
                    )
                })}
            </ul>
            <div style={{ overflowY: 'auto', padding: 8 }}>{categories.find((category) => category.id === active)?.body}</div>
        </div>
    )
}

export interface SettingRowProps {
    label: React.ReactNode
    description?: React.ReactNode
    children: React.ReactNode
    style?: React.CSSProperties
}

export const SettingRow: React.FC<SettingRowProps> = ({ label, description, children, style }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', alignItems: 'center', ...style }}>
        <div>
            <div>{label}</div>
            {description && <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{description}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{children}</div>
    </div>
)

export interface VolumeSliderProps {
    label?: React.ReactNode
    value: number
    onChange?: (value: number) => void
    muted?: boolean
    onToggleMute?: () => void
}
export const VolumeSlider: React.FC<VolumeSliderProps> = ({ label = 'Volume', value, onChange, muted, onToggleMute }) => (
    <SettingRow label={label}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            {onToggleMute && <button type="button" onClick={onToggleMute} style={{ background: 'none', border: 'none', color: muted ? '#d23a3a' : '#e6e8ec', cursor: 'pointer', fontSize: 16 }}>{muted ? '🔇' : '🔊'}</button>}
            <input type="range" min={0} max={1} step={0.01} value={muted ? 0 : value} onChange={(event) => onChange?.(Number(event.target.value))} style={{ flex: 1 }} />
            <span style={{ width: 36, textAlign: 'right', fontSize: 12, opacity: 0.7 }}>{Math.round((muted ? 0 : value) * 100)}%</span>
        </div>
    </SettingRow>
)

export interface SelectFieldProps<T extends string | number = string> {
    label: React.ReactNode
    value: T
    options: Array<{ value: T, label: string }>
    onChange?: (value: T) => void
}
export function SelectField<T extends string | number = string>({ label, value, options, onChange }: SelectFieldProps<T>) {
    return (
        <SettingRow label={label}>
            <select value={String(value)} onChange={(event) => onChange?.((typeof options[0].value === 'number' ? Number(event.target.value) : event.target.value) as T)} style={{ width: '100%', padding: '6px 8px', background: 'rgba(15,18,24,0.7)', color: '#e6e8ec', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4 }}>
                {options.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
            </select>
        </SettingRow>
    )
}

export const ResolutionSelect: React.FC<{ value: string, options: Array<{ value: string, label: string }>, onChange?: (value: string) => void }> = ({ value, options, onChange }) => <SelectField label="Resolution" value={value} options={options} onChange={onChange} />

export const GraphicsPresetPicker: React.FC<{ value: 'low' | 'medium' | 'high' | 'ultra' | 'custom', onChange?: (value: 'low' | 'medium' | 'high' | 'ultra' | 'custom') => void }> = ({ value, onChange }) => (
    <SettingRow label="Quality preset">
        <div style={{ display: 'flex', gap: 4 }}>
            {(['low', 'medium', 'high', 'ultra', 'custom'] as const).map((preset) => (
                <button key={preset} type="button" onClick={() => onChange?.(preset)} style={{ padding: '6px 10px', background: value === preset ? '#6aa9ff' : 'rgba(15,18,24,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, cursor: 'pointer', textTransform: 'capitalize', fontSize: 12 }}>{preset}</button>
            ))}
        </div>
    </SettingRow>
)

export const QualitySetting: React.FC<{ label: React.ReactNode, value: 'off' | 'low' | 'medium' | 'high' | 'ultra', onChange?: (value: 'off' | 'low' | 'medium' | 'high' | 'ultra') => void }> = ({ label, value, onChange }) => (
    <SelectField label={label} value={value} options={[{ value: 'off', label: 'Off' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'ultra', label: 'Ultra' }]} onChange={(value) => onChange?.(value as never)} />
)

const ToggleRow: React.FC<{ label: React.ReactNode, checked: boolean, onChange?: (value: boolean) => void }> = ({ label, checked, onChange }) => (
    <SettingRow label={label}>
        <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
            <input type="checkbox" checked={checked} onChange={(event) => onChange?.(event.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: checked ? '#6aa9ff' : 'rgba(255,255,255,0.15)', borderRadius: 12, transition: 'background 200ms' }}>
                <span style={{ position: 'absolute', height: 18, width: 18, left: checked ? 23 : 3, top: 3, background: '#fff', borderRadius: '50%', transition: 'left 200ms' }} />
            </span>
        </label>
    </SettingRow>
)

export const FullscreenToggle: React.FC<{ checked: boolean, onChange?: (value: boolean) => void }> = ({ checked, onChange }) => <ToggleRow label="Fullscreen" checked={checked} onChange={onChange} />
export const VSyncToggle: React.FC<{ checked: boolean, onChange?: (value: boolean) => void }> = ({ checked, onChange }) => <ToggleRow label="V-Sync" checked={checked} onChange={onChange} />
export const InvertAxisToggle: React.FC<{ label?: React.ReactNode, checked: boolean, onChange?: (value: boolean) => void }> = ({ label = 'Invert Y axis', checked, onChange }) => <ToggleRow label={label} checked={checked} onChange={onChange} />

export const FPSCapSelect: React.FC<{ value: number, options?: number[], onChange?: (value: number) => void }> = ({ value, options = [30, 60, 75, 120, 144, 240, 0], onChange }) => (
    <SelectField<number> label="FPS Cap" value={value} options={options.map((fps) => ({ value: fps, label: fps === 0 ? 'Unlimited' : `${fps} fps` }))} onChange={onChange} />
)

export const BrightnessCalibration: React.FC<{ value: number, onChange?: (value: number) => void, testImage?: React.ReactNode }> = ({ value, onChange, testImage }) => (
    <div style={{ padding: 12, background: 'rgba(15,18,24,0.5)', borderRadius: 4, color: '#e6e8ec' }}>
        <div style={{ marginBottom: 8 }}>Adjust until the symbol is barely visible</div>
        <div style={{ minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', filter: `brightness(${value})`, marginBottom: 8 }}>{testImage ?? <div style={{ color: '#1c1f24' }}>◆ ◆ ◆</div>}</div>
        <input type="range" min={0.5} max={1.5} step={0.01} value={value} onChange={(event) => onChange?.(Number(event.target.value))} style={{ width: '100%' }} />
    </div>
)

export const FOVSlider: React.FC<{ value: number, min?: number, max?: number, onChange?: (value: number) => void }> = ({ value, min = 60, max = 120, onChange }) => (
    <SettingRow label="Field of View">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <input type="range" min={min} max={max} value={value} onChange={(event) => onChange?.(Number(event.target.value))} style={{ flex: 1 }} />
            <span style={{ width: 36, textAlign: 'right', fontSize: 12, opacity: 0.7 }}>{value}°</span>
        </div>
    </SettingRow>
)

export const MouseSensitivity: React.FC<{ value: number, ads?: number, onChangeValue?: (value: number) => void, onChangeAds?: (value: number) => void }> = ({ value, ads, onChangeValue, onChangeAds }) => (
    <>
        <SettingRow label="Mouse Sensitivity">
            <input type="range" min={0.1} max={5} step={0.05} value={value} onChange={(event) => onChangeValue?.(Number(event.target.value))} style={{ width: '100%' }} />
        </SettingRow>
        {ads !== undefined && (
            <SettingRow label="ADS Sensitivity">
                <input type="range" min={0.1} max={5} step={0.05} value={ads} onChange={(event) => onChangeAds?.(Number(event.target.value))} style={{ width: '100%' }} />
            </SettingRow>
        )}
    </>
)

export interface ControlBinding {
    id: string
    action: React.ReactNode
    key?: React.ReactNode
}

export const ControlsRebindList: React.FC<{ bindings: ControlBinding[], onRebind?: (id: string) => void }> = ({ bindings, onRebind }) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
        {bindings.map((binding) => (
            <SettingRow key={binding.id} label={binding.action}>
                <button type="button" onClick={() => onRebind?.(binding.id)} style={{ minWidth: 120, padding: '6px 10px', background: 'rgba(15,18,24,0.7)', color: '#e6e8ec', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, fontFamily: 'monospace', cursor: 'pointer' }}>{binding.key ?? 'Unbound'}</button>
            </SettingRow>
        ))}
    </div>
)

export const ControllerLayoutPreview: React.FC<{ layout?: 'xbox' | 'playstation' | 'nintendo' | 'generic', highlights?: Record<string, string> }> = ({ layout = 'xbox', highlights = {} }) => (
    <div style={{ padding: 24, background: 'rgba(15,18,24,0.5)', borderRadius: 4, textAlign: 'center', color: '#e6e8ec' }}>
        <div style={{ fontSize: 48, opacity: 0.5 }}>🎮</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4, textTransform: 'capitalize' }}>{layout} layout</div>
        {Object.keys(highlights).length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', fontSize: 12, textAlign: 'left' }}>
                {Object.entries(highlights).map(([key, value]) => <li key={key}><strong>{key}</strong>: {value}</li>)}
            </ul>
        )}
    </div>
)

export const DeadzoneSlider: React.FC<{ value: number, onChange?: (value: number) => void, label?: React.ReactNode }> = ({ value, onChange, label = 'Stick Deadzone' }) => (
    <SettingRow label={label}>
        <input type="range" min={0} max={0.5} step={0.01} value={value} onChange={(event) => onChange?.(Number(event.target.value))} style={{ width: '100%' }} />
    </SettingRow>
)

export interface AccessibilityPanelProps {
    colorblind?: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia'
    onColorblind?: (value: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia') => void
    subtitleSize?: 'small' | 'medium' | 'large'
    onSubtitleSize?: (value: 'small' | 'medium' | 'large') => void
    screenShake?: boolean
    onScreenShake?: (value: boolean) => void
    holdToToggle?: boolean
    onHoldToToggle?: (value: boolean) => void
    aimAssist?: boolean
    onAimAssist?: (value: boolean) => void
}

export const AccessibilityPanel: React.FC<AccessibilityPanelProps> = ({ colorblind = 'none', onColorblind, subtitleSize = 'medium', onSubtitleSize, screenShake = true, onScreenShake, holdToToggle = false, onHoldToToggle, aimAssist = false, onAimAssist }) => (
    <div>
        <SelectField label="Colorblind mode" value={colorblind} options={[{ value: 'none', label: 'None' }, { value: 'protanopia', label: 'Protanopia' }, { value: 'deuteranopia', label: 'Deuteranopia' }, { value: 'tritanopia', label: 'Tritanopia' }]} onChange={(value) => onColorblind?.(value as never)} />
        <SelectField label="Subtitle size" value={subtitleSize} options={[{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]} onChange={(value) => onSubtitleSize?.(value as never)} />
        <ToggleRow label="Screen shake" checked={screenShake} onChange={onScreenShake} />
        <ToggleRow label="Hold instead of toggle" checked={holdToToggle} onChange={onHoldToToggle} />
        <ToggleRow label="Aim assist" checked={aimAssist} onChange={onAimAssist} />
    </div>
)

export const LanguageSelect: React.FC<{ value: string, languages: Array<{ code: string, label: string }>, onChange?: (code: string) => void }> = ({ value, languages, onChange }) => (
    <SelectField label="Language" value={value} options={languages.map((lang) => ({ value: lang.code, label: lang.label }))} onChange={onChange} />
)

export const ResetToDefaults: React.FC<{ onReset?: () => void, label?: React.ReactNode }> = ({ onReset, label = 'Reset to defaults' }) => {
    const [confirming, setConfirming] = React.useState(false)
    return (
        <SettingRow label={label}>
            {confirming ? (
                <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={() => { onReset?.(); setConfirming(false) }} style={{ padding: '6px 10px', background: '#d23a3a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Confirm</button>
                    <button type="button" onClick={() => setConfirming(false)} style={{ padding: '6px 10px', background: 'transparent', color: '#e6e8ec', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                </div>
            ) : (
                <button type="button" onClick={() => setConfirming(true)} style={{ padding: '6px 10px', background: 'transparent', color: '#d23a3a', border: '1px solid #d23a3a', borderRadius: 4, cursor: 'pointer' }}>Reset</button>
            )}
        </SettingRow>
    )
}
