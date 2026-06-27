import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageEditor } from '../editor/PageEditor.jsx'
import { api } from '../lib/apiClient.js'

function readLocalDraft(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export default function WebsiteCraftEditorPage({
  systemType = 'kermes',
  storageKey = 'penpos.craftEditor.demo.v1',
  pageId = 'local-demo',
  title = 'Editor hazirlaniyor...',
  backHref = '/',
}) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [initialData, setInitialData] = useState('')
  const [initialTheme, setInitialTheme] = useState(null)
  const [initialPages, setInitialPages] = useState(null)
  const [previewData, setPreviewData] = useState({
    tenantName: '',
    categories: [],
    products: [],
    menuItems: [],
    items: [],
  })

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      const localDraft = readLocalDraft(storageKey)
      if (mounted && localDraft) {
        setInitialData(localDraft.pageData || '')
        setInitialTheme(localDraft.themeConfig || null)
        setInitialPages(Array.isArray(localDraft.pages) ? localDraft.pages : null)
      }

      try {
        const requests = [
          api('/api/tenant/profile', { silent: true, skipBranchHeader: true }),
        ]

        if (systemType === 'kermes') {
          requests.push(api('/api/tenant/categories', { silent: true, skipBranchHeader: true }))
          requests.push(api('/api/tenant/menu-items', { silent: true, skipBranchHeader: true }))
        }

        const [profileRes, categoriesRes, itemsRes] = await Promise.all(requests)

        if (!mounted) return

        const items = Array.isArray(itemsRes?.items) ? itemsRes.items : []
        setPreviewData({
          tenantName: profileRes?.tenant?.name || '',
          categories: Array.isArray(categoriesRes?.categories) ? categoriesRes.categories : [],
          products: items,
          menuItems: items,
          items,
        })
      } catch {}

      if (mounted) setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [storageKey, systemType])

  const handleSave = async (payload) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: 24 }}>
        <div className="card">{title}</div>
      </div>
    )
  }

  return (
    <PageEditor
      initialData={initialData}
      initialTheme={initialTheme}
      initialPages={initialPages}
      previewData={previewData}
      onSaveCallback={handleSave}
      pageId={pageId}
      embedded
      onBack={() => navigate(backHref)}
    />
  )
}
