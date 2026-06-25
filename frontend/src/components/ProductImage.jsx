import React, { useEffect, useMemo, useState } from 'react'
import { PRODUCT_PLACEHOLDER_SRC, resolveProductImageUrl } from '../lib/productImage.js'
import { isProductImagesDisabled } from '../lib/perfDebug.js'

const failedImageSources = new Set()

export default function ProductImage({
  product,
  src,
  alt,
  className,
  style,
  width,
  height,
  loading = 'lazy',
  fallbackText = '',
  fallbackClassName = ''
}) {
  const [failed, setFailed] = useState(false)
  const disableImages = isProductImagesDisabled()
  const baseSource = useMemo(() => {
    return src && String(src).trim()
      ? resolveProductImageUrl({ imageUrl: src })
      : resolveProductImageUrl(product)
  }, [product, src])
  const hasFailedSource = baseSource ? failedImageSources.has(baseSource) : false

  useEffect(() => {
    setFailed(false)
  }, [baseSource])

  const resolved = useMemo(() => {
    if (disableImages) return PRODUCT_PLACEHOLDER_SRC
    if (failed || hasFailedSource) return PRODUCT_PLACEHOLDER_SRC
    return baseSource
  }, [baseSource, disableImages, failed, hasFailedSource])

  const shouldRenderTextFallback = Boolean(fallbackText) && (failed || hasFailedSource || !baseSource || baseSource === PRODUCT_PLACEHOLDER_SRC)

  if (shouldRenderTextFallback) {
    return (
      <div
        className={[className, fallbackClassName].filter(Boolean).join(' ')}
        style={style}
        aria-label={alt || String(product?.name || product?.productName || 'Urun')}
      >
        {fallbackText}
      </div>
    )
  }

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
        if (baseSource) failedImageSources.add(baseSource)
        setFailed(true)
        e.currentTarget.src = PRODUCT_PLACEHOLDER_SRC
      }}
      style={style}
    />
  )
}
