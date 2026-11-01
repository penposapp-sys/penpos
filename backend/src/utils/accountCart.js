export const normalizeAccountCartQuantity = ({ isWeightBased, qty, weightGrams }) => {
  if (isWeightBased) {
    const grams = Math.round(Number(weightGrams))
    if (!Number.isFinite(grams) || grams <= 0) return null
    return { qty: grams / 1000, weightGrams: grams }
  }

  const quantity = Number(qty)
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  return { qty: quantity, weightGrams: null }
}
