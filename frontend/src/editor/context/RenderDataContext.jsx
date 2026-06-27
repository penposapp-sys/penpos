import React, { createContext, useContext } from 'react'

const RenderDataContext = createContext({
  tenantName: '',
  categories: [],
  products: [],
  items: [],
  menuItems: [],
})

export function RenderDataProvider({ children, value = null }) {
  const safeValue = {
    tenantName: '',
    categories: [],
    products: [],
    items: [],
    menuItems: [],
    ...(value || {}),
  }

  return (
    <RenderDataContext.Provider value={safeValue}>
      {children}
    </RenderDataContext.Provider>
  )
}

export function useRenderData() {
  return useContext(RenderDataContext)
}
