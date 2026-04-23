import React, { useMemo } from 'react'

const pickImageUrl = (item) => {
  if (!item) return ''
  const direct = item.imageUrl || item.photoUrl || item.image || item.photo
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  const nested = item.media?.imageUrl || item.media?.photoUrl || item.media?.image
  if (typeof nested === 'string' && nested.trim()) return nested.trim()
  return ''
}

export default function ProductCard({ item, disabled = false, onClick }) {
  const imageUrl = useMemo(() => pickImageUrl(item), [item])
  const hasImage = !!imageUrl
  const price = item?.price
  const isWeightBased = !!item?.isWeightBased
  const name = item?.name

  return (
    <div
      className={hasImage ? 'card productCard productCard--photo' : 'card productCard'}
      data-disabled={disabled ? 'true' : 'false'}
      onClick={() => {
        if (disabled) return
        if (typeof onClick === 'function') onClick(item)
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled ? 'true' : 'false'}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        if (typeof onClick === 'function') onClick(item)
      }}
    >
      {hasImage && (
        <img
          className="productCard__img"
          src={imageUrl}
          alt={String(name || '')}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      )}
      <div className="productCard__overlay" />
      <div className="productCard__content">
        <div className="productCard__name">{name}</div>
        <div className="productCard__price">{price} TL{isWeightBased ? '/KG' : ''}</div>
      </div>
    </div>
  )
}
