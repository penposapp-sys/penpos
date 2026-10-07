import { useEffect } from 'react'

const SITE_URL = 'https://penpos.cloud'
const DEFAULT_IMAGE = `${SITE_URL}/site-icon-512.png`

function setMeta(attribute, key, content) {
  let element = document.querySelector(`meta[${attribute}="${key}"]`)
  const created = !element
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }

  const previousContent = element.getAttribute('content')
  element.setAttribute('content', content)

  return () => {
    if (created) {
      element.remove()
    } else if (previousContent === null) {
      element.removeAttribute('content')
    } else {
      element.setAttribute('content', previousContent)
    }
  }
}

export function usePageSeo({ title, description, path, keywords, schema }) {
  const schemaMarkup = schema ? JSON.stringify(schema) : ''

  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    const canonicalUrl = new URL(path, SITE_URL).toString()
    let canonical = document.querySelector('link[rel="canonical"]')
    const createdCanonical = !canonical
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    const previousCanonical = canonical.getAttribute('href')
    canonical.setAttribute('href', canonicalUrl)

    const restoreMeta = [
      setMeta('name', 'description', description),
      setMeta('name', 'robots', 'index,follow'),
      setMeta('name', 'twitter:card', 'summary'),
      setMeta('name', 'twitter:title', title),
      setMeta('name', 'twitter:description', description),
      setMeta('name', 'twitter:image', DEFAULT_IMAGE),
      setMeta('property', 'og:title', title),
      setMeta('property', 'og:description', description),
      setMeta('property', 'og:type', 'website'),
      setMeta('property', 'og:url', canonicalUrl),
      setMeta('property', 'og:image', DEFAULT_IMAGE)
    ]

    if (keywords) restoreMeta.push(setMeta('name', 'keywords', keywords))

    let pageSchema
    if (schemaMarkup) {
      pageSchema = document.createElement('script')
      pageSchema.type = 'application/ld+json'
      pageSchema.dataset.pageSeoSchema = 'true'
      pageSchema.textContent = schemaMarkup
      document.head.appendChild(pageSchema)
    }

    return () => {
      document.title = previousTitle
      if (createdCanonical) {
        canonical.remove()
      } else if (previousCanonical === null) {
        canonical.removeAttribute('href')
      } else {
        canonical.setAttribute('href', previousCanonical)
      }
      restoreMeta.reverse().forEach((restore) => restore())
      pageSchema?.remove()
    }
  }, [description, keywords, path, schemaMarkup, title])
}
