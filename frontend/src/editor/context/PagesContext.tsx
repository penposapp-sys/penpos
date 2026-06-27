import React, { createContext, useContext, useState } from 'react'

export interface PageItem {
  id: string
  slug: string
  title: string
  isHome: boolean
  data: string
}

function createDefaultPages(initialHomeData = ''): PageItem[] {
  return [
    { id: 'home', slug: '/', title: 'Ana Sayfa', isHome: true, data: initialHomeData },
    { id: 'about', slug: '/hakkimizda', title: 'Hakkimizda', isHome: false, data: '' },
    { id: 'menu', slug: '/menu', title: 'Menu / Urunler', isHome: false, data: '' },
    { id: 'contact', slug: '/iletisim', title: 'Iletisim', isHome: false, data: '' },
  ]
}

const PagesContext = createContext<any>(null)

export function PagesProvider({ children, initialPages = null, initialHomeData = '' }: any) {
  const [pages, setPages] = useState<PageItem[]>(() => {
    if (Array.isArray(initialPages) && initialPages.length > 0) return initialPages
    return createDefaultPages(initialHomeData)
  })
  const [activePageId, setActivePageId] = useState(() => {
    if (Array.isArray(initialPages) && initialPages.length > 0) {
      return initialPages.find((page: PageItem) => page.isHome)?.id || initialPages[0].id
    }
    return 'home'
  })

  const setActivePage = (id: string) => setActivePageId(id)

  const addPage = (page: Omit<PageItem, 'id'>) => {
    const newPage: PageItem = {
      ...page,
      id: `page_${Date.now()}`,
    }
    setPages((current) => [...current, newPage])
    return newPage
  }

  const deletePage = (id: string) => {
    let nextActiveId = activePageId
    setPages((current) => {
      if (current.length <= 1) return current
      const remaining = current.filter((page) => page.id !== id)
      if (activePageId === id) {
        nextActiveId = remaining[0]?.id || 'home'
      }
      return remaining
    })
    if (activePageId === id) {
      setActivePageId(nextActiveId)
    }
    return nextActiveId
  }

  const updatePage = (id: string, updates: Partial<PageItem>) => {
    setPages((current) => current.map((page) => (page.id === id ? { ...page, ...updates } : page)))
  }

  const saveCurrentPageData = (data: string, pageId?: string) => {
    const targetId = pageId || activePageId
    setPages((current) => current.map((page) => (page.id === targetId ? { ...page, data } : page)))
  }

  return (
    <PagesContext.Provider
      value={{
        pages,
        activePageId,
        setActivePage,
        addPage,
        deletePage,
        updatePage,
        saveCurrentPageData,
      }}
    >
      {children}
    </PagesContext.Provider>
  )
}

export function usePages() {
  const context = useContext(PagesContext)
  if (!context) throw new Error('usePages must be used within PagesProvider')
  return context
}
