import React from 'react'

export default function LabelPrinterSettingsCard({
  busy,
  agentOnline,
  agentPrinters,
  printerName,
  setPrinterName,
  widthMm,
  setWidthMm,
  heightMm,
  setHeightMm,
  autoPrintOnOrder,
  setAutoPrintOnOrder,
  printOnReady,
  setPrintOnReady,
  active,
  setActive,
  onSave,
  onTest
}) {
  return (
    <div className="card" style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontWeight: 800 }}>Etiket Yazıcısı Ayarları</div>
      <div style={{ display: 'grid', gap: 8 }}>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Etiket Yazıcını Seç</div>
          <select className="input" value={printerName} onChange={(e) => setPrinterName(e.target.value)} disabled={!agentOnline || busy}>
            <option value="">Seçiniz</option>
            {(agentPrinters || []).map((printer) => (
              <option key={printer} value={printer}>{printer}</option>
            ))}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Genişlik (mm)</div>
            <input className="input" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} placeholder="50" disabled={busy} />
          </label>
          <label>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Yükseklik (mm)</div>
            <input className="input" value={heightMm} onChange={(e) => setHeightMm(e.target.value)} placeholder="30" disabled={busy} />
          </label>
        </div>

        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Örn: 50x30 mm</div>

        <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="checkbox" checked={autoPrintOnOrder} onChange={(e) => setAutoPrintOnOrder(e.target.checked)} disabled={busy} />
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Her siparişte otomatik etiket yazdır</div>
        </label>

        <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="checkbox" checked={printOnReady} onChange={(e) => setPrintOnReady(e.target.checked)} disabled={busy} />
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Hazırlanacaklarda Hazır butonunda etiket yazdır</div>
        </label>

        <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={!String(printerName || '').trim()} />
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Aktif</div>
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={onSave} disabled={busy}>Kaydet</button>
          <button className="btn" onClick={onTest} disabled={busy || !agentOnline || !String(printerName || '').trim() || active !== true}>Test Etiket Bas</button>
        </div>
      </div>
    </div>
  )
}
