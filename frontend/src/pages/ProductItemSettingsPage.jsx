import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import BranchAccessField from '../components/settings/BranchAccessField.jsx'
import ProductCatalogStyles from './ProductCatalogStyles.jsx'
import {
  PRODUCT_SETTING_GROUPS,
  buildProductPayload,
  createNewIngredientRow,
  createNewOptionRow,
  inflateProductForm
} from './productCatalogShared.js'

function Toggle({ checked = false, onChange }) {
  return (
    <button type="button" className={`product-toggle ${checked ? 'active' : ''}`} onClick={() => onChange(!checked)}>
      <i />
    </button>
  )
}

function Field({ label, children }) {
  return (
    <label className="product-field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function ToggleCard({ title, description, checked, onChange }) {
  return (
    <div className="product-toggle-card">
      <div>
        <h4 style={{ margin: 0, fontWeight: 900, color: 'var(--app-text)' }}>{title}</h4>
        <p style={{ margin: '4px 0 0', color: 'var(--app-text)', fontSize: 13, fontWeight: 700 }}>{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function updateRow(list, rowId, patch) {
  return list.map((row) => (String(row.id) === String(rowId) ? { ...row, ...patch } : row))
}

export default function ProductItemSettingsPage() {
  const navigate = useNavigate()
  const { itemId } = useParams()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [item, setItem] = useState(null)
  const [categories, setCategories] = useState([])
  const [branches, setBranches] = useState([])
  const [form, setForm] = useState(null)
  const initialSection = searchParams.get('section') || 'general'
  const [openSection, setOpenSection] = useState(initialSection)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [itemRes, categoryRes, branchRes] = await Promise.all([
          api(`/api/tenant/menu-items/${itemId}`, { skipBranchHeader: true }),
          api('/api/tenant/categories', { skipBranchHeader: true }),
          api('/api/branches', { skipBranchHeader: true })
        ])
        const found = itemRes?.item || null
        if (!found) {
          setError('Ürün bulunamadı.')
          setLoading(false)
          return
        }
        const nextCategories = (Array.isArray(categoryRes?.categories) ? categoryRes.categories : []).filter((entry) => entry?.isDeleted !== true)
        const nextBranches = (Array.isArray(branchRes?.branches) ? branchRes.branches : []).filter((entry) => entry?.isActive !== false)
        setItem(found)
        setForm(inflateProductForm(found))
        setCategories(nextCategories)
        setBranches(nextBranches)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [itemId])

  const categoryName = useMemo(() => {
    return categories.find((entry) => String(entry.id) === String(form?.categoryId || item?.categoryId || ''))?.name || '-'
  }, [categories, form?.categoryId, item?.categoryId])

  const onSave = async () => {
    if (!form) return
    if (!String(form.name || '').trim()) {
      setError('Ürün adı zorunlu.')
      return
    }
    if (!String(form.categoryId || '').trim()) {
      setError('Ürün kategorisi seçilmelidir.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const response = await api(`/api/tenant/menu-items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(buildProductPayload(form)),
        skipBranchHeader: true
      })
      setItem(response?.item || null)
      setForm(inflateProductForm(response?.item || {}))
      window.dispatchEvent(new CustomEvent('menu_item_updated', { detail: { item: response?.item || null } }))
      setSuccess('Ürün ayarları kaydedildi.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const renderSection = (sectionKey) => {
    if (!form) return null
    if (sectionKey === 'general') {
      return (
        <div className="product-form-grid cols-3">
          <Field label="Ürün Adı"><input className="product-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Ürün Fiyatı"><input className="product-input" type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></Field>
          <Field label="KDV"><input className="product-input" type="number" min="0" step="0.01" value={form.vatRate} onChange={(event) => setForm({ ...form, vatRate: event.target.value })} /></Field>
          <Field label="Paket Fiyatı"><input className="product-input" type="number" min="0" step="0.01" value={form.packagePrice} onChange={(event) => setForm({ ...form, packagePrice: event.target.value })} /></Field>
          <Field label="Ürün Maliyeti"><input className="product-input" type="number" min="0" step="0.01" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} /></Field>
          <Field label="Ürün Kategorisi">
            <select className="product-select" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
              <option value="">Kategori seçin</option>
              {categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Tarif / Açıklama"><textarea className="product-textarea" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          </div>
          <ToggleCard title="Aktif" description="Ürün satış ekranlarında görünsün." checked={!!form.isActive} onChange={(checked) => setForm({ ...form, isActive: checked })} />
          <ToggleCard title="Favori Ürün" description="Hızlı erişim alanlarında öne çıksın." checked={!!form.isFavorite} onChange={(checked) => setForm({ ...form, isFavorite: checked })} />
          <ToggleCard title="Etiket Yazdırma" description="İstenirse etiket yazıcısına gönderilir." checked={!!form.printLabelEnabled} onChange={(checked) => setForm({ ...form, printLabelEnabled: checked })} />
          <div style={{ gridColumn: '1 / -1' }}>
            <BranchAccessField
              label="Şube Görünürlüğü"
              hint="Şube seçmezseniz ürün tüm şubelerde geçerli kabul edilir."
              branches={branches}
              value={form.visibility}
              onChange={(visibility) => setForm({ ...form, visibility })}
              allLabel="Tüm Şubelerde Geçerli"
            />
          </div>
        </div>
      )
    }

    if (sectionKey === 'image') {
      return (
        <div className="product-form-grid cols-2">
          <div className="product-form-grid">
            <Field label="Resim URL"><input className="product-input" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} /></Field>
            <Field label="QR Menü Resim URL"><input className="product-input" value={form.qrImageUrl} onChange={(event) => setForm({ ...form, qrImageUrl: event.target.value })} /></Field>
          </div>
          <div className="product-preview">
            <div>
              <div className="product-preview-thumb">
                {form.imageUrl || form.qrImageUrl ? <img src={form.imageUrl || form.qrImageUrl} alt={form.name || 'Ürün'} /> : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontWeight: 900, color: '#b7791f' }}>{String(form.name || 'Ü').slice(0, 2).toUpperCase()}</div>}
              </div>
              <div style={{ fontWeight: 900, color: 'var(--app-text)' }}>Görsel Önizleme</div>
              <div style={{ color: 'var(--app-text)', marginTop: 6, fontWeight: 700 }}>Dosya yükleme zorunlu değil. URL mantığı korunuyor.</div>
            </div>
          </div>
        </div>
      )
    }

    if (sectionKey === 'stock') {
      return (
        <div className="product-form-grid cols-3">
          <Field label="Mevcut Stok"><input className="product-input" type="number" step="0.01" value={form.stockQty} onChange={(event) => setForm({ ...form, stockQty: event.target.value })} /></Field>
          <Field label="Kritik Stok Uyarısı"><input className="product-input" type="number" step="0.01" value={form.criticalStockQty} onChange={(event) => setForm({ ...form, criticalStockQty: event.target.value })} /></Field>
          <Field label="Stok Birimi">
            <select className="product-select" value={form.stockUnit} onChange={(event) => setForm({ ...form, stockUnit: event.target.value })}>
              {['Adet', 'Kg', 'Gram', 'Litre', 'Paket'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </Field>
          <ToggleCard title="Stok Takibi Aktif" description="Satış yaptıkça stok düşsün." checked={!!form.stockTrackingEnabled} onChange={(checked) => setForm({ ...form, stockTrackingEnabled: checked })} />
          <ToggleCard title="Stok Bitince Satışa Kapat" description="Stok sıfırlandığında satış engellenir." checked={!!form.closeSaleWhenOutOfStock} onChange={(checked) => setForm({ ...form, closeSaleWhenOutOfStock: checked })} />
          <ToggleCard title="Negatif Stok İzni" description="Eksi stokta da satışa devam edilir." checked={!!form.allowNegativeStock} onChange={(checked) => setForm({ ...form, allowNegativeStock: checked })} />
        </div>
      )
    }

    if (sectionKey === 'qr') {
      return (
        <div className="product-form-grid cols-2">
          <ToggleCard title="QR Menüde Göster" description="Ürün dijital menüde yayınlansın." checked={!!form.qrMenuVisible} onChange={(checked) => setForm({ ...form, qrMenuVisible: checked })} />
          <ToggleCard title="QR Menüde Gizle" description="Aynı kayıtla satış aktif kalıp QR menüde gizlenebilir." checked={!form.qrMenuVisible} onChange={(checked) => setForm({ ...form, qrMenuVisible: !checked })} />
          <Field label="QR Ürün Başlığı"><input className="product-input" value={form.qrTitle} onChange={(event) => setForm({ ...form, qrTitle: event.target.value })} /></Field>
          <Field label="QR Açıklaması"><textarea className="product-textarea" value={form.qrDescription} onChange={(event) => setForm({ ...form, qrDescription: event.target.value })} /></Field>
          <Field label="Yabancı Dil Ürün Adı"><input className="product-input" value={form.qrForeignName} onChange={(event) => setForm({ ...form, qrForeignName: event.target.value })} /></Field>
          <Field label="Yabancı Dil Açıklaması"><textarea className="product-textarea" value={form.qrForeignDescription} onChange={(event) => setForm({ ...form, qrForeignDescription: event.target.value })} /></Field>
        </div>
      )
    }

    if (sectionKey === 'portion') {
      return (
        <div className="product-form-grid cols-3">
          <ToggleCard title="Yarım Porsiyon" description="Ürüne yarım porsiyon satışını aç." checked={!!form.halfPortionEnabled} onChange={(checked) => setForm({ ...form, halfPortionEnabled: checked })} />
          <Field label="Yarım Porsiyon Fiyatı"><input className="product-input" type="number" min="0" step="0.01" value={form.halfPortionPrice} onChange={(event) => setForm({ ...form, halfPortionPrice: event.target.value })} /></Field>
          <ToggleCard title="Bir Buçuk Porsiyon" description="1.5 porsiyon satışını aç." checked={!!form.oneAndHalfPortionEnabled} onChange={(checked) => setForm({ ...form, oneAndHalfPortionEnabled: checked })} />
          <Field label="Bir Buçuk Porsiyon Fiyatı"><input className="product-input" type="number" min="0" step="0.01" value={form.oneAndHalfPortionPrice} onChange={(event) => setForm({ ...form, oneAndHalfPortionPrice: event.target.value })} /></Field>
          <ToggleCard title="Tartılabilir Ürün" description="Gramaj veya kilo ile satılabilir." checked={!!form.isWeightBased} onChange={(checked) => setForm({ ...form, isWeightBased: checked })} />
          <Field label="Tartı Birimi">
            <select className="product-select" value={form.weightUnit} onChange={(event) => setForm({ ...form, weightUnit: event.target.value })}>
              {['Gram', 'Kg'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </Field>
        </div>
      )
    }

    if (sectionKey === 'options') {
      return (
        <div className="product-inline-table">
          {(form.optionGroups || []).map((row) => (
            <div key={row.id} className="product-inline-table-row">
              <Field label="Seçenek Grubu"><input className="product-input" value={row.group} onChange={(event) => setForm({ ...form, optionGroups: updateRow(form.optionGroups, row.id, { group: event.target.value }) })} /></Field>
              <Field label="Seçenek Adı"><input className="product-input" value={row.name} onChange={(event) => setForm({ ...form, optionGroups: updateRow(form.optionGroups, row.id, { name: event.target.value }) })} /></Field>
              <Field label="Fiyat Farkı"><input className="product-input" type="number" step="0.01" value={row.priceDiff} onChange={(event) => setForm({ ...form, optionGroups: updateRow(form.optionGroups, row.id, { priceDiff: event.target.value }) })} /></Field>
              <Field label="Listeleme"><input className="product-input" type="number" value={row.sortOrder} onChange={(event) => setForm({ ...form, optionGroups: updateRow(form.optionGroups, row.id, { sortOrder: event.target.value }) })} /></Field>
              <button type="button" className="product-secondary-btn" onClick={() => setForm({ ...form, optionGroups: form.optionGroups.filter((entry) => String(entry.id) !== String(row.id)) })}>Sil</button>
            </div>
          ))}
          <div>
            <button type="button" className="product-dark-btn" onClick={() => setForm({ ...form, optionGroups: [...form.optionGroups, createNewOptionRow()] })}>+ Seçenek Ekle</button>
          </div>
        </div>
      )
    }

    if (sectionKey === 'ingredients') {
      return (
        <div className="product-inline-table">
          {(form.ingredients || []).map((row) => (
            <div key={row.id} className="product-inline-table-row">
              <Field label="Malzeme"><input className="product-input" value={row.name} onChange={(event) => setForm({ ...form, ingredients: updateRow(form.ingredients, row.id, { name: event.target.value }) })} /></Field>
              <Field label="Miktar"><input className="product-input" type="number" step="0.01" value={row.quantity} onChange={(event) => setForm({ ...form, ingredients: updateRow(form.ingredients, row.id, { quantity: event.target.value }) })} /></Field>
              <Field label="Birim"><select className="product-select" value={row.unit} onChange={(event) => setForm({ ...form, ingredients: updateRow(form.ingredients, row.id, { unit: event.target.value }) })}>{['Adet', 'Gram', 'Kg', 'Paket', 'Litre'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></Field>
              <ToggleCard title="Stoktan Düşme" description="Reçete mantığı korunur." checked={!!row.deductFromStock} onChange={(checked) => setForm({ ...form, ingredients: updateRow(form.ingredients, row.id, { deductFromStock: checked }) })} />
              <button type="button" className="product-secondary-btn" onClick={() => setForm({ ...form, ingredients: form.ingredients.filter((entry) => String(entry.id) !== String(row.id)) })}>Sil</button>
            </div>
          ))}
          <div>
            <button type="button" className="product-dark-btn" onClick={() => setForm({ ...form, ingredients: [...form.ingredients, createNewIngredientRow()] })}>+ Malzeme Ekle</button>
          </div>
        </div>
      )
    }

    if (sectionKey === 'barcode') {
      return (
        <div className="product-form-grid cols-3">
          <Field label="Barkod"><input className="product-input" value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} /></Field>
          <Field label="PLU Kodu"><input className="product-input" value={form.pluCode} onChange={(event) => setForm({ ...form, pluCode: event.target.value })} /></Field>
          <Field label="Hızlı Satış Kodu"><input className="product-input" value={form.quickSaleCode} onChange={(event) => setForm({ ...form, quickSaleCode: event.target.value })} /></Field>
          <ToggleCard title="Barkodla Satış Aktif" description="Barkod okutulunca ürün sepete düşsün." checked={!!form.barcodeSaleEnabled} onChange={(checked) => setForm({ ...form, barcodeSaleEnabled: checked })} />
          <ToggleCard title="Terazi Barkodu" description="Gramajlı barkodlar okunabilsin." checked={!!form.scaleBarcodeEnabled} onChange={(checked) => setForm({ ...form, scaleBarcodeEnabled: checked })} />
        </div>
      )
    }

    return (
      <div className="product-form-grid">
        {Array.isArray(form.priceHistory) && form.priceHistory.length > 0 ? form.priceHistory.map((entry) => (
          <div key={entry.id} className="product-inline-table-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div><span style={{ fontSize: 12, color: 'var(--app-text)', fontWeight: 900 }}>Eski Fiyat</span><div style={{ marginTop: 6, fontWeight: 900 }}>{Number(entry.oldPrice || 0).toFixed(2)} TL</div></div>
            <div><span style={{ fontSize: 12, color: 'var(--app-text)', fontWeight: 900 }}>Yeni Fiyat</span><div style={{ marginTop: 6, fontWeight: 900 }}>{Number(entry.newPrice || 0).toFixed(2)} TL</div></div>
            <div><span style={{ fontSize: 12, color: 'var(--app-text)', fontWeight: 900 }}>Tarih</span><div style={{ marginTop: 6, fontWeight: 900 }}>{entry.changedAt ? new Date(entry.changedAt).toLocaleString('tr-TR') : '-'}</div></div>
            <div><span style={{ fontSize: 12, color: 'var(--app-text)', fontWeight: 900 }}>Kullanıcı</span><div style={{ marginTop: 6, fontWeight: 900 }}>{entry.changedByName || '-'}</div></div>
          </div>
        )) : <div style={{ color: 'var(--app-text)', fontWeight: 800 }}>Henüz fiyat değişikliği kaydı yok.</div>}
        <div className="product-card" style={{ padding: 16, color: '#b7791f', background: '#fff8e6', fontWeight: 900 }}>Geçmiş fiyat kayıtları korunur. Eski satış ve rapor geçmişi bozulmaz.</div>
      </div>
    )
  }

  return (
    <div className="page-scroll-area scrollbar-hidden">
      <ProductCatalogStyles />
      <div className="product-catalog-page">
        <div className="product-shell">
          {loading ? <div className="product-panel">Yükleniyor...</div> : null}
          {!loading && error && !form ? <div className="product-panel" style={{ color: '#b42318', fontWeight: 900 }}>{error}</div> : null}
          {!loading && form ? (
            <>
              <section className="product-hero product-settings-sticky">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <button className="product-secondary-btn" onClick={() => navigate('/kermes/settings/catalog/items')}>← Geri</button>
                  <div className="product-thumb">
                    {form.imageUrl ? <img src={form.imageUrl} alt={form.name} /> : <span>{String(form.name || 'Ü').slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 30, lineHeight: 1, fontWeight: 950 }}>{form.name || 'Ürün Ayarları'}</div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="product-chip">{categoryName}</span>
                      <span className="product-chip product-money-chip">{Number(form.price || 0).toFixed(2)} TL</span>
                      <span className="product-chip product-stock-chip">Stok: {Number(form.stockQty || 0)}</span>
                    </div>
                  </div>
                  <button className="product-dark-btn" disabled={saving} onClick={onSave}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
                </div>
                {error ? <div style={{ marginTop: 12, color: '#b42318', fontWeight: 900 }}>{error}</div> : null}
                {success ? <div style={{ marginTop: 12, color: '#0f9d58', fontWeight: 900 }}>{success}</div> : null}
              </section>

              <section className="product-settings-card" style={{ padding: 18 }}>
                <div className="product-form-grid">
                  {PRODUCT_SETTING_GROUPS.map((section) => {
                    const isOpen = openSection === section.key
                    return (
                      <div key={section.key} className="product-settings-section">
                        <button type="button" className={isOpen ? 'open' : ''} onClick={() => setOpenSection(isOpen ? '' : section.key)}>
                          <div style={{ width: 42, height: 42, borderRadius: 14, background: isOpen ? '#f0a126' : '#fff4df', color: isOpen ? '#ffffff' : '#b7791f', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{section.icon}</div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 950 }}>{section.title}</div>
                          </div>
                          <div className="product-chip" style={{ background: isOpen ? 'rgba(255,255,255,0.15)' : '#f3f4f6', color: isOpen ? '#ffffff' : 'var(--app-text)' }}>{isOpen ? 'Kapat' : 'Aç'}</div>
                        </button>
                        {isOpen ? <div className="product-settings-body">{renderSection(section.key)}</div> : null}
                      </div>
                    )
                  })}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
