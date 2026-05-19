import React, { useMemo, useState } from 'react'
import { toast } from '../../lib/toast.js'
import {
  WEBSITE_SECTION_TYPES,
  cloneWebsiteSettings,
  createWebsiteSection,
  defaultTenantWebsiteSettings,
  getWebsitePublicUrl,
  moveWebsiteSection,
  normalizeSectionOrder,
  sectionTypeLabel,
} from '../../constants/tenantWebsite.js'

const DEVICE_LABELS = [
  { key: 'desktop', label: 'Masaüstü' },
  { key: 'tablet', label: 'Tablet' },
  { key: 'mobile', label: 'Mobil' },
]

function fieldStyle() {
  return {
    width: '100%',
    minHeight: 44,
    borderRadius: 14,
    border: '1px solid var(--app-border, var(--border))',
    background: 'var(--app-input)',
    color: 'var(--app-text)',
    padding: '10px 12px',
    fontWeight: 700,
  }
}

export function WebsitePreview({ settings, previewData, previewDevice = 'desktop', mode = 'tenant', hostLabel = '' }) {
  const safe = settings || defaultTenantWebsiteSettings
  const sections = Array.isArray(safe.sections) ? [...safe.sections].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)) : []
  const widthClass = previewDevice === 'mobile' ? 'website-preview-shell is-mobile' : previewDevice === 'tablet' ? 'website-preview-shell is-tablet' : 'website-preview-shell'
  const visibleSections = sections.filter((section) => section?.visible !== false)
  const align = String(safe?.layout?.contentAlign || safe?.hero?.align || 'left')
  const previewItems = Array.isArray(previewData?.items) ? previewData.items : []
  const previewCategories = Array.isArray(previewData?.categories) ? previewData.categories : []

  return (
    <div className={widthClass}>
      <div
        className="website-preview-surface"
        style={{
          '--website-bg': safe?.theme?.backgroundColor || '#0f172a',
          '--website-text': safe?.theme?.textColor || '#ffffff',
          '--website-primary': safe?.theme?.primaryColor || '#d9b56f',
          '--website-button': safe?.theme?.buttonColor || '#d9b56f',
          '--website-button-text': safe?.theme?.buttonTextColor || '#111827',
          '--website-card': safe?.theme?.cardColor || 'rgba(255,255,255,0.08)',
          '--website-radius': `${Number(safe?.theme?.borderRadius || 24)}px`,
          '--website-max-width': safe?.layout?.maxWidth || '1180px',
          '--website-font': safe?.theme?.fontFamily || 'Manrope, ui-sans-serif, system-ui, sans-serif',
          '--website-align': align,
          '--website-gap': `${Number(safe?.layout?.sectionSpacing || 32)}px`,
        }}
      >
        <div className="website-public-topbar">
          <div>
            <strong>{safe?.seo?.title || safe?.hero?.title || 'Web Sitesi'}</strong>
            <span>{hostLabel || 'Canlı önizleme'}</span>
          </div>
          <div className={`website-public-status ${safe?.published ? 'is-live' : ''}`}>{safe?.published ? 'Yayında' : 'Taslak'}</div>
        </div>

        {safe?.hero?.visible !== false && (
          <section className="website-public-hero">
            <div className="website-public-hero-copy">
              <div className="website-public-badge">{mode === 'platform' ? 'PenPOS Ana Site' : 'İşletme Sitesi'}</div>
              <h1 style={{ fontSize: Number(safe?.hero?.titleSize || 44) }}>{safe?.hero?.title || 'Başlık'}</h1>
              <p style={{ fontSize: Number(safe?.hero?.subtitleSize || 18) }}>{safe?.hero?.subtitle || 'Açıklama'}</p>
              <div className="website-public-actions">
                <a href={safe?.hero?.buttonLink || '#preview'} onClick={(event) => event.preventDefault()}>{safe?.hero?.buttonText || 'Buton'}</a>
                {safe?.integrations?.showQrMenu && safe?.integrations?.qrMenuUrl ? (
                  <a className="ghost" href={safe.integrations.qrMenuUrl} onClick={(event) => event.preventDefault()}>QR Menüye Git</a>
                ) : null}
              </div>
            </div>
            <div className="website-public-hero-visual">
              {safe?.hero?.coverImageUrl ? (
                <img src={safe.hero.coverImageUrl} alt={safe.hero.title || 'Kapak'} />
              ) : (
                <div className="website-public-hero-placeholder">
                  {safe?.hero?.logoUrl ? <img src={safe.hero.logoUrl} alt="Logo" /> : <span>PenPOS</span>}
                </div>
              )}
            </div>
          </section>
        )}

        <div className="website-public-sections">
          {visibleSections.map((section) => {
            if (section.type === 'hero') return null
            if (section.type === 'products') {
              if (safe?.integrations?.showProducts === false) return null
              return (
                <section key={section.id} className="website-public-section">
                  <div className="website-public-section-head">
                    <div>
                      <h2>{section.title || 'Menü / Ürünler'}</h2>
                      {section.subtitle ? <p>{section.subtitle}</p> : null}
                    </div>
                    {previewCategories.length > 0 ? <span>{previewCategories.length} kategori</span> : null}
                  </div>
                  <div className="website-public-product-grid">
                    {previewItems.slice(0, 8).map((item) => (
                      <article key={item.id} className="website-public-product-card">
                        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <div className="website-public-product-placeholder">Görsel yok</div>}
                        <div className="website-public-product-body">
                          <div className="website-public-product-top">
                            <strong>{item.name}</strong>
                            <span>{Number(item.price || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</span>
                          </div>
                          <p>{item.description || item.categoryName || 'Ürün açıklaması'}</p>
                        </div>
                      </article>
                    ))}
                    {previewItems.length === 0 ? <div className="website-public-empty">Henüz gösterilecek ürün yok.</div> : null}
                  </div>
                </section>
              )
            }
            if (section.type === 'contact') {
              return (
                <section key={section.id} className="website-public-section">
                  <div className="website-public-section-head">
                    <div>
                      <h2>{section.title || 'İletişim'}</h2>
                      {section.subtitle ? <p>{section.subtitle}</p> : null}
                    </div>
                  </div>
                  <div className="website-public-contact-grid">
                    {safe?.contact?.phone ? <div><small>Telefon</small><strong>{safe.contact.phone}</strong></div> : null}
                    {safe?.contact?.whatsapp ? <div><small>WhatsApp</small><strong>{safe.contact.whatsapp}</strong></div> : null}
                    {safe?.contact?.email ? <div><small>E-posta</small><strong>{safe.contact.email}</strong></div> : null}
                    {safe?.contact?.address ? <div><small>Adres</small><strong>{safe.contact.address}</strong></div> : null}
                    {Array.isArray(section?.settings?.items) ? section.settings.items.filter(Boolean).map((item) => (
                      <div key={item.id || item.name}><small>{item.name || 'Ek Kart'}</small><strong>{item.description || ''}</strong></div>
                    )) : null}
                  </div>
                </section>
              )
            }
            if (section.type === 'customText' && section?.settings?.variant === 'featureList') {
              const items = Array.isArray(section?.settings?.items) ? section.settings.items : []
              return (
                <section key={section.id} className="website-public-section">
                  <div className="website-public-section-head">
                    <div>
                      <h2>{section.title || 'Özellikler'}</h2>
                      {section.content ? <p>{section.content}</p> : null}
                    </div>
                  </div>
                  <div className="website-public-feature-grid">
                    {items.map((item) => (
                      <article key={item.id || item.title} className="website-public-feature-card">
                        <strong>{item.title || 'Başlık'}</strong>
                        <p>{item.text || ''}</p>
                      </article>
                    ))}
                  </div>
                </section>
              )
            }
            if (section.type === 'customText' && section?.settings?.variant === 'pricing') {
              const items = Array.isArray(section?.settings?.items) ? section.settings.items : []
              return (
                <section key={section.id} className="website-public-section">
                  <div className="website-public-section-head">
                    <div>
                      <h2>{section.title || 'Paketler / Fiyatlar'}</h2>
                    </div>
                  </div>
                  <div className="website-public-pricing-grid">
                    {items.map((item) => (
                      <article key={item.id || item.name} className={`website-public-pricing-card ${item.popular ? 'is-highlight' : ''}`}>
                        <strong>{item.name || 'Paket'}</strong>
                        <h3>{item.price || 'Özel'}</h3>
                        <p>{item.description || ''}</p>
                      </article>
                    ))}
                  </div>
                </section>
              )
            }
            if (section.type === 'customText' && section?.settings?.variant === 'videos') {
              const items = Array.isArray(section?.settings?.items) ? section.settings.items : []
              return (
                <section key={section.id} className="website-public-section">
                  <div className="website-public-section-head">
                    <div>
                      <h2>{section.title || 'Eğitim Videoları'}</h2>
                    </div>
                  </div>
                  <div className="website-public-video-list">
                    {items.map((item) => (
                      <article key={item.id || item.title} className="website-public-feature-card">
                        <strong>{item.title || 'Video Başlığı'}</strong>
                        <p>{item.description || item.youtubeUrl || ''}</p>
                      </article>
                    ))}
                  </div>
                </section>
              )
            }
            return (
              <section key={section.id} className="website-public-section">
                <div className="website-public-section-head">
                  <div>
                    <h2>{section.title || sectionTypeLabel(section.type)}</h2>
                    {section.subtitle ? <p>{section.subtitle}</p> : null}
                  </div>
                </div>
                <div className="website-public-copy-card">
                  {section?.settings?.imageUrl ? <img src={section.settings.imageUrl} alt={section.title || 'Bölüm görseli'} /> : null}
                  <p>{section.content || 'Bu bölüm için içerik ekleyin.'}</p>
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function WebsiteBuilder({
  mode = 'tenant',
  title,
  subtitle,
  value,
  onChange,
  previewData,
  onSave,
  onPublish,
  onUnpublish,
  loading = false,
  saving = false,
  publishing = false,
  previewPath = '/site',
  showPublishActions = true,
  hostLabel = '',
}) {
  const [selectedSectionId, setSelectedSectionId] = useState(() => (Array.isArray(value?.sections) && value.sections[0]?.id) || 'theme')
  const [previewDevice, setPreviewDevice] = useState('desktop')

  const sections = useMemo(() => normalizeSectionOrder([...(Array.isArray(value?.sections) ? value.sections : [])]), [value?.sections])
  const selectedSection = sections.find((section) => section.id === selectedSectionId) || null
  const siteUrl = getWebsitePublicUrl({ slug: value?.slug, previewPath })

  const setValue = (patch) => onChange({ ...cloneWebsiteSettings(value), ...patch })
  const setNestedValue = (key, patch) => onChange({ ...cloneWebsiteSettings(value), [key]: { ...(value?.[key] || {}), ...patch } })
  const updateSection = (sectionId, patch) => {
    const next = sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section)
    setValue({ sections: normalizeSectionOrder(next) })
  }
  const updateSectionSettings = (sectionId, patch) => {
    const next = sections.map((section) => section.id === sectionId ? { ...section, settings: { ...(section.settings || {}), ...patch } } : section)
    setValue({ sections: normalizeSectionOrder(next) })
  }

  const addSection = (type) => {
    const section = createWebsiteSection(type, sections.length + 1)
    const next = normalizeSectionOrder([...sections, section])
    setValue({ sections: next })
    setSelectedSectionId(section.id)
  }

  const moveSection = (index, direction) => {
    setValue({ sections: moveWebsiteSection(sections, index, direction) })
  }

  const removeSection = (sectionId) => {
    const next = normalizeSectionOrder(sections.filter((section) => section.id !== sectionId))
    setValue({ sections: next })
    setSelectedSectionId(next[0]?.id || 'theme')
  }

  const copySiteUrl = async () => {
    if (!siteUrl) {
      toast.error('Önce site adresi belirlenmeli')
      return
    }
    try {
      await navigator.clipboard.writeText(siteUrl)
      toast.success('Site adresi kopyalandı')
    } catch {
      toast.error('Kopyalama başarısız')
    }
  }

  return (
    <div className="website-builder-page">
      <div className="website-builder-header">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="website-builder-actions">
          <button className="btn" type="button" onClick={copySiteUrl} disabled={!siteUrl}>Site Adresini Kopyala</button>
          <button className="btn" type="button" onClick={() => window.open(siteUrl || `${previewPath}/${value?.slug || ''}`, '_blank', 'noopener,noreferrer')} disabled={!value?.slug}>Önizleme</button>
          <button className="btn btn--primary" type="button" onClick={onSave} disabled={saving || loading}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          {showPublishActions ? <button className="btn" type="button" onClick={onPublish} disabled={publishing || loading}>{publishing ? 'İşleniyor...' : 'Yayına Al'}</button> : null}
          {showPublishActions ? <button className="btn" type="button" onClick={onUnpublish} disabled={publishing || loading}>Yayından Kaldır</button> : null}
        </div>
      </div>

      <div className="website-builder-layout">
        <aside className="website-builder-sidebar">
          <div className="website-builder-panel-title">Bölümler</div>
          <label className="website-builder-field">
            <span>Site adresi</span>
            <input style={fieldStyle()} value={value?.slug || ''} onChange={(event) => setValue({ slug: event.target.value })} placeholder="test-kafe" />
          </label>
          <div className="website-builder-section-list">
            <button type="button" className={`website-builder-section-item ${selectedSectionId === 'theme' ? 'is-active' : ''}`} onClick={() => setSelectedSectionId('theme')}>
              <strong>Tema ve Genel Ayarlar</strong>
              <span>Renkler, SEO, genel görünüm</span>
            </button>
            {sections.map((section, index) => (
              <div key={section.id} className={`website-builder-section-item ${selectedSectionId === section.id ? 'is-active' : ''}`}>
                <button type="button" className="website-builder-section-select" onClick={() => setSelectedSectionId(section.id)}>
                  <strong>{section.title || sectionTypeLabel(section.type)}</strong>
                  <span>{sectionTypeLabel(section.type)}</span>
                </button>
                <div className="website-builder-section-row">
                  <label><input type="checkbox" checked={section.visible !== false} onChange={(event) => updateSection(section.id, { visible: event.target.checked })} /> Görünür</label>
                  <div className="website-builder-mini-actions">
                    <button type="button" onClick={() => moveSection(index, -1)}>↑</button>
                    <button type="button" onClick={() => moveSection(index, 1)}>↓</button>
                    <button type="button" onClick={() => removeSection(section.id)}>×</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="website-builder-add-list">
            {WEBSITE_SECTION_TYPES.map((item) => (
              <button key={item.type} type="button" onClick={() => addSection(item.type)}>+ {item.label}</button>
            ))}
          </div>
        </aside>

        <main className="website-builder-preview-panel">
          <div className="website-builder-preview-head">
            <div className="website-builder-panel-title">Canlı Önizleme</div>
            <div className="website-builder-device-tabs">
              {DEVICE_LABELS.map((item) => (
                <button key={item.key} type="button" className={previewDevice === item.key ? 'is-active' : ''} onClick={() => setPreviewDevice(item.key)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <WebsitePreview settings={value} previewData={previewData} previewDevice={previewDevice} mode={mode} hostLabel={hostLabel || siteUrl} />
        </main>

        <aside className="website-builder-settings-panel">
          <div className="website-builder-panel-title">Ayarlar</div>

          {selectedSectionId === 'theme' ? (
            <div className="website-builder-form">
              <label className="website-builder-field">
                <span>SEO Başlığı</span>
                <input style={fieldStyle()} value={value?.seo?.title || ''} onChange={(event) => setNestedValue('seo', { title: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>SEO Açıklaması</span>
                <textarea style={{ ...fieldStyle(), minHeight: 94 }} value={value?.seo?.description || ''} onChange={(event) => setNestedValue('seo', { description: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>Arka plan rengi</span>
                <input style={fieldStyle()} type="color" value={value?.theme?.backgroundColor || '#0f172a'} onChange={(event) => setNestedValue('theme', { backgroundColor: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>Yazı rengi</span>
                <input style={fieldStyle()} type="color" value={value?.theme?.textColor || '#ffffff'} onChange={(event) => setNestedValue('theme', { textColor: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>Buton rengi</span>
                <input style={fieldStyle()} type="color" value={value?.theme?.buttonColor || '#d9b56f'} onChange={(event) => setNestedValue('theme', { buttonColor: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>Kart rengi</span>
                <input style={fieldStyle()} value={value?.theme?.cardColor || ''} onChange={(event) => setNestedValue('theme', { cardColor: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>Kenar yuvarlaklığı</span>
                <input style={fieldStyle()} type="number" value={Number(value?.theme?.borderRadius || 24)} onChange={(event) => setNestedValue('theme', { borderRadius: Number(event.target.value || 0) })} />
              </label>
              <label className="website-builder-field">
                <span>İçerik hizalama</span>
                <select style={fieldStyle()} value={value?.layout?.contentAlign || 'left'} onChange={(event) => setNestedValue('layout', { contentAlign: event.target.value })}>
                  <option value="left">Sol</option>
                  <option value="center">Orta</option>
                </select>
              </label>
              <label className="website-builder-field website-builder-checkbox">
                <input type="checkbox" checked={value?.integrations?.showProducts !== false} onChange={(event) => setNestedValue('integrations', { showProducts: event.target.checked })} />
                <span>Ürün / Menü bölümünü göster</span>
              </label>
              <label className="website-builder-field website-builder-checkbox">
                <input type="checkbox" checked={!!value?.integrations?.showQrMenu} onChange={(event) => setNestedValue('integrations', { showQrMenu: event.target.checked })} />
                <span>QR Menü bağlantısını göster</span>
              </label>
              <label className="website-builder-field">
                <span>QR Menü linki</span>
                <input style={fieldStyle()} value={value?.integrations?.qrMenuUrl || ''} onChange={(event) => setNestedValue('integrations', { qrMenuUrl: event.target.value })} />
              </label>
              <label className="website-builder-field website-builder-checkbox">
                <input type="checkbox" checked={!!value?.integrations?.showOnlineOrder} onChange={(event) => setNestedValue('integrations', { showOnlineOrder: event.target.checked })} />
                <span>Online sipariş bağlantısını göster</span>
              </label>
              <label className="website-builder-field">
                <span>Online sipariş linki</span>
                <input style={fieldStyle()} value={value?.integrations?.onlineOrderUrl || ''} onChange={(event) => setNestedValue('integrations', { onlineOrderUrl: event.target.value })} />
              </label>
            </div>
          ) : null}

          {selectedSection?.type === 'hero' ? (
            <div className="website-builder-form">
              <label className="website-builder-field">
                <span>Başlık</span>
                <input style={fieldStyle()} value={value?.hero?.title || ''} onChange={(event) => setNestedValue('hero', { title: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>Alt başlık</span>
                <textarea style={{ ...fieldStyle(), minHeight: 94 }} value={value?.hero?.subtitle || ''} onChange={(event) => setNestedValue('hero', { subtitle: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>Logo URL</span>
                <input style={fieldStyle()} value={value?.hero?.logoUrl || ''} onChange={(event) => setNestedValue('hero', { logoUrl: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>Kapak görseli URL</span>
                <input style={fieldStyle()} value={value?.hero?.coverImageUrl || ''} onChange={(event) => setNestedValue('hero', { coverImageUrl: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>Buton metni</span>
                <input style={fieldStyle()} value={value?.hero?.buttonText || ''} onChange={(event) => setNestedValue('hero', { buttonText: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>Buton linki</span>
                <input style={fieldStyle()} value={value?.hero?.buttonLink || ''} onChange={(event) => setNestedValue('hero', { buttonLink: event.target.value })} />
              </label>
            </div>
          ) : null}

          {selectedSection && selectedSectionId !== 'theme' && selectedSection.type !== 'hero' ? (
            <div className="website-builder-form">
              <label className="website-builder-field">
                <span>Bölüm başlığı</span>
                <input style={fieldStyle()} value={selectedSection?.title || ''} onChange={(event) => updateSection(selectedSection.id, { title: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>Alt başlık</span>
                <input style={fieldStyle()} value={selectedSection?.subtitle || ''} onChange={(event) => updateSection(selectedSection.id, { subtitle: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>İçerik</span>
                <textarea style={{ ...fieldStyle(), minHeight: 110 }} value={selectedSection?.content || ''} onChange={(event) => updateSection(selectedSection.id, { content: event.target.value })} />
              </label>
              <label className="website-builder-field">
                <span>Görsel URL</span>
                <input style={fieldStyle()} value={selectedSection?.settings?.imageUrl || ''} onChange={(event) => updateSectionSettings(selectedSection.id, { imageUrl: event.target.value })} />
              </label>
              {selectedSection?.type === 'contact' ? (
                <>
                  <label className="website-builder-field">
                    <span>Telefon</span>
                    <input style={fieldStyle()} value={value?.contact?.phone || ''} onChange={(event) => setNestedValue('contact', { phone: event.target.value })} />
                  </label>
                  <label className="website-builder-field">
                    <span>WhatsApp</span>
                    <input style={fieldStyle()} value={value?.contact?.whatsapp || ''} onChange={(event) => setNestedValue('contact', { whatsapp: event.target.value })} />
                  </label>
                  <label className="website-builder-field">
                    <span>E-posta</span>
                    <input style={fieldStyle()} value={value?.contact?.email || ''} onChange={(event) => setNestedValue('contact', { email: event.target.value })} />
                  </label>
                  <label className="website-builder-field">
                    <span>Adres</span>
                    <textarea style={{ ...fieldStyle(), minHeight: 94 }} value={value?.contact?.address || ''} onChange={(event) => setNestedValue('contact', { address: event.target.value })} />
                  </label>
                </>
              ) : null}
              {Array.isArray(selectedSection?.settings?.items) ? (
                <div className="website-builder-array-editor">
                  <div className="website-builder-array-head">
                    <strong>Liste öğeleri</strong>
                    <button
                      type="button"
                      onClick={() => updateSectionSettings(selectedSection.id, {
                        items: [...(selectedSection?.settings?.items || []), { id: `item-${Date.now()}`, title: '', text: '', description: '', name: '' }],
                      })}
                    >
                      + Ekle
                    </button>
                  </div>
                  {(selectedSection?.settings?.items || []).map((item, index) => (
                    <div key={item.id || `${selectedSection.id}-${index}`} className="website-builder-array-card">
                      <input style={fieldStyle()} placeholder="Başlık" value={item.title || item.name || ''} onChange={(event) => {
                        const items = [...selectedSection.settings.items]
                        items[index] = { ...items[index], title: event.target.value, name: event.target.value }
                        updateSectionSettings(selectedSection.id, { items })
                      }} />
                      <textarea style={{ ...fieldStyle(), minHeight: 76 }} placeholder="Açıklama" value={item.text || item.description || ''} onChange={(event) => {
                        const items = [...selectedSection.settings.items]
                        items[index] = { ...items[index], text: event.target.value, description: event.target.value }
                        updateSectionSettings(selectedSection.id, { items })
                      }} />
                      <button type="button" onClick={() => {
                        const items = [...selectedSection.settings.items].filter((_, itemIndex) => itemIndex !== index)
                        updateSectionSettings(selectedSection.id, { items })
                      }}>
                        Sil
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
