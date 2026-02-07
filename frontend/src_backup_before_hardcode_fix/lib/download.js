export const downloadBlob = (blob, filename) => {
  const safeName = String(filename || '').trim() || 'rapor.xlsx'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url)
    } catch {
    }
  }, 1500)
}

