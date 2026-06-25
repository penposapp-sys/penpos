import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/apiClient.js'
import { WebsitePreview } from '../components/website/WebsiteBuilder.jsx'

function getHostSlug() {
  const host = String(window.location?.hostname || '').trim().toLowerCase()
  if (!host || host === 'localhost' || host === '127.0.0.1') return ''
  if (!host.endsWith('.penpos.cloud')) return ''
  return host.replace(/\.penpos\.cloud$/, '')
}

function TenantPreviewScreen({ payload }) {
  useEffect(() => {
    document.title = payload?.settings?.seo?.title || payload?.tenant?.name || 'PenPOS'
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) metaDescription.setAttribute('content', payload?.settings?.seo?.description || payload?.tenant?.name || '')
  }, [payload])

  return (
    <div className="website-public-page">
      <WebsitePreview
        settings={payload?.settings}
        previewData={payload?.data}
        previewDevice="desktop"
        mode="tenant"
        hostLabel={payload?.tenant?.slug ? `${payload.tenant.slug}.penpos.cloud` : ''}
      />
    </div>
  )
}

export function RootPublicEntryPage({ fallback = null }) {
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(false)
  const hostSlug = getHostSlug()

  useEffect(() => {
    let mounted = true

    const load = async () => {
      if (!hostSlug) return
      setLoading(true)
      const res = await api(`/api/public/site-by-host?host=${encodeURIComponent(String(window.location?.hostname || ''))}`, {
        silent: true,
        skipBranchHeader: true,
      })

      if (!mounted) return
      if (res?.kind === 'tenant') setPayload(res)
      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [hostSlug])

  if (!hostSlug) return fallback

  if (loading && !payload) return null
  if (!payload) return null

  return <TenantPreviewScreen payload={payload} />
}

export default function PublicTenantWebsitePage() {
  const { slug } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError('')
      const res = await api(`/api/public/sites/${encodeURIComponent(String(slug || ''))}`, {
        silent: true,
        skipBranchHeader: true,
      })

      if (!mounted) return

      if (!res?.ok || res?.success === false) {
        setError(res?.message || 'Bu web sitesi henuz yayinda degil.')
        setPayload(null)
      } else {
        setPayload(res)
      }

      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [slug])

  if (loading) return null
  if (error) return null
  if (!payload) return null

  return <TenantPreviewScreen payload={payload} />
}
