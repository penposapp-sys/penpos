import React, { useEffect, useMemo, useState } from 'react'
import { PRODUCT_PLACEHOLDER_SRC, resolveProductImageUrl } from '../lib/productImage.js'
import { isProductImagesDisabled } from '../lib/perfDebug.js'

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
  const disableImages = isProductImagesDisabled()
  const baseSource = useMemo(() => {
    return src && String(src).trim()
      ? resolveProductImageUrl({ imageUrl: src })
      : resolveProductImageUrl(product)
  }, [product, src])

  useEffect(() => {
    setFailed(false)
  }, [baseSource])

  const resolved = useMemo(() => {
    if (disableImages || failed) return PRODUCT_PLACEHOLDER_SRC
    return baseSource
  }, [baseSource, disableImages, failed])

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
