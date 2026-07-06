import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function WaiterCallsPage() {
  const nav = useNavigate()
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api('/api/tenant/waiter-calls?status=open', {
        silent: true,
        skipBranchHeader: true,
        cacheMode: 'no-store'
      })
      if (res?.success === false) {
        toast.error(res?.message || 'Garson cagrilari yuklenemedi')
        return
      }
      setCalls(Array.isArray(res?.calls) ? res.calls : [])
    } catch (err) {
      toast.error(err?.message || 'Garson cagrilari yuklenemedi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 5000)
    return () => window.clearInterval(timer)
  }, [])

  const resolveCall = async (call) => {
    if (!call?.id || busyId) return
    setBusyId(call.id)
    try {
      const res = await api(`/api/tenant/waiter-calls/${call.id}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({}),
        silent: true,
        skipBranchHeader: true,
      })
      if (res?.success === false) {
        toast.error(res?.message || 'Cagri kapatilamadi')
        return
      }
      setCalls((prev) => prev.filter((item) => item.id !== call.id))
      toast.success('Garson cagrisi kapatildi')
    } catch (err) {
      toast.error(err?.message || 'Cagri kapatilamadi')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em' }}>Garson Cagrilari</div>
          <div style={{ marginTop: 6, color: 'var(--muted)' }}>
            QR menuden gelen acik masa cagrilarini buradan takip edebilirsiniz.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={load} disabled={loading}>
            {loading ? 'Yukleniyor...' : 'Yenile'}
          </button>
          <button className="btn" type="button" onClick={() => nav('/kermes/app/tables')}>
            Masalara Don
          </button>
        </div>
      </div>

      {calls.length > 0 ? (
        <div className="tablesGrid">
          {calls.map((call) => (
            <div
              key={call.id}
              className="card"
              style={{
                display: 'grid',
                gap: 10,
                minHeight: 156,
                alignContent: 'start',
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: '#f97316',
                boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
                position: 'relative'
              }}
            >
              <span
                className="page-pill"
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: '#f97316',
                  borderColor: '#f97316',
                  color: '#fff'
                }}
              >
                Acik Cagri
              </span>

              <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.15, paddingRight: 90 }}>
                {call.tableName || 'Masa secilmedi'}
              </div>

              <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                {formatDateTime(call.createdAt)}
              </div>

              <div style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                QR menu uzerinden garson cagrisi olusturuldu.
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button className="btn" type="button" onClick={() => resolveCall(call)} disabled={busyId === call.id}>
                  {busyId === call.id ? 'Kapatiliyor...' : 'Cagriyi Kapat'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {calls.length === 0 && !loading ? (
        <div className="card">Acik garson cagrisi yok.</div>
      ) : null}
    </div>
  )
}
