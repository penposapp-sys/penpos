export const getTsplLabelText = (content, quickSaleTableName = '') => {
  const lines = String(content || '').split(/\r?\n/g).map((line) => line.trim()).filter(Boolean)
  const tableName = String(quickSaleTableName || '').trim()
  return {
    top: lines[0] || '',
    subtitle: tableName ? `MASA: ${tableName}` : '',
    product: lines[1] || '-',
    amount: lines[2] || '1 ADET',
    note: lines[3] || ''
  }
}
