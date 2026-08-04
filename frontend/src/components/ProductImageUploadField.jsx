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
  compact = false,
  ultraCompact = false
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
  const useCompact = compact || ultraCompact
  const rootStyle = ultraCompact
    ? { gap: 4, padding: 8, borderRadius: 16 }
    : (useCompact ? { gap: 6, padding: 10, borderRadius: 18 } : undefined)
  const dropzoneStyle = ultraCompact
    ? {
        display: 'grid',
        gridTemplateColumns: '72px minmax(0, 1fr)',
        alignItems: 'center',
        justifyItems: 'stretch',
        gap: 10,
        padding: 8,
        borderRadius: 14,
        minHeight: 0,
        textAlign: 'left'
      }
    : useCompact
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
  const previewStyle = ultraCompact
    ? { width: '72px', borderRadius: 12, justifySelf: 'start' }
    : (useCompact ? { width: '120px', borderRadius: 16, justifySelf: 'start' } : undefined)
  const copyStyle = useCompact ? { alignContent: 'center', textAlign: 'left', minWidth: 0 } : undefined
  const strongStyle = ultraCompact
    ? { fontSize: 11, lineHeight: 1.2 }
    : (useCompact ? { fontSize: 12, lineHeight: 1.25 } : undefined)
  const textStyle = ultraCompact
    ? { fontSize: 10, lineHeight: 1.3 }
    : (useCompact ? { fontSize: 11, lineHeight: 1.35 } : undefined)
  const headStyle = ultraCompact ? { alignItems: 'start', gap: 6 } : undefined
  const helperStyle = ultraCompact ? { fontSize: 10, lineHeight: 1.25 } : undefined
  const labelStyle = ultraCompact ? { fontSize: 12 } : undefined
  const actionStyle = ultraCompact ? { minHeight: 32, padding: '0 10px', fontSize: 11, borderRadius: 999 } : undefined

  const commitFile = (nextFile) => {
    if (!nextFile) return
    const validationMessage = validateProductImageFile(nextFile)
    onFileChange?.(nextFile, validationMessage)
  }

  return (
    <div className={`product-image-upload${dragActive ? ' is-drag-active' : ''}${disabled ? ' is-disabled' : ''}`} style={rootStyle}>
      <div className="product-image-upload__head" style={headStyle}>
        <div>
          <div className="product-image-upload__label" style={labelStyle}>{label}</div>
          <div className="product-image-upload__hint" style={helperStyle}>{helperText}</div>
        </div>
        {fileSizeLabel ? <div className="product-image-upload__size" style={helperStyle}>{fileSizeLabel}</div> : null}
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
        <label htmlFor={inputId} className="product-secondary-btn" aria-disabled={disabled ? 'true' : 'false'} style={actionStyle}>
          Dosya Sec
        </label>
        {file ? (
          <button type="button" className="product-secondary-btn" onClick={() => onClearFile?.()} disabled={disabled} style={actionStyle}>
            Secimi Temizle
          </button>
        ) : null}
        {!file && currentImageUrl ? (
          <button type="button" className="product-secondary-btn" onClick={() => onRemoveExisting?.()} disabled={disabled || typeof onRemoveExisting !== 'function'} style={actionStyle}>
            Gorseli Kaldir
          </button>
        ) : null}
      </div>

      {error ? <div className="product-image-upload__error">{error}</div> : null}
    </div>
  )
}
