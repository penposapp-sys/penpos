import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/apiClient.js'

export default function ReceiptPage() {
  const { id } = useParams()
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setError('')
      try {
        const res = await api(`/api/pos/orders/${id}/receipt`)
        if (res?.success === false) {
          setReceipt(null)
          setError(res.message || 'Bu işlem için yetkiniz yok')
          return
        }
        setReceipt(res?.receipt || null)
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, [id])

  if (error) return <div className="main"><div className="card">{error}</div></div>
  if (!receipt) return <div className="main"><div className="card">Yükleniyor...</div></div>

  return (
    <div className="main">
      <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
        <h3 style={{ marginTop: 0, textAlign: 'center' }}>Fiş</h3>
        <div style={{ fontSize: 13, color: 'var(--muted)', display: 'grid', gap: 4 }}>
          <div>Sipariş No: {receipt.id}</div>
          <div>Tarih: {new Date(receipt.createdAt).toLocaleString()}</div>
          <div>Durum: {receipt.status}</div>
        </div>
        <table className="table" style={{ marginTop: 10 }}>
          <thead>
            <tr><th>Ürün</th><th>Adet</th><th>Tutar</th></tr>
          </thead>
          <tbody>
            {receipt.items.map((it, idx) => (
              <tr key={`${it.menuItemId}-${idx}`}>
                <td>{it.nameSnapshot}</td>
                <td>{it.qty}</td>
                <td>{it.subtotal} TL</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
          <div>Toplam</div>
          <div>{receipt.totals.grandTotal} TL</div>
        </div>
        {receipt.paymentMethod && (
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
            Ödeme: {receipt.paymentMethod === 'cash' ? 'Nakit' : receipt.paymentMethod === 'card' ? 'Kart' : receipt.paymentMethod}
          </div>
        )}
      </div>
    </div>
  )
}
