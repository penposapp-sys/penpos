export const PRODUCT_PLACEHOLDER_SRC = '/images/product-placeholder.png'

export function resolveProductImageUrl(product) {
  const raw = String(
    product?.imageUrl ||
    product?.photoUrl ||
    product?.image ||
    product?.photo ||
    product?.media?.imageUrl ||
    product?.media?.photoUrl ||
    product?.media?.image ||
    ''
  ).trim()

  if (raw && raw.startsWith('http')) return raw
  return PRODUCT_PLACEHOLDER_SRC
}
