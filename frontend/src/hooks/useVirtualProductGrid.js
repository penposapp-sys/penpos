import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const DEFAULT_MIN_CARD_WIDTH = 116
const DEFAULT_GRID_GAP = 8
const DEFAULT_ROW_HEIGHT = 150
const DEFAULT_BUFFER_ROWS = 3

export function useVirtualProductGrid({
  items,
  enabled,
  minCardWidth = DEFAULT_MIN_CARD_WIDTH,
  gridGap = DEFAULT_GRID_GAP,
  estimatedRowHeight = DEFAULT_ROW_HEIGHT,
  bufferRows = DEFAULT_BUFFER_ROWS,
  resetDeps = []
}) {
  const containerRef = useRef(null)
  const gridMeasureRef = useRef(null)
  const cardMeasureRef = useRef(null)
  const scrollRafRef = useRef(null)
  const pendingScrollTopRef = useRef(0)
  const [viewport, setViewport] = useState({
    scrollTop: 0,
    height: 0,
    width: 0,
    rowHeight: estimatedRowHeight
  })

  useEffect(() => {
    if (!enabled) return undefined
    const updateMetrics = () => {
      const container = containerRef.current
      const grid = gridMeasureRef.current
      const card = cardMeasureRef.current
      const nextHeight = Math.max(0, Number(container?.clientHeight || 0))
      const nextWidth = Math.max(0, Number(grid?.clientWidth || container?.clientWidth || 0))
      const measuredCardHeight = Math.max(0, Number(card?.offsetHeight || 0))
      const nextRowHeight = measuredCardHeight > 0
        ? measuredCardHeight + gridGap
        : estimatedRowHeight
      setViewport((prev) => {
        if (
          prev.height === nextHeight &&
          prev.width === nextWidth &&
          prev.rowHeight === nextRowHeight
        ) return prev
        return { ...prev, height: nextHeight, width: nextWidth, rowHeight: nextRowHeight }
      })
    }

    updateMetrics()
    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => updateMetrics())
      : null
    if (resizeObserver && containerRef.current) resizeObserver.observe(containerRef.current)
    if (resizeObserver && gridMeasureRef.current) resizeObserver.observe(gridMeasureRef.current)
    if (resizeObserver && cardMeasureRef.current) resizeObserver.observe(cardMeasureRef.current)
    window.addEventListener('resize', updateMetrics)
    return () => {
      window.removeEventListener('resize', updateMetrics)
      try { resizeObserver?.disconnect() } catch {}
    }
  }, [enabled, estimatedRowHeight, gridGap, items])

  useEffect(() => () => {
    try {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    } catch {}
  }, [])

  const handleScroll = useCallback((event) => {
    if (!enabled) return
    pendingScrollTopRef.current = Number(event?.currentTarget?.scrollTop || 0)
    if (scrollRafRef.current) return
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null
      const nextScrollTop = pendingScrollTopRef.current
      setViewport((prev) => (
        prev.scrollTop === nextScrollTop
          ? prev
          : { ...prev, scrollTop: nextScrollTop }
      ))
    })
  }, [enabled])

  const resetKey = JSON.stringify(resetDeps)
  useEffect(() => {
    if (!enabled) return
    pendingScrollTopRef.current = 0
    setViewport((prev) => (prev.scrollTop === 0 ? prev : { ...prev, scrollTop: 0 }))
    try {
      if (containerRef.current) containerRef.current.scrollTop = 0
    } catch {}
  }, [enabled, resetKey])

  const virtual = useMemo(() => {
    if (!enabled) return null
    const gridWidth = Math.max(1, Number(viewport.width || 0))
    const columns = Math.max(1, Math.floor((gridWidth + gridGap) / (minCardWidth + gridGap)))
    const rowHeight = Math.max(1, Number(viewport.rowHeight || estimatedRowHeight))
    const totalRows = Math.ceil(items.length / columns)
    const viewportRows = Math.max(1, Math.ceil((Number(viewport.height || 0) || rowHeight) / rowHeight))
    const startRow = Math.max(0, Math.floor(Number(viewport.scrollTop || 0) / rowHeight) - bufferRows)
    const endRow = Math.min(totalRows, startRow + viewportRows + (bufferRows * 2))
    const startIndex = startRow * columns
    const endIndex = Math.min(items.length, endRow * columns)
    return {
      columns,
      rowHeight,
      totalRows,
      startIndex,
      endIndex,
      topSpacer: startRow * rowHeight,
      bottomSpacer: Math.max(0, (totalRows - endRow) * rowHeight)
    }
  }, [bufferRows, enabled, estimatedRowHeight, gridGap, items, minCardWidth, viewport])

  const visibleItems = useMemo(() => {
    if (!enabled || !virtual) return items
    return items.slice(virtual.startIndex, virtual.endIndex)
  }, [enabled, items, virtual])

  return {
    containerRef,
    gridMeasureRef,
    cardMeasureRef,
    handleScroll,
    visibleItems,
    topSpacer: enabled && virtual ? virtual.topSpacer : 0,
    bottomSpacer: enabled && virtual ? virtual.bottomSpacer : 0,
    isVirtualized: enabled
  }
}

export default useVirtualProductGrid
