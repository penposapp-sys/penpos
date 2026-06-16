import React from 'react'

export default function SaleCartLine({
  className = '',
  style,
  infoStyle,
  onInfoClick,
  title,
  badge = null,
  detail,
  actions = null,
  price,
  children = null
}) {
  const clickable = typeof onInfoClick === 'function'

  return (
    <div className={`sale-cart-line ${className}`.trim()} style={style}>
      <div
        className="sale-cart-line__info"
        onClick={clickable ? onInfoClick : undefined}
        style={infoStyle}
      >
        <div className="sale-cart-line__name sale-cart-line__title">{title}</div>
      </div>
      <div className="sale-cart-line__meta">
        {badge}
      </div>
      <div className="sale-cart-line__detail">{detail}</div>
      <div className="sale-cart-line__actions">
        {actions}
      </div>
      <div className="sale-cart-line__price">{price}</div>
      {children}
    </div>
  )
}
