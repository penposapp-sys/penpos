import React from 'react'
import { useNode } from '@craftjs/core'
import { useRenderData } from '../context/RenderDataContext.jsx'
import { CommonStyleSettings, PanelField, clampNumber, getCommonWrapperStyle, panelInputStyle } from './helpers.jsx'

const mockProducts = [
  { id: 1, name: 'Urun 1', price: 99.99, imageUrl: 'https://via.placeholder.com/300x220?text=Urun+1', categoryName: 'Genel' },
  { id: 2, name: 'Urun 2', price: 149.99, imageUrl: 'https://via.placeholder.com/300x220?text=Urun+2', categoryName: 'Genel' },
  { id: 3, name: 'Urun 3', price: 199.99, imageUrl: 'https://via.placeholder.com/300x220?text=Urun+3', categoryName: 'Genel' },
]

export function ProductGrid(props) {
  const { columns, category, showPrices, title = 'One Cikan Urunler' } = props
  const {
    connectors: { connect, drag },
  } = useNode()
  const renderData = useRenderData()
  const sourceItems = Array.isArray(renderData.products) && renderData.products.length > 0
    ? renderData.products
    : (Array.isArray(renderData.items) && renderData.items.length > 0 ? renderData.items : mockProducts)
  const filteredProducts = sourceItems.filter((product) => category === 'all' || String(product.categoryId || product.categoryName || '').toLowerCase() === String(category).toLowerCase())
  const visibleProducts = filteredProducts.length > 0 ? filteredProducts : sourceItems

  return (
    <section
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      style={getCommonWrapperStyle(props, { padding: props.padding || '40px 20px' })}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--secondary-color)' }}>{title}</h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${clampNumber(columns, 3, 1, 4)}, minmax(0, 1fr))`,
            gap: 20,
          }}
        >
          {visibleProducts.map((product) => (
            <article
              key={product.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 'var(--border-radius)',
                padding: 15,
                textAlign: 'center',
                background: '#fff',
                overflow: 'hidden',
              }}
            >
              <img
                src={product.imageUrl || product.image || 'https://via.placeholder.com/300x220?text=Urun'}
                alt={product.name}
                style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 'calc(var(--border-radius) - 2px)' }}
              />
              <h3 style={{ margin: '12px 0 8px', color: 'var(--secondary-color)' }}>{product.name}</h3>
              {showPrices ? (
                <p style={{ color: 'var(--primary-color)', fontWeight: 800, margin: 0 }}>
                  {Number(product.price || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ProductGridSettings({ props, setProp }) {
  return (
    <div style={{ padding: 10 }}>
      <PanelField label="Baslik">
        <input
          type="text"
          value={props.title || ''}
          onChange={(event) => setProp((draft) => { draft.title = event.target.value })}
          style={panelInputStyle()}
        />
      </PanelField>
      <PanelField label="Kategori">
        <select
          value={props.category || 'all'}
          onChange={(event) => setProp((draft) => { draft.category = event.target.value })}
          style={panelInputStyle()}
        >
          <option value="all">Tumu</option>
          <option value="electronics">Elektronik</option>
          <option value="clothing">Giyim</option>
        </select>
      </PanelField>
      <PanelField label="Sutun Sayisi">
        <input
          type="number"
          min="1"
          max="4"
          value={props.columns || 3}
          onChange={(event) => setProp((draft) => { draft.columns = clampNumber(event.target.value, 3, 1, 4) })}
          style={panelInputStyle()}
        />
      </PanelField>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#374151' }}>
        <input
          type="checkbox"
          checked={props.showPrices !== false}
          onChange={(event) => setProp((draft) => { draft.showPrices = event.target.checked })}
        />
        Fiyatlari Goster
      </label>
      <CommonStyleSettings props={props} setProp={setProp} />
    </div>
  )
}

ProductGrid.craft = {
  displayName: 'Urun Izgarasi',
  props: {
    title: 'One Cikan Urunler',
    columns: 3,
    category: 'all',
    showPrices: true,
    padding: '40px 20px',
  },
  related: {
    settings: ProductGridSettings,
  },
}
