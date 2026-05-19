import React, { useState } from 'react'
import { PRODUCT_PLACEHOLDER_SRC, resolveProductImageUrl } from '../lib/productImage.js'

export default function ProductImage({
  product,
  src,
  alt,
  className,
  style,
  width,
  height,
  loading = 'lazy'
}) {
  const [failed, setFailed] = useState(false)
  const resolved = failed
    ? PRODUCT_PLACEHOLDER_SRC
    : (src && String(src).trim() ? resolveProductImageUrl({ imageUrl: src }) : resolveProductImageUrl(product))

  return (
    <img
      className={className}
      src={resolved}
      alt={alt || String(product?.name || product?.productName || 'Urun')}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      onError={(e) => {
        if (e.currentTarget.src.endsWith(PRODUCT_PLACEHOLDER_SRC)) return
        setFailed(true)
        e.currentTarget.src = PRODUCT_PLACEHOLDER_SRC
      }}
      style={style}
    />
  )
}
