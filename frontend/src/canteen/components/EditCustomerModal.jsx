import React, { useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../../components/Modal.jsx'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'

const normalizePhone = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.replace(/\s+/g, '').replace(/[^0-9+]/g, '')
}

const money = (n) => {
  const v = Number(n || 0)
  return v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function EditCustomerModal({ open, onClose, customer, onSaved }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const phoneRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setName(String(customer?.name || ''))
    setPhone(String(customer?.phone || ''))
    setTimeout(() => {
      try {
        phoneRef.current?.focus()
      } catch {
      }
    }, 50)
  }, [open, customer?.id])

  const canSave = useMemo(() => String(name || '').trim().length >= 2 && !loading, [name, loading])

  const close = () => {
    if (loading) return
    onClose?.()
  }

  const save = async (e) => {
    e?.preventDefault?.()
    if (!customer?.id) return
    const cleanName = String(name || '').trim()
    if (cleanName.length < 2) {
      toast.error('İsim en az 2 karakter olmalı')
      return
    }
    const cleanPhone = normalizePhone(phone)
    setLoading(true)
    const res = await api(`/api/canteen/customers/${customer.id}`,
      { method: 'PUT', data: { name: cleanName, phone: cleanPhone }, silent: true }
    )
    setLoading(false)
    if (!res?.ok || !res?.customer) {
      toast.error(res?.message || 'Cari güncellenemedi')
      return
    }
    toast.success('Cari güncellendi')
    onSaved?.(res.customer)
    onClose?.()
  }

  return (
    <Modal open={open} onClose={close} title="Cari Düzenle">
      <form onSubmit={save} style={{ display: 'grid', gap: 10 }}>
        <div className="card" style={{ borderColor: 'var(--border)', background: '#fff', display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Borç / Bakiye</div>
            <div style={{ fontWeight: 800 }}>{money(customer?.balance || 0)} ₺</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Son işlem</div>
            <div style={{ fontWeight: 700, fontSize: 12 }}>{customer?.lastActionAt ? new Date(customer.lastActionAt).toLocaleString('tr-TR') : '-'}</div>
          </div>
        </div>

        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Telefon (opsiyonel)</div>
          <input ref={phoneRef} className="input" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" type="button" onClick={close} disabled={loading}>Vazgeç</button>
          <button className="btn btn--primary" disabled={!canSave}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </form>
    </Modal>
  )
}

