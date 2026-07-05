import React, { useEffect, useId, useMemo, useState } from 'react'
import {
  formatProductImageSize,
  PRODUCT_PLACEHOLDER_SRC,
  resolveProductImageUrl,
  validateProductImageFile
} from '../lib/productImage.js'

export default function ProductImageUploadField({
  label = 'Gorsel Yukle',
  currentImageUrl = '',
  file = null,
  onFileChange,
  onClearFile,
  onRemoveExisting,
  disabled = false,
  helperText = 'JPG, PNG, WEBP, AVIF veya HEIC/HEIF. Maksimum 5 MB, otomatik olarak 800x800 WebP optimize edilir.',
  descriptionText = 'Yuklenen gorsel ilgili alanda gosterilmek uzere kaydedilir.',
  error = '',
  existingSizeLabel = '',
  compact = false
}) {
  const inputId = useId()
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewFailed, setPreviewFailed] = useState(false)

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

  useEffect(() => {
    setPreviewFailed(false)
  }, [displaySrc])

  const fileSizeLabel = file ? formatProductImageSize(file.size) : existingSizeLabel
  const previewSrc = previewFailed ? PRODUCT_PLACEHOLDER_SRC : displaySrc
  const rootStyle = compact ? { gap: 6, padding: 10, borderRadius: 18 } : undefined
  const dropzoneStyle = compact
    ? {
        display: 'grid',
        gridTemplateColumns: '120px minmax(0, 1fr)',
        alignItems: 'center',
        justifyItems: 'stretch',
        gap: 12,
        padding: 10,
        borderRadius: 16,
        minHeight: 0,
        textAlign: 'left'
      }
    : undefined
  const previewStyle = compact ? { width: '120px', borderRadius: 16, justifySelf: 'start' } : undefined
  const copyStyle = compact ? { alignContent: 'center', textAlign: 'left', minWidth: 0 } : undefined
  const strongStyle = compact ? { fontSize: 12, lineHeight: 1.25 } : undefined
  const textStyle = compact ? { fontSize: 11, lineHeight: 1.35 } : undefined

  const commitFile = (nextFile) => {
    if (!nextFile) return
    const validationMessage = validateProductImageFile(nextFile)
    onFileChange?.(nextFile, validationMessage)
  }

  return (
    <div className={`product-image-upload${dragActive ? ' is-drag-active' : ''}${disabled ? ' is-disabled' : ''}`} style={rootStyle}>
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
        style={dropzoneStyle}
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
          accept="image/jpeg,image/jpg,image/pjpeg,image/png,image/x-png,image/webp,image/avif,image/heic,image/heif,.heic,.heif,.avif"
          disabled={disabled}
          style={{ display: 'none' }}
          onChange={(event) => {
            commitFile(event.target.files?.[0] || null)
            event.target.value = ''
          }}
        />
        <div className="product-image-upload__preview" style={previewStyle}>
          <img
            src={previewSrc}
            alt="Urun onizleme"
            onError={(event) => {
              if (event.currentTarget.src.endsWith(PRODUCT_PLACEHOLDER_SRC)) return
              setPreviewFailed(true)
              event.currentTarget.src = PRODUCT_PLACEHOLDER_SRC
            }}
          />
        </div>
        <div className="product-image-upload__copy" style={copyStyle}>
          <strong style={strongStyle}>Dosya sec veya surukle birak</strong>
          <span style={textStyle}>{descriptionText}</span>
        </div>
      </label>

      <div className="product-image-upload__actions">
        <label htmlFor={inputId} className="product-secondary-btn" aria-disabled={disabled ? 'true' : 'false'}>
          Dosya Sec
        </label>
        {file ? (
          <button type="button" className="product-secondary-btn" onClick={() => onClearFile?.()} disabled={disabled}>
            Secimi Temizle
          </button>
        ) : null}
        {!file && currentImageUrl ? (
          <button type="button" className="product-secondary-btn" onClick={() => onRemoveExisting?.()} disabled={disabled || typeof onRemoveExisting !== 'function'}>
            Gorseli Kaldir
          </button>
        ) : null}
      </div>

      {error ? <div className="product-image-upload__error">{error}</div> : null}
    </div>
  )
}
