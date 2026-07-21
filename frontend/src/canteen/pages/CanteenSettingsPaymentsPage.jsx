import React, { useEffect, useState } from 'react'
import CanteenSettingsSection from '../components/CanteenSettingsSection.jsx'
import { api } from '../../lib/apiClient.js'
import { toast } from '../../lib/toast.js'
import { useResponsiveFlags } from '../../hooks/useResponsiveFlags.js'
import { buildCanteenPaymentMethods } from '../lib/paymentMethods.js'

const normalizeMethods = (settings) => {
  const list = Array.isArray(settings?.paymentMethods) && settings.paymentMethods.length > 0
    ? settings.paymentMethods
    : buildCanteenPaymentMethods(settings).map((method, index) => ({
        id: method.id,
        name: method.name,
        type: method.type,
        enabled: true,
        isDefault: method.isDefault === true,
        isDeleted: false,
        sortOrder: index + 1,
      }))
  return [...list]
    .filter((method) => method?.isDeleted !== true)
    .sort((a, b) => (Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0)) || String(a?.name || '').localeCompare(String(b?.name || ''), 'tr'))
}

const inferMethodType = (name) => {
  const key = String(name || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

  if (['nakit', 'cash'].includes(key)) return 'cash'
  if (['kart', 'pos', 'kredi_karti', 'credit_card', 'yemek_karti', 'ticket', 'multinet', 'sodexo', 'setcard', 'metropol'].includes(key)) return 'pos'
  if (['banka', 'bank', 'havale', 'eft', 'iban', 'transfer'].includes(key)) return 'bank'
  if (['veresiye', 'cari', 'account', 'credit', 'acik_hesap'].includes(key)) return 'account'
  return 'other'
}

export default function CanteenSettingsPaymentsPage() {
  const { isMobilePortrait } = useResponsiveFlags()
  const [methods, setMethods] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addingName, setAddingName] = useState('')
  const [editingId, setEditingId] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api('/api/canteen/payment-settings', { silent: true, cacheMode: 'no-store' })
      setMethods(normalizeMethods(result?.settings))
    } catch (err) {
      setError(err?.message || 'Ödeme seçenekleri yüklenemedi.')
      setMethods([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const setMethodValue = (id, updater) => {
    setMethods((current) => current.map((method) => {
      if (String(method?.id) !== String(id)) return method
      return typeof updater === 'function' ? updater(method) : { ...method, ...updater }
    }))
  }

  const toggleEnabled = (id) => {
    setError('')
    setMethodValue(id, (method) => ({ ...method, enabled: method.enabled !== true }))
  }

  const updateName = (id, name) => {
    setError('')
    setMethodValue(id, (method) => ({ ...method, name, type: inferMethodType(name) }))
  }

  const addMethod = () => {
    const name = String(addingName || '').trim()
    if (!name) {
      setError('Yeni ödeme seçeneği için isim girin.')
      return
    }
    if (methods.some((method) => String(method?.name || '').trim().toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))) {
      setError('Aynı isimde aktif ödeme yöntemi olamaz.')
      return
    }

    setMethods((current) => [
      ...current,
      {
        id: `tmp-${Date.now()}`,
        name,
        type: inferMethodType(name),
        enabled: true,
        isDefault: current.length === 0,
        isDeleted: false,
        sortOrder: current.length + 1,
      },
    ])
    setAdding(false)
    setAddingName('')
    setError('')
  }

  const removeMethod = (method) => {
    if (!method) return
    const confirmed = window.confirm('Bu ödeme seçeneği kaydedildiğinde kantin kasa ekranından kaldırılacak.')
    if (!confirmed) return
    setMethods((current) => current.filter((item) => String(item?.id) !== String(method?.id)))
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const activeMethods = methods.filter((method) => method.enabled === true && method.isDeleted !== true)
      const payload = methods.map((method, index) => ({
        id: method.id,
        name: String(method.name || '').trim(),
        type: method.type || inferMethodType(method.name),
        enabled: method.enabled === true,
        isDefault: method.isDefault === true,
        isDeleted: false,
        sortOrder: index + 1,
      }))
      const result = await api('/api/canteen/payment-settings', {
        method: 'PUT',
        data: {
          paymentMethods: payload,
          cashEnabled: activeMethods.some((method) => method.type === 'cash'),
          posEnabled: activeMethods.some((method) => method.type === 'pos'),
          bankEnabled: activeMethods.some((method) => method.type === 'bank'),
          accountEnabled: true,
        },
        silent: true,
      })
      setMethods(normalizeMethods(result?.settings))
      setEditingId('')
      toast.success('Kantin ödeme seçenekleri kaydedildi')
    } catch (err) {
      setError(err?.message || 'Ödeme seçenekleri kaydedilemedi.')
      toast.error(err?.message || 'Ödeme seçenekleri kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CanteenSettingsSection>
      <div style={{ display: 'grid', gap: 10, maxWidth: 860, width: '100%' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Ödeme Seçenekleri</div>
          <div style={{ color: 'var(--app-text-muted, var(--muted))', marginTop: 4 }}>
            Kantin kasasında hangi ödeme seçenekleri görünsün buradan yönetebilirsin.
          </div>
        </div>

        {loading ? <div className="card">Yükleniyor...</div> : null}
        {!loading && error ? <div style={{ color: '#ef4444' }}>{error}</div> : null}

        {!loading ? (
          <>
            <div style={{ display: 'grid', gap: 10, width: '100%' }}>
              {(methods || []).map((method) => {
                const isEditing = editingId === method.id
                const isFixedVeresiye = String(method?.id || '') === 'credit'
                return (
                  <div key={method.id} className="card" style={{ display: 'grid', gap: 12, padding: 14, minWidth: 0 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobilePortrait ? '1fr' : 'minmax(0, 1.6fr) auto', gap: 12, alignItems: 'center', minWidth: 0 }}>
                      <label style={{ display: 'flex', alignItems: isMobilePortrait ? 'flex-start' : 'center', gap: 12, minWidth: 0 }}>
                        <input type="checkbox" checked={!!method.enabled} onChange={() => toggleEnabled(method.id)} disabled={saving} />
                        {!isEditing ? (
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, overflowWrap: 'anywhere' }}>{method.name}</div>
                            <div style={{ color: 'var(--app-text-muted, var(--muted))', fontSize: 12 }}>
                              {method.enabled ? 'Aktif ödeme yöntemi' : 'Pasif ödeme yöntemi'}
                            </div>
                          </div>
                        ) : (
                          <input
                            className="input"
                            value={method.name || ''}
                            onChange={(event) => updateName(method.id, event.target.value)}
                            placeholder="Ödeme adı"
                            disabled={saving}
                            style={{ minWidth: 0 }}
                          />
                        )}
                      </label>
                      <div style={{ display: 'flex', gap: 8, justifyContent: isMobilePortrait ? 'stretch' : 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setEditingId(isEditing ? '' : method.id)}
                          disabled={saving}
                          style={{ flex: isMobilePortrait ? '1 1 140px' : undefined }}
                        >
                          {isEditing ? 'Tamam' : 'Düzenle'}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => removeMethod(method)}
                          disabled={saving || isFixedVeresiye}
                          style={{ borderColor: '#fecaca', color: '#b91c1c', flex: isMobilePortrait ? '1 1 140px' : undefined }}
                        >
                          {isFixedVeresiye ? 'Sabit' : 'Sil'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="card" style={{ display: 'grid', gap: 12, minWidth: 0 }}>
              <div>
                <div style={{ fontWeight: 800 }}>Yeni ödeme seçeneği</div>
                <div style={{ color: 'var(--app-text-muted, var(--muted))', fontSize: 13 }}>
                  Yemek Kartı, Ticket, Multinet, Havale, Online Ödeme gibi yeni yöntemler ekleyebilirsin.
                </div>
              </div>
              {!adding ? (
                <button type="button" className="btn" onClick={() => setAdding(true)} disabled={saving} style={{ width: isMobilePortrait ? '100%' : undefined }}>
                  + Ödeme Seçeneği Ekle
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
                  <input
                    className="input"
                    value={addingName}
                    onChange={(event) => setAddingName(event.target.value)}
                    placeholder="Ödeme adı"
                    disabled={saving}
                    style={{ flex: '1 1 280px', minWidth: isMobilePortrait ? 0 : 220 }}
                  />
                  <button type="button" className="btn" onClick={addMethod} disabled={saving} style={{ width: isMobilePortrait ? '100%' : undefined }}>
                    Ekle
                  </button>
                  <button type="button" className="btn" onClick={() => { setAdding(false); setAddingName('') }} disabled={saving} style={{ width: isMobilePortrait ? '100%' : undefined }}>
                    Vazgeç
                  </button>
                </div>
              )}
            </div>

            <div>
              <button className="btn" onClick={save} disabled={saving} style={{ width: isMobilePortrait ? '100%' : undefined }}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </CanteenSettingsSection>
  )
}
