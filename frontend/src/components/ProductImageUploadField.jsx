import React, { useEffect, useId, useMemo, useState } from 'react'
import {
  formatProductImageSize,
  PRODUCT_PLACEHOLDER_SRC,
  resolveProductImageUrl,
  validateProductImageFile
} from '../lib/productImage.js'

export default function ProductImageUploadField({
  label = 'Görsel Yükle',
  currentImageUrl = '',
  file = null,
  onFileChange,
  onClearFile,
  onRemoveExisting,
  disabled = false,
  helperText = 'JPG, PNG veya WEBP. Maksimum 1 MB.',
  error = '',
  existingSizeLabel = ''
}) {
  const inputId = useId()
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return undefined
    }
    const nextUrl = URL.createObjectURL(file)
    setPreviewUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])

  const displaySrc = useMemo(() => {
    if (previewUrl) return previewUrl
    if (currentImageUrl) return resolveProductImageUrl({ imageUrl: currentImageUrl })
    return PRODUCT_PLACEHOLDER_SRC
  }, [currentImageUrl, previewUrl])

  const fileSizeLabel = file ? formatProductImageSize(file.size) : existingSizeLabel

  const commitFile = (nextFile) => {
    if (!nextFile) return
    const validationMessage = validateProductImageFile(nextFile)
    onFileChange?.(nextFile, validationMessage)
  }

  return (
    <div className={`product-image-upload${dragActive ? ' is-drag-active' : ''}${disabled ? ' is-disabled' : ''}`}>
      <div className="product-image-upload__head">
        <div>
          <div className="product-image-upload__label">{label}</div>
          <div className="product-image-upload__hint">{helperText}</div>
        </div>
        {fileSizeLabel ? <div className="product-image-upload__size">{fileSizeLabel}</div> : null}
      </div>

      <label
        htmlFor={inputId}
        className="product-image-upload__dropzone"
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragActive(false)
          if (disabled) return
          commitFile(event.dataTransfer?.files?.[0] || null)
        }}
      >
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          style={{ display: 'none' }}
          onChange={(event) => {
            commitFile(event.target.files?.[0] || null)
            event.target.value = ''
          }}
        />
        <div className="product-image-upload__preview">
          <img src={displaySrc} alt="Ürün önizleme" />
        </div>
        <div className="product-image-upload__copy">
          <strong>Dosya seç veya sürükle bırak</strong>
          <span>Ürün kartı görünümü değişmez, sadece görsel dosya olarak saklanır.</span>
        </div>
      </label>

      <div className="product-image-upload__actions">
        <label htmlFor={inputId} className="product-secondary-btn" aria-disabled={disabled ? 'true' : 'false'}>
          Dosya Seç
        </label>
        {file ? (
          <button type="button" className="product-secondary-btn" onClick={() => onClearFile?.()} disabled={disabled}>
            Seçimi Temizle
          </button>
        ) : null}
        {!file && currentImageUrl ? (
          <button type="button" className="product-secondary-btn" onClick={() => onRemoveExisting?.()} disabled={disabled || typeof onRemoveExisting !== 'function'}>
            Görseli Kaldır
          </button>
        ) : null}
      </div>

      {error ? <div className="product-image-upload__error">{error}</div> : null}
    </div>
  )
}
