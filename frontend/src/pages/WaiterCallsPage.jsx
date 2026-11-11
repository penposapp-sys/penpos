import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { toast } from '../lib/toast.js'
import { useKitchenAlertSound } from '../lib/useKitchenAlertSound.js'
import './WaiterCallsPage.css'

const formatRelativeTime = (value, now) => {
  const createdAt = new Date(value).getTime()
  if (!Number.isFinite(createdAt)) return 'Zaman bilgisi yok'
  const elapsedMinutes = Math.max(0, Math.floor((now - createdAt) / 60_000))
  if (elapsedMinutes === 0) return 'Az önce'
  if (elapsedMinutes < 60) return `${elapsedMinutes} dk önce`
  const elapsedHours = Math.floor(elapsedMinutes / 60)
  if (elapsedHours < 24) {
    const remainingMinutes = elapsedMinutes % 60
    return remainingMinutes ? `${elapsedHours} sa ${remainingMinutes} dk önce` : `${elapsedHours} sa önce`
  }
  const elapsedDays = Math.floor(elapsedHours / 24)
  return `${elapsedDays} gün önce`
}

export default function WaiterCallsPage() {
  const [calls, setCalls] = useState([])
  const [busyId, setBusyId] = useState('')
  const [now, setNow] = useState(Date.now())
  const callsInitializedRef = useRef(false)
  const callRevisionsRef = useRef(new Map())
  const { playAlert } = useKitchenAlertSound({ debounceMs: 500, storageKey: 'waiterCallSoundEnabled' })

  const load = async () => {
    try {
      const res = await api('/api/tenant/waiter-calls?status=open', {
        silent: true,
        skipBranchHeader: true,
        cacheMode: 'no-store'
      })
      if (res?.success === false) {
        toast.error(res?.message || 'Garson çağrıları yüklenemedi')
        return
      }
      const nextCalls = Array.isArray(res?.calls) ? res.calls : []
      if (callsInitializedRef.current) {
        const hasNewOrRefreshedCall = nextCalls.some((call) => {
          const id = String(call?.id || '')
          const revision = String(call?.createdAt || '')
          return id && callRevisionsRef.current.get(id) !== revision
        })
        if (hasNewOrRefreshedCall) playAlert()
      } else {
        callsInitializedRef.current = true
      }
      callRevisionsRef.current = new Map(
        nextCalls
          .map((call) => [String(call?.id || ''), String(call?.createdAt || '')])
          .filter(([id]) => id)
      )
      setCalls(nextCalls)
    } catch (err) {
      toast.error(err?.message || 'Garson çağrıları yüklenemedi')
    }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 5000)
    const clock = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => {
      window.clearInterval(timer)
      window.clearInterval(clock)
    }
  }, [playAlert])

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
        toast.error(res?.message || 'Çağrı kapatılamadı')
        return
      }
      setCalls((prev) => prev.filter((item) => item.id !== call.id))
      toast.success('Garson çağrısı kapatıldı')
    } catch (err) {
      toast.error(err?.message || 'Çağrı kapatılamadı')
    } finally {
      setBusyId('')
    }
  }

  return (
    <main className="waiter-calls-screen">
      <Link className="waiter-calls-back" to="/restoran/app/tables">
        ← Masalara Geri Dön
      </Link>
      {calls.length > 0 ? (
        <section className="waiter-calls-grid" aria-label="Açık masa çağrıları">
          {calls.map((call) => (
            <article
              key={call.id}
              className={`waiter-call-card ${call.callType === 'service_request' ? 'waiter-call-card--service' : ''}`}
            >
              <div className="waiter-call-card__topline" aria-label="Açık çağrı">
                <span className="waiter-call-card__signal" aria-hidden="true" />
              </div>
              <h2>{call.tableName || 'Masa'}</h2>
              <div className="waiter-call-card__message">
                {call.callType === 'service_request' ? 'SERVİS İSTİYOR' : 'GARSON ÇAĞIRIYOR'}
              </div>
              <div className="waiter-call-card__time">{formatRelativeTime(call.createdAt, now)}</div>
              <button className="waiter-call-card__resolve" type="button" onClick={() => resolveCall(call)} disabled={busyId === call.id}>
                {busyId === call.id ? 'KAPATILIYOR…' : 'ÇAĞRIYI KAPAT'}
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {calls.length === 0 ? (
        <div className="waiter-calls-empty"><span className="waiter-calls-empty__pulse" />Açık çağrı yok</div>
      ) : null}
    </main>
  )
}
