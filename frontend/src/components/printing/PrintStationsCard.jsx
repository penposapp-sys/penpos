import React, { useState } from 'react'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import ConfirmModal from '../ConfirmModal.jsx'
import Modal from '../Modal.jsx'

const calcStatus = (lastHeartbeatAt) => {
  if (!lastHeartbeatAt) return { status: 'no_heartbeat', ageSec: null }
  const t = new Date(lastHeartbeatAt).getTime()
  if (!Number.isFinite(t)) return { status: 'no_heartbeat', ageSec: null }
  const ageMs = Date.now() - t
  const ageSec = Math.max(0, ageMs / 1000)
  if (ageMs <= 15000) return { status: 'online', ageSec }
  if (ageMs <= 60000) return { status: 'stale', ageSec }
  return { status: 'offline', ageSec }
}

const shortId = (id) => {
  const v = String(id || '').trim()
  if (!v) return ''
  if (v.length <= 12) return v
  return `${v.slice(0, 6)}…${v.slice(-4)}`
}

const copyText = async (label, text) => {
  const v = String(text || '')
  if (!v) return
  try {
    await navigator.clipboard.writeText(v)
    toast.success('Kopyalandı')
  } catch {
    try { window.prompt(label, v) } catch {}
  }
}

export default function PrintStationsCard({ busy, system, stations, onCreate, onActivate, onReload }) {
  const [rotateStationId, setRotateStationId] = useState('')
  const [deleteStationId, setDeleteStationId] = useState('')
  const [secretModalOpen, setSecretModalOpen] = useState(false)
  const [rotatedSecret, setRotatedSecret] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const doRotate = async () => {
    const id = String(rotateStationId || '').trim()
    if (!id) return
    setSubmitting(true)
    try {
      const res = await api(`/api/printing/stations/${encodeURIComponent(id)}/rotate-secret`, { method: 'POST', data: { system }, silent: true })
      const secret = String(res?.secret || '').trim()
      if (!secret) throw new Error(res?.message || 'Secret üretilemedi')
      setRotatedSecret(secret)
      setSecretModalOpen(true)
      toast.success('Secret yenilendi')
      if (typeof onReload === 'function') await onReload()
    } catch (e) {
      toast.error(e?.message || 'Secret yenileme başarısız')
    } finally {
      setSubmitting(false)
      setRotateStationId('')
    }
  }

  const doDelete = async () => {
    const id = String(deleteStationId || '').trim()
    if (!id) return
    setSubmitting(true)
    try {
      const qs = `?system=${encodeURIComponent(system)}`
      await api(`/api/printing/stations/${encodeURIComponent(id)}${qs}`, { method: 'DELETE', silent: true })
      toast.success('İstasyon silindi')
      if (typeof onReload === 'function') await onReload()
    } catch (e) {
      toast.error(e?.message || 'Silme başarısız')
    } finally {
      setSubmitting(false)
      setDeleteStationId('')
    }
  }

  const closeSecretModal = () => {
    setSecretModalOpen(false)
    setRotatedSecret('')
  }

  const handleCreate = async () => {
    if (blocked) return
    try {
      const r = typeof onCreate === 'function' ? await onCreate() : null
      const secret = String(r?.secret || '').trim()
      if (secret) {
        setRotatedSecret(secret)
        setSecretModalOpen(true)
      }
    } catch {
    }
  }

  const blocked = busy || submitting

  return (
    <div className="card" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800 }}>Print Station</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Aynı anda sadece aktif Print Station yazdırır.</div>
        </div>
        <button className="btn" onClick={handleCreate} disabled={blocked}>Yeni İstasyon Ekle</button>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {(stations || []).map(s => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
            <div>
              <div style={{ fontWeight: 800 }}>{s.name}</div>
              <div style={{ marginTop: 2, fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>Station ID (kopyala): <span style={{ fontFamily: 'monospace' }}>{shortId(s.id)}</span></div>
                <button className="btn btn--compact" onClick={() => copyText('Station ID (kopyala)', s.id)} disabled={blocked}>Kopyala</button>
              </div>
              {(() => {
                const st = calcStatus(s.lastHeartbeatAt)
                const label = st.status === 'online' ? 'Online' : st.status === 'stale' ? 'Stale' : st.status === 'offline' ? 'Offline' : 'Heartbeat yok'
                const age = typeof st.ageSec === 'number' ? ` · Son görüldü: ${Math.round(st.ageSec)} sn önce` : ''
                const host = String(s.lastHeartbeatMeta?.hostname || '').trim()
                const ver = String(s.lastHeartbeatMeta?.version || '').trim()
                const printersCount = Number.isFinite(Number(s.lastHeartbeatMeta?.printersCount)) ? Number(s.lastHeartbeatMeta.printersCount) : 0
                return (
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)', display: 'grid', gap: 2 }}>
                    <div>{s.isActive ? 'Aktif' : 'Pasif'} · {label}{age}</div>
                    <div>PC: {host || '-'} · v{ver || '-'} · Yazıcılar: {printersCount}</div>
                  </div>
                )
              })()}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => onActivate(s.id)} disabled={blocked || s.isActive === true}>Aktif Yap</button>
              <button className="btn" onClick={() => setRotateStationId(String(s.id))} disabled={blocked}>Secret Yenile</button>
              <button className="btn btn--danger" onClick={() => setDeleteStationId(String(s.id))} disabled={blocked}>Sil</button>
            </div>
          </div>
        ))}
        {(stations || []).length === 0 && <div style={{ color: 'var(--muted)' }}>Henüz istasyon yok.</div>}
      </div>

      <ConfirmModal
        open={!!rotateStationId}
        onClose={() => setRotateStationId('')}
        title="Secret yenilensin mi?"
        description="Secret yenilenirse bu istasyona bağlı agent yeniden ayarlanmalı. Devam edilsin mi?"
        confirmText="Yenile"
        cancelText="Vazgeç"
        onConfirm={doRotate}
        confirmDisabled={blocked}
        cancelDisabled={blocked}
      />

      <ConfirmModal
        open={!!deleteStationId}
        onClose={() => setDeleteStationId('')}
        title="İstasyon silinsin mi?"
        description="Bu istasyon silinecek. İstasyonun kilitlediği job’lar failed olacaktır."
        confirmText="Sil"
        cancelText="Vazgeç"
        danger
        onConfirm={doDelete}
        confirmDisabled={blocked}
        cancelDisabled={blocked}
      />

      <Modal
        open={secretModalOpen}
        onClose={closeSecretModal}
        title="Yeni secret"
      >
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Bu secret tek sefer gösterilir. Kaybedersen Secret Yenile’ye bas.</div>
          <div className="input" style={{ fontFamily: 'monospace', userSelect: 'all' }}>{rotatedSecret}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => copyText('Station Secret (kopyala)', rotatedSecret)} disabled={!rotatedSecret}>Kopyala</button>
            <button className="btn" onClick={closeSecretModal}>Kapat</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
