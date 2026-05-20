import React, { memo } from 'react'
import ProductImage from './ProductImage.jsx'

function ProductCard({ item, disabled = false, onClick }) {
  const price = item?.price
  const isWeightBased = !!item?.isWeightBased
  const name = item?.name

  return (
    <div
      className="card productCard productCard--photo"
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
      <ProductImage
        className="productCard__img"
        product={item}
        alt={String(name || '')}
        width={96}
        height={96}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div className="productCard__overlay" />
      <div className="productCard__content">
        <div className="productCard__name">{name}</div>
        <div className="productCard__price">{price} TL{isWeightBased ? '/KG' : ''}</div>
      </div>
    </div>
  )
}

export default memo(ProductCard, (prev, next) => {
  const prevItem = prev?.item || {}
  const nextItem = next?.item || {}
  return (
    prev.disabled === next.disabled &&
    String(prevItem?.id || prevItem?._id || '') === String(nextItem?.id || nextItem?._id || '') &&
    String(prevItem?.name || '') === String(nextItem?.name || '') &&
    String(prevItem?.imageUrl || '') === String(nextItem?.imageUrl || '') &&
    Number(prevItem?.price || 0) === Number(nextItem?.price || 0) &&
    Boolean(prevItem?.isWeightBased) === Boolean(nextItem?.isWeightBased)
  )
})
