const DEFAULT_PUBLIC_ORIGIN = 'https://penpos.cloud'

const escapeAttribute = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

const cleanText = (value, fallback = '') => String(value || fallback)
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeSlug = (value) => String(value || '')
  .trim()
  .toLocaleLowerCase('tr-TR')
  .replace(/ç/g, 'c')
  .replace(/ğ/g, 'g')
  .replace(/ı/g, 'i')
  .replace(/ö/g, 'o')
  .replace(/ş/g, 's')
  .replace(/ü/g, 'u')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const getPublicOrigin = (value = process.env.PUBLIC_APP_URL) => {
  try {
    const url = new URL(String(value || DEFAULT_PUBLIC_ORIGIN))
    url.protocol = 'https:'
    return url.origin
  } catch {
    return DEFAULT_PUBLIC_ORIGIN
  }
}

const getPublicImageUrl = (value, origin) => {
  const raw = String(value || '').trim()
  if (!raw) return `${origin}/site-icon-512.png`

  try {
    if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) {
      const imageUrl = new URL(raw.startsWith('//') ? `https:${raw}` : raw)
      if (!['http:', 'https:'].includes(imageUrl.protocol)) return `${origin}/site-icon-512.png`
      imageUrl.protocol = 'https:'
      imageUrl.username = ''
      imageUrl.password = ''
      return imageUrl.toString()
    }

    const imagePath = raw.startsWith('/') ? raw : `/${raw}`
    const publicPath = imagePath.startsWith('/uploads/') ? `/api${imagePath}` : imagePath
    return new URL(publicPath, `${origin}/`).toString()
  } catch {
    return `${origin}/site-icon-512.png`
  }
}

const replaceHeadTag = (html, expression, replacement) => {
  if (expression.test(html)) return html.replace(expression, replacement)
  return html.replace(/<\/head>/i, `${replacement}\n</head>`)
}

const replaceMetaTag = (html, attribute, key, value) => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const expression = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${escapedKey}["'])[^>]*>`, 'i')
  return replaceHeadTag(html, expression, metaTag(attribute, key, value))
}

const metaTag = (attribute, key, value) =>
  `<meta ${attribute}="${escapeAttribute(key)}" content="${escapeAttribute(value)}" />`

export const buildTenantWebsiteSocialMetadata = ({
  tenant = {},
  settings = {},
  canonicalPath = '',
  publicOrigin
} = {}) => {
  const origin = getPublicOrigin(publicOrigin)
  const name = cleanText(tenant.businessName || tenant.name, 'PenPOS')
  const configuredTitle = cleanText(settings?.seo?.title)
  const storedTitleIsOldBusinessName = configuredTitle
    && tenant.slug
    && normalizeSlug(configuredTitle) === normalizeSlug(tenant.slug)
    && normalizeSlug(configuredTitle) !== normalizeSlug(name)
  const title = storedTitleIsOldBusinessName ? name : (configuredTitle || name)
  const about = (Array.isArray(settings.sections) ? settings.sections : [])
    .find((section) => String(section?.type || '') === 'about')
  const seoDescription = cleanText(settings?.seo?.description)
  const preferredDescription = seoDescription.toLocaleLowerCase('tr-TR') === 'penpos web sitesi'
    ? ''
    : seoDescription
  const description = [
    preferredDescription,
    settings?.hero?.subtitle,
    about?.subtitle,
    about?.content,
    tenant.description,
    `${name} resmi web sitesi.`
  ].map((candidate) => cleanText(candidate)).find(Boolean)
  const canonicalUrl = new URL(canonicalPath || '/', `${origin}/`).toString()
  const imageUrl = getPublicImageUrl(tenant.logoUrl || settings?.hero?.logoUrl, origin)

  return {
    title,
    description,
    canonicalUrl,
    imageUrl,
    imageAlt: `${name} logosu`
  }
}

export const injectTenantWebsiteSocialMetadata = (html, metadata) => {
  let result = String(html || '')
  const title = `<title>${escapeAttribute(metadata.title)}</title>`
  result = replaceHeadTag(result, /<title\b[^>]*>[\s\S]*?<\/title>/i, title)

  const tags = [
    ['property', 'og:title', metadata.title],
    ['property', 'og:description', metadata.description],
    ['property', 'og:type', 'website'],
    ['property', 'og:url', metadata.canonicalUrl],
    ['property', 'og:image', metadata.imageUrl],
    ['property', 'og:image:alt', metadata.imageAlt],
    ['name', 'description', metadata.description],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', metadata.title],
    ['name', 'twitter:description', metadata.description],
    ['name', 'twitter:image', metadata.imageUrl]
  ]

  tags.forEach(([attribute, key, value]) => {
    result = replaceMetaTag(result, attribute, key, value)
  })

  const canonicalTag = `<link rel="canonical" href="${escapeAttribute(metadata.canonicalUrl)}" />`
  result = replaceHeadTag(result, /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i, canonicalTag)
  return result
}
