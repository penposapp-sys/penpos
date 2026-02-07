import React from 'react'

export default function PrintJobsCard({ busy, jobs, onCancel }) {
  return (
    <div className="card" style={{ display: 'grid', gap: 10 }}>
      <div style={{ fontWeight: 800 }}>Son Print Job’lar</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {(jobs || []).slice(0, 20).map(j => (
          <div key={j.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10, alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800 }}>{j.type} · {j.status}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{j.createdAt ? new Date(j.createdAt).toLocaleString('tr-TR') : ''}{j.lastError?.message ? ` · ${j.lastError.message}` : ''}</div>
            </div>
            {(j.status === 'queued' || j.status === 'failed') ? (
              <button className="btn btn--danger btn--compact" onClick={() => onCancel(j.id)} disabled={busy}>İptal</button>
            ) : (
              <div style={{ width: 64 }} />
            )}
          </div>
        ))}
        {(jobs || []).length === 0 && <div style={{ color: 'var(--muted)' }}>Job yok.</div>}
      </div>
    </div>
  )
}

