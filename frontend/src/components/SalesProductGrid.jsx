import React, { memo } from 'react'
import ProductCard from './ProductCard.jsx'

function SalesProductGrid({
  visibleItems = [],
  onItemClick,
  isMobilePortrait = false,
  productCardMeasureRef = null,
  showProductImages = true
}) {
  return (
    <>
      {visibleItems.map((item, index) => (
        <ProductCard
          key={item.id}
          item={item}
          onClick={onItemClick}
          measureRef={isMobilePortrait && index === 0 ? productCardMeasureRef : null}
          showImage={showProductImages}
        />
      ))}
    </>
  )
}

export default memo(SalesProductGrid, (prev, next) => (
  prev.visibleItems === next.visibleItems &&
  prev.onItemClick === next.onItemClick &&
  prev.isMobilePortrait === next.isMobilePortrait &&
  prev.productCardMeasureRef === next.productCardMeasureRef &&
  prev.showProductImages === next.showProductImages
))
