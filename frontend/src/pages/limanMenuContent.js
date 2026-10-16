export function applyLimanMenuContent(categories, items, qrMenu = {}) {
  const categoryOrder = Array.isArray(qrMenu.categoryOrder)
    ? qrMenu.categoryOrder.map((id) => String(id))
    : []
  const hiddenCategoryIds = new Set(
    Array.isArray(qrMenu.hiddenCategoryIds)
      ? qrMenu.hiddenCategoryIds.map((id) => String(id))
      : []
  )
  const configuredOrder = new Map(categoryOrder.map((id, index) => [id, index]))

  const visibleCategories = (Array.isArray(categories) ? categories : [])
    .map((category) => ({
      ...category,
      id: String(category?.id || category?._id || '').trim(),
      name: String(category?.name || category?.title || '').trim()
    }))
    .filter((category) => category.id && category.name && !hiddenCategoryIds.has(category.id))
    .sort((left, right) => {
      const leftOrder = configuredOrder.get(left.id)
      const rightOrder = configuredOrder.get(right.id)
      if (leftOrder !== undefined || rightOrder !== undefined) {
        if (leftOrder === undefined) return 1
        if (rightOrder === undefined) return -1
        if (leftOrder !== rightOrder) return leftOrder - rightOrder
      }
      return Number(left.sortOrder || 0) - Number(right.sortOrder || 0)
    })

  const categoryNames = new Map(visibleCategories.map((category) => [category.id, category.name]))
  const visibleCategoryIds = new Set(categoryNames.keys())
  const visibleItems = (Array.isArray(items) ? items : [])
    .filter((item) => visibleCategoryIds.has(String(item?.categoryId || '')))
    .map((item) => ({
      ...item,
      categoryName: categoryNames.get(String(item.categoryId))
    }))

  return { categories: visibleCategories, items: visibleItems }
}

export function normalizeLimanMenuText(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
}
