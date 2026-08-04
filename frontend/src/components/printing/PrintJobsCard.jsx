import React from 'react'

export default function PrintJobsCard({ busy, jobs, onCancel, latestLabelJob }) {
  const getStatusLabel = (status) => {
    if (status === 'queued') return 'Kuyrukta'
    if (status === 'printing') return 'Yazdırılıyor'
    if (status === 'printed') return 'Yazdırıldı'
    if (status === 'failed') return 'Başarısız'
    if (status === 'canceled' || status === 'cancelled') return 'İptal edildi'
    return String(status || '-')
  }

  const getLabelNotice = (job) => {
    if (!job) return { text: 'Henüz etiket işi yok.', tone: 'var(--muted)' }
    const typeText = job.type === 'label' ? 'Etiket' : 'İş'
    if (job.status === 'printed') return { text: `Son ${typeText.toLowerCase()} yazıcıya gönderildi ve tamamlandı.`, tone: '#16a34a' }
    if (job.status === 'printing') return { text: `Son ${typeText.toLowerCase()} yazdırılıyor, yazıcıya gönderildi.`, tone: '#f59e0b' }
    if (job.status === 'queued') return { text: `Son ${typeText.toLowerCase()} kuyruğa alındı, yazıcıya gönderim bekliyor.`, tone: '#f59e0b' }
    if (job.status === 'failed') return { text: `Son ${typeText.toLowerCase()} gönderilemedi.`, tone: '#ef4444' }
    if (job.status === 'canceled' || job.status === 'cancelled') return { text: `Son ${typeText.toLowerCase()} iptal edildi.`, tone: '#ef4444' }
    return { text: `Son ${typeText.toLowerCase()} durumu: ${getStatusLabel(job.status)}`, tone: 'var(--muted)' }
  }

  const latestNotice = getLabelNotice(latestLabelJob)

  return (
    <div className="card" style={{ display: 'grid', gap: 10, minWidth: 0, overflow: 'hidden' }}>
      <div style={{ fontWeight: 800 }}>Son Yazdırma İşleri</div>
      <div style={{ fontSize: 12, color: latestNotice.tone, fontWeight: 700 }}>{latestNotice.text}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>Buradaki durum, işin yazdırma kuyruğundaki sonucunu gösterir.</div>
      <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
        {(jobs || []).slice(0, 20).map((job) => {
          const errorMessage = String(job?.lastError?.message || '').trim()
          const typeLabel = job.type === 'receipt' ? 'Fiş' : job.type === 'label' ? 'Etiket' : String(job.type || '-')
          const statusLabel = getStatusLabel(job.status)

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
