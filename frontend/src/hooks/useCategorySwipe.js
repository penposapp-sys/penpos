import { useCallback, useRef } from 'react'

const categoryId = (category) => String(category?.id ?? category?._id ?? '')

export const getAdjacentCategoryId = (categories, activeCategoryId, direction, showAllCategories = false) => {
  const ids = (Array.isArray(categories) ? categories : [])
    .map(categoryId)
    .filter(Boolean)
  const options = showAllCategories ? ['', ...ids] : ids
  const currentIndex = options.indexOf(String(activeCategoryId ?? ''))
  const nextIndex = currentIndex + Math.sign(direction)

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= options.length) return null
  return options[nextIndex]
}

export const getCategorySwipeDirection = (start, end, threshold = 48) => {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return 0
  return deltaX < 0 ? 1 : -1
}

export function useCategorySwipe({ categories, activeCategoryId, onSelect, showAllCategories = false }) {
  const touchStartRef = useRef(null)
  const suppressClickRef = useRef(null)

  const onTouchStart = useCallback((event) => {
    if (event.touches.length !== 1) {
      touchStartRef.current = null
      return
    }
    touchStartRef.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    }
  }, [])

  const onTouchEnd = useCallback((event) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    const touch = event.changedTouches[0]
    if (!start || !touch) return

    const direction = getCategorySwipeDirection(
      start,
      { x: touch.clientX, y: touch.clientY },
    )
    if (!direction) return

    suppressClickRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      expiresAt: Date.now() + 500,
    }
    const nextCategoryId = getAdjacentCategoryId(
      categories,
      activeCategoryId,
      direction,
      showAllCategories,
    )
    if (nextCategoryId !== null) onSelect?.(nextCategoryId)
  }, [activeCategoryId, categories, onSelect, showAllCategories])

  const onTouchCancel = useCallback(() => {
    touchStartRef.current = null
  }, [])

  const onClickCapture = useCallback((event) => {
    const pendingClick = suppressClickRef.current
    if (!pendingClick) return
    if (Date.now() > pendingClick.expiresAt) {
      suppressClickRef.current = null
      return
    }

    const isSwipeClick = event.nativeEvent.detail > 0
      && Math.abs(event.clientX - pendingClick.x) < 40
      && Math.abs(event.clientY - pendingClick.y) < 40
    if (!isSwipeClick) return

    suppressClickRef.current = null
    event.preventDefault()
    event.stopPropagation()
  }, [])

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    onClickCapture,
  }
}
