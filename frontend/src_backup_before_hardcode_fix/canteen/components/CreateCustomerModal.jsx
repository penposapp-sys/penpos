import React, { useMemo, useState } from 'react'
import Modal from '../../components/Modal.jsx'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'

const normalizePhone = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  return raw.replace(/\s+/g, '').replace(/[^0-9+]/g, '')
}

export default function CreateCustomerModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const canSave = useMemo(() => String(name || '').trim().length >= 2 && !loading, [name, loading])

  const close = () => {
    if (loading) return
    onClose?.()
  }

  const save = async (e) => {
    e?.preventDefault?.()
    const cleanName = String(name || '').trim()
    if (cleanName.length < 2) {
      toast.error('İsim en az 2 karakter olmalı')
      return
    }
    const cleanPhone = normalizePhone(phone)
    const cleanNote = String(note || '').trim()

    setLoading(true)
    const res = await api('/api/canteen/customers', {
      method: 'POST',
      data: { name: cleanName, phone: cleanPhone, note: cleanNote },
      silent: true
    })
    setLoading(false)

    if (!res?.ok || !res?.customer) {
      toast.error(res?.message || 'Cari oluşturulamadı')
      return
    }

    toast.success('Cari oluşturuldu')
    setName('')
    setPhone('')
    setNote('')
    onCreated?.(res.customer)
    onClose?.()
  }

  return (
    <Modal open={open} onClose={close} title="Cari Oluştur">
      <form onSubmit={save} style={{ display: 'grid', gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ad</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Telefon (opsiyonel)</div>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Not (opsiyonel)</div>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} disabled={loading} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" type="button" onClick={close} disabled={loading}>Vazgeç</button>
          <button className="btn btn--primary" disabled={!canSave}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </form>
    </Modal>
  )
}

