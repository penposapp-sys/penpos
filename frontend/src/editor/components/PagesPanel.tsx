import React, { useState } from 'react'
import { useEditor } from '@craftjs/core'
import { usePages } from '../context/PagesContext.tsx'
import { Column, Row, Section } from './layout/index.ts'

function createEmptyPageElement() {
  return (
    <Section padding="60px 20px" background="#ffffff">
      <Row gap="20px">
        <Column width="100%" padding="0px" />
      </Row>
    </Section>
  )
}

export function PagesPanel() {
  const { pages, activePageId, setActivePage, addPage, deletePage, saveCurrentPageData } = usePages()
  const { actions, query, rootCanvasId } = useEditor((state) => ({
    rootCanvasId: state.nodes.ROOT?.data?.nodes?.[0] || 'ROOT',
  }))
  const [isAdding, setIsAdding] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newSlug, setNewSlug] = useState('')

  const loadEmptyPage = () => {
    const rootNode = query.node(rootCanvasId).get()
    if (rootNode?.data?.nodes) {
      ;[...rootNode.data.nodes].forEach((childId: string) => actions.delete(childId))
    }
    const nodeTree = query.parseReactElement(createEmptyPageElement()).toNodeTree()
    actions.addNodeTree(nodeTree, rootCanvasId)
    actions.clearEvents()
  }

  const handleSwitchPage = (pageId: string) => {
    saveCurrentPageData(query.serialize())

    const targetPage = pages.find((page) => page.id === pageId)
    setActivePage(pageId)

    if (targetPage?.data) {
      actions.deserialize(targetPage.data)
      actions.clearEvents()
      return
    }

    loadEmptyPage()
  }

  const handleAddPage = () => {
    if (!newTitle.trim() || !newSlug.trim()) {
      alert('Baslik ve URL gerekli!')
      return
    }

    saveCurrentPageData(query.serialize())

    const page = addPage({
      title: newTitle.trim(),
      slug: newSlug.startsWith('/') ? newSlug.trim() : `/${newSlug.trim()}`,
      isHome: false,
      data: '',
    })

    setNewTitle('')
    setNewSlug('')
    setIsAdding(false)
    setActivePage(page.id)
    loadEmptyPage()
  }

  const handleDeletePage = (pageId: string, title: string) => {
    if (!window.confirm(`"${title}" sayfasi silinsin mi?`)) return

    const nextActiveId = deletePage(pageId)
    const fallbackPage = pages.find((page) => page.id === nextActiveId && page.id !== pageId)
    if (fallbackPage?.data) {
      actions.deserialize(fallbackPage.data)
      actions.clearEvents()
      return
    }
    loadEmptyPage()
  }

  return (
    <aside
      style={{
        position: 'sticky',
        top: 12,
        width: '100%',
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 18,
        padding: 15,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 180px)',
        alignSelf: 'start',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: isCollapsed ? 0 : 15 }}>
        <h3 style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Sayfalar</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setIsAdding((current) => !current)}
            aria-label="Sayfa ekle"
            style={{
              background: '#ffffff',
              color: '#111827',
              border: '1px solid #e5e7eb',
              width: 24,
              height: 24,
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 'bold',
              lineHeight: 1,
            }}
          >
            +
          </button>
          <button
            onClick={() => setIsCollapsed((current) => !current)}
            aria-label={isCollapsed ? 'Sayfalari goster' : 'Sayfalari gizle'}
            style={{
              width: 28,
              height: 28,
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: '#111827',
            }}
          >
            <span style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.2s ease' }}>{'>'}</span>
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          {isAdding ? (
            <div
              style={{
                background: 'white',
                padding: 10,
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                marginBottom: 15,
              }}
            >
              <input
                placeholder="Sayfa basligi"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ width: '100%', padding: 8, marginBottom: 6, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
              />
              <input
                placeholder="/url-slug"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                style={{ width: '100%', padding: 8, marginBottom: 6, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4 }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={handleAddPage} style={{ flex: 1, padding: 6, background: '#10b981', color: 'white', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                  Ekle
                </button>
                <button onClick={() => setIsAdding(false)} style={{ flex: 1, padding: 6, background: '#f3f4f6', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                  Iptal
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pages.map((page: any) => (
              <div
                key={page.id}
                onClick={() => handleSwitchPage(page.id)}
                style={{
                  padding: '10px 12px',
                  background: activePageId === page.id ? '#3b82f6' : 'white',
                  color: activePageId === page.id ? 'white' : '#374151',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 13,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid #e5e7eb',
                  transition: 'all 0.2s',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{page.isHome ? 'HOME ' : ''}{page.title}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{page.slug}</div>
                </div>
                {!page.isHome ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      handleDeletePage(page.id, page.title)
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: activePageId === page.id ? 'white' : '#ef4444',
                      cursor: 'pointer',
                      fontSize: 16,
                      padding: 0,
                      width: 20,
                      height: 20,
                    }}
                  >
                    x
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 20,
              padding: 12,
              background: '#fef3c7',
              borderRadius: 10,
              fontSize: 11,
              color: '#92400e',
            }}
          >
            Ipucu: Sayfa degistirdiginizde mevcut duzen otomatik saklanir.
          </div>
        </>
      ) : null}
    </aside>
  )
}
