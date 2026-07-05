import React from 'react'

export const settingsUiTheme = {
  pageBg: 'var(--app-bg)',
  cardBorder: 'var(--app-border)',
  cardMuted: 'var(--app-text-muted)',
  cardBg: 'var(--app-surface)',
  shadow: '0 18px 50px rgba(15,23,42,0.08)',
  green: 'var(--theme-accent)',
  green2: 'var(--theme-accent-hover)',
}

export function SettingsUiStyles() {
  return (
    <style>{`
      .settings-ui-card {
        border: 1px solid var(--app-border);
        border-radius: 30px;
        background: var(--app-surface);
        color: var(--app-text);
        box-shadow: var(--card-shadow);
      }
      .settings-ui-panel {
        border: 1px solid var(--app-border);
        border-radius: 32px;
        background:
          radial-gradient(circle at top left, color-mix(in srgb, var(--theme-accent) 12%, transparent), transparent 28%),
          linear-gradient(135deg, var(--app-surface), var(--app-surface-soft));
        color: var(--app-text);
        box-shadow: var(--card-shadow);
      }
      .settings-ui-modal-form {
        display: grid;
        gap: 14px;
      }
      .settings-ui-grid {
        display: grid;
        gap: 14px;
      }
      .settings-ui-grid.two {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .settings-ui-label {
        display: grid;
        gap: 6px;
      }
      .settings-ui-label-title {
        font-size: 12px;
        color: var(--app-text);
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .settings-ui-input,
      .settings-ui-textarea,
      .settings-ui-select {
        min-height: 50px;
        border: 1px solid var(--app-border);
        border-radius: 18px;
        padding: 0 14px;
        font-weight: 750;
        background: var(--app-input);
        color: var(--app-text);
      }
      .settings-ui-textarea {
        min-height: 110px;
        padding: 14px;
        resize: vertical;
      }
      .settings-ui-submit {
        min-height: 52px;
        border: 0;
        border-radius: 18px;
        padding: 13px 18px;
        font-weight: 950;
        color: #ffffff;
        background: var(--theme-gradient);
        box-shadow: var(--theme-active-glow);
      }
      .app-modal .settings-ui-submit {
        border: 1px solid var(--theme-accent, var(--app-border)) !important;
        color: #ffffff !important;
        background: var(--theme-gradient) !important;
        box-shadow: var(--theme-active-glow) !important;
      }
      .settings-ui-submit:not(:disabled):hover {
        filter: brightness(1.04);
      }
      .app-modal .settings-ui-submit:not(:disabled):hover {
        filter: brightness(1.04);
      }
      .settings-ui-submit:disabled {
        border: 1px solid var(--app-border) !important;
        color: var(--app-text-muted) !important;
        background: linear-gradient(135deg, var(--app-surface-soft), color-mix(in srgb, var(--app-surface) 88%, transparent)) !important;
        box-shadow: none !important;
        opacity: 1 !important;
      }
      .app-modal .settings-ui-submit:disabled {
        border: 1px solid var(--app-border) !important;
        color: var(--app-text-muted) !important;
        background: linear-gradient(135deg, var(--app-surface-soft), color-mix(in srgb, var(--app-surface) 88%, transparent)) !important;
        box-shadow: none !important;
        opacity: 1 !important;
      }
      .settings-ui-btn {
        border: 1px solid var(--app-border);
        border-radius: 16px;
        padding: 11px 16px;
        font-weight: 900;
        color: var(--app-text);
        background: var(--app-button-bg);
        box-shadow: var(--card-shadow);
      }
      .app-modal .modalCloseButton {
        border: 1px solid var(--app-border) !important;
        background: linear-gradient(135deg, var(--app-surface), var(--app-surface-soft)) !important;
        color: var(--app-text) !important;
        box-shadow: var(--card-shadow) !important;
      }
      .settings-ui-btn-danger {
        border: 1px solid #fecaca;
        border-radius: 16px;
        padding: 11px 16px;
        font-weight: 900;
        color: #b91c1c;
        background: linear-gradient(135deg, color-mix(in srgb, #7f1d1d 22%, var(--app-surface)), color-mix(in srgb, #991b1b 12%, var(--app-surface-soft)));
        box-shadow: var(--card-shadow);
      }
      .settings-ui-subtle {
        border: 1px solid var(--app-border);
        border-radius: 18px;
        padding: 12px 14px;
        background: linear-gradient(135deg, var(--app-surface), var(--app-surface-soft));
        font-weight: 850;
        color: var(--app-text);
      }
      .settings-ui-branch-field {
        display: grid;
        gap: 12px;
      }
      .settings-ui-branch-hint {
        font-size: 13px;
        color: var(--app-text);
        line-height: 1.5;
      }
      .settings-ui-branch-list {
        display: grid;
        gap: 8px;
        overflow: visible;
        padding-right: 0;
      }
      .settings-ui-branch-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .settings-ui-branch-all-btn,
      .settings-ui-branch-clear-btn,
      .settings-ui-branch-pill {
        border: 1px solid var(--app-border);
        border-radius: 999px;
        background: linear-gradient(135deg, var(--app-surface), var(--app-surface-soft));
        color: var(--app-text);
        box-shadow: var(--card-shadow);
      }
      .settings-ui-branch-all-btn,
      .settings-ui-branch-clear-btn {
        min-height: 42px;
        padding: 0 16px;
        font-size: 13px;
        font-weight: 900;
      }
      .settings-ui-branch-all-btn.active {
        background: var(--theme-gradient);
        color: #ffffff;
        border-color: var(--theme-accent);
        box-shadow: var(--theme-active-glow);
      }
      .settings-ui-branch-pill-list {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }
      .settings-ui-branch-pill {
        min-height: 68px;
        padding: 12px 14px;
        display: grid;
        gap: 4px;
        text-align: left;
      }
      .settings-ui-branch-pill small {
        color: var(--app-text);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.35;
      }
      .settings-ui-branch-pill.active {
        border-color: var(--theme-accent);
        background: linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 12%, var(--app-surface)), rgba(255,255,255,0.98));
        box-shadow: var(--theme-active-glow);
      }
      .settings-ui-branch-empty {
        border: 1px dashed var(--app-border);
        border-radius: 18px;
        padding: 14px;
        font-size: 13px;
        color: var(--app-text);
        background: color-mix(in srgb, var(--app-surface-soft) 82%, transparent);
      }
      .settings-ui-toggle {
        min-height: 64px;
        border-radius: 24px;
        border: 1px solid var(--app-border);
        background: linear-gradient(135deg, var(--app-surface), var(--app-surface-soft));
        padding: 14px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        font-weight: 850;
        box-shadow: var(--card-shadow);
        cursor: pointer;
      }
      .settings-ui-toggle-copy {
        display: grid;
        gap: 4px;
        min-width: 0;
      }
      .settings-ui-toggle-copy small {
        color: var(--app-text);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.35;
      }
      .settings-ui-toggle-switch {
        width: 54px;
        height: 30px;
        border-radius: 999px;
        padding: 4px;
        display: flex;
        background: color-mix(in srgb, var(--app-text-muted) 45%, transparent);
        flex-shrink: 0;
        transition: all .18s ease;
      }
      .settings-ui-toggle-switch.checked {
        justify-content: flex-end;
        background: linear-gradient(135deg, #22c55e, #16a34a);
      }
      .settings-ui-toggle-dot {
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: #ffffff;
        box-shadow: 0 3px 8px rgba(15,23,42,.18);
      }
      .settings-ui-card-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: flex-start;
        margin-bottom: 18px;
        flex-wrap: wrap;
      }
      .settings-ui-card-title {
        display: flex;
        gap: 14px;
        align-items: center;
      }
      .settings-ui-card-icon {
        width: 54px;
        height: 54px;
        border-radius: 20px;
        display: grid;
        place-items: center;
        font-size: 26px;
        background: linear-gradient(135deg, color-mix(in srgb, var(--theme-accent-soft, #1f2937) 40%, var(--app-surface-soft)), var(--app-surface));
        border: 1px solid var(--app-border);
      }
      .settings-ui-card h2 {
        margin: 0;
        color: var(--app-text);
        font-weight: 950;
      }
      .settings-ui-card p {
        margin: 4px 0 0;
        color: var(--app-text);
        font-weight: 700;
        font-size: 13px;
      }
      .settings-ui-table-shell {
        border: 1px solid var(--app-border);
        border-radius: 28px;
        background: color-mix(in srgb, var(--app-surface) 94%, transparent);
        box-shadow: var(--card-shadow);
        overflow: hidden;
      }
      .settings-ui-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      @media (max-width: 768px) {
        .settings-ui-grid.two {
          grid-template-columns: 1fr;
        }
        .settings-ui-branch-actions {
          display: grid;
        }
      }
    `}</style>
  )
}

export function SettingsCard({ title, description, icon, children, action, style }) {
  return (
    <section className="settings-ui-card settings-ui-card-inner" style={{ padding: 22, ...(style || {}) }}>
      <div className="settings-ui-card-head">
        <div className="settings-ui-card-title">
          <div className="settings-ui-card-icon">{icon}</div>
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function SettingsField({ label, children }) {
  return (
    <label className="settings-ui-label">
      <div className="settings-ui-label-title">{label}</div>
      {children}
    </label>
  )
}

export function SettingsToggle({ label, description, checked = false, onChange, disabled = false }) {
  return (
    <label className="settings-ui-toggle" style={{ opacity: 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      <div className="settings-ui-toggle-copy">
        <div>{label}</div>
        {description ? <small>{description}</small> : null}
      </div>
      <input type="checkbox" checked={!!checked} onChange={onChange} disabled={disabled} style={{ display: 'none' }} />
      <span className={`settings-ui-toggle-switch ${checked ? 'checked' : ''}`}>
        <span className="settings-ui-toggle-dot" />
      </span>
    </label>
  )
}
