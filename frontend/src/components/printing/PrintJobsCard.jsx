import React from 'react'

export default function PrintJobsCard({ busy, jobs, onCancel }) {
  return (
    <div className="card" style={{ display: 'grid', gap: 10, minWidth: 0, overflow: 'hidden' }}>
      <div style={{ fontWeight: 800 }}>Son Yazdırma İşleri</div>
      <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
        {(jobs || []).slice(0, 20).map((job) => {
          const errorMessage = String(job?.lastError?.message || '').trim()
          const typeLabel = job.type === 'receipt' ? 'Fiş' : job.type === 'label' ? 'Etiket' : String(job.type || '-')
          const statusLabel =
            job.status === 'queued' ? 'Kuyrukta'
              : job.status === 'processing' ? 'İşleniyor'
                : job.status === 'completed' ? 'Tamamlandı'
                  : job.status === 'failed' ? 'Başarısız'
                    : job.status === 'cancelled' ? 'İptal edildi'
                      : String(job.status || '-')

          return (
            <div
              key={job.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: 10,
                padding: 10,
                border: '1px solid var(--border)',
                borderRadius: 10,
                alignItems: 'start',
                minWidth: 0,
                overflow: 'hidden'
              }}
            >
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontWeight: 800, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  {typeLabel} · {statusLabel}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
                  {job.createdAt ? new Date(job.createdAt).toLocaleString('tr-TR') : ''}
                </div>
                {!!errorMessage && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: '#fdba74',
                      background: 'color-mix(in srgb, #f59e0b 14%, var(--app-surface))',
                      border: '1px solid color-mix(in srgb, #f59e0b 42%, var(--app-border))',
                      borderRadius: 8,
                      padding: '8px 10px',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                      maxWidth: '100%'
                    }}
                    title={errorMessage}
                  >
                    {errorMessage}
                  </div>
                )}
              </div>

              {(job.status === 'queued' || job.status === 'failed') ? (
                <button className="btn btn--danger btn--compact" onClick={() => onCancel(job.id)} disabled={busy}>
                  İptal
                </button>
              ) : (
                <div style={{ width: 64, flexShrink: 0 }} />
              )}
            </div>
          )
        })}

        {(jobs || []).length === 0 && <div style={{ color: 'var(--muted)' }}>Yazdırma işi yok.</div>}
      </div>
    </div>
  )
}
