import React from 'react'
import { useNode } from '@craftjs/core'
import { useRenderData } from '../context/RenderDataContext.jsx'
import { CommonStyleSettings, PanelField, getCommonWrapperStyle, panelInputStyle } from './helpers.jsx'

const mockMenu = [
  { id: 1, name: 'Izgara Kofte', price: 180, description: 'El yapimi kofte', imageUrl: 'https://via.placeholder.com/140?text=Kofte', categoryName: 'Ana Yemek' },
  { id: 2, name: 'Tavuk Sis', price: 160, description: 'Marine edilmis tavuk', imageUrl: 'https://via.placeholder.com/140?text=Tavuk', categoryName: 'Ana Yemek' },
]

export function RestaurantMenu(props) {
  const { menuCategory, showImages, title = 'Menumuz' } = props
  const {
    connectors: { connect, drag },
  } = useNode()
  const renderData = useRenderData()
  const sourceItems = Array.isArray(renderData.menuItems) && renderData.menuItems.length > 0
    ? renderData.menuItems
    : (Array.isArray(renderData.items) && renderData.items.length > 0 ? renderData.items : mockMenu)
  const filteredMenu = sourceItems.filter((item) => menuCategory === 'all' || menuCategory === 'main' || String(item.categoryId || item.categoryName || '').toLowerCase() === String(menuCategory).toLowerCase())
  const visibleItems = filteredMenu.length > 0 ? filteredMenu : sourceItems

  return (
    <section
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      style={getCommonWrapperStyle(props, { padding: props.padding || '40px 20px', maxWidth: props.maxWidth || '900px', margin: props.margin || '0 auto' })}
    >
      <h2 style={{ textAlign: 'center', marginBottom: 30, color: 'var(--secondary-color)' }}>{title}</h2>
      {visibleItems.map((item) => (
        <article
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '15px 0',
            borderBottom: '1px solid #e5e7eb',
            gap: 20,
          }}
        >
          {showImages ? (
            <img
              src={item.imageUrl || item.image || 'https://via.placeholder.com/140?text=Menu'}
              alt={item.name}
              style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 'var(--border-radius)' }}
            />
          ) : null}
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, color: 'var(--secondary-color)' }}>{item.name}</h3>
            <p style={{ margin: '6px 0 0', color: '#6b7280' }}>{item.description || item.categoryName || 'Menu aciklamasi'}</p>
          </div>
          <strong style={{ fontSize: '1.1rem', color: 'var(--primary-color)' }}>
            {Number(item.price || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
          </strong>
        </article>
      ))}
    </section>
  )
}

export function RestaurantMenuSettings({ props, setProp }) {
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
      <PanelField label="Menu Kategorisi">
        <select
          value={props.menuCategory || 'main'}
          onChange={(event) => setProp((draft) => { draft.menuCategory = event.target.value })}
          style={panelInputStyle()}
        >
          <option value="main">Ana Menu</option>
          <option value="all">Tum Kategoriler</option>
          <option value="dessert">Tatlilar</option>
          <option value="drink">Icecekler</option>
        </select>
      </PanelField>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#374151' }}>
        <input
          type="checkbox"
          checked={props.showImages !== false}
          onChange={(event) => setProp((draft) => { draft.showImages = event.target.checked })}
        />
        Gorselleri Goster
      </label>
      <CommonStyleSettings props={props} setProp={setProp} />
    </div>
  )
}

RestaurantMenu.craft = {
  displayName: 'Restoran Menusu',
  props: {
    title: 'Menumuz',
    menuCategory: 'main',
    showImages: true,
    padding: '40px 20px',
    maxWidth: '900px',
    margin: '0 auto',
  },
  related: {
    settings: RestaurantMenuSettings,
  },
}
