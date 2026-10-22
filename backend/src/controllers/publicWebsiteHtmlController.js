import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { sendError } from '../utils/errors.js'
import {
  buildTenantWebsiteSocialMetadata,
  injectTenantWebsiteSocialMetadata
} from '../utils/tenantWebsiteSocialMeta.js'
import { getPublicTenantWebsiteMetadataBySlugService } from '../services/tenantWebsiteService.js'
import { findActiveTenantByPublicSlug } from './publicController.js'

const controllerDir = path.dirname(fileURLToPath(import.meta.url))
const getFrontendIndexPath = () => path.resolve(
  process.env.FRONTEND_DIST_DIR || path.resolve(controllerDir, '../../../frontend/dist'),
  'index.html'
)

export const renderPublicTenantWebsiteHtml = async (req, res) => {
  try {
    const siteType = req.path.startsWith('/wepmagaza/') ? 'store' : ''
    const [template, site] = await Promise.all([
      readFile(getFrontendIndexPath(), 'utf8'),
      getPublicTenantWebsiteMetadataBySlugService(req.params.slug, siteType)
    ])
    const prefix = String(req.path.split('/')[1] || 'weprestorant')
    const canonicalPath = `/${prefix}/${encodeURIComponent(site.settings.slug)}`
    const metadata = buildTenantWebsiteSocialMetadata({
      tenant: site.tenant,
      settings: site.settings,
      canonicalPath
    })

    res.set('Cache-Control', 'no-store, max-age=0')
    res.type('html').send(injectTenantWebsiteSocialMetadata(template, metadata))
  } catch (err) {
    sendError(res, err)
  }
}
export const renderPublicQrMenuHtml = async (req, res) => {
  try {
    const tenantSlug = String(req.params.tenantSlug || '').trim()
    const [template, tenant] = await Promise.all([
      readFile(getFrontendIndexPath(), 'utf8'),
      findActiveTenantByPublicSlug(tenantSlug)
    ])
    if (!tenant) return res.status(404).send('Menu bulunamadı.')
    const tenantName = String(tenant.businessName || tenant.name || 'İşletme').trim()
    const metadata = buildTenantWebsiteSocialMetadata({
      tenant,
      settings: {
        seo: {
          title: `${tenantName} | QR Menü`,
          description: `${tenantName} QR menüsünü görüntüleyin.`
        }
      },
      canonicalPath: `/menu/${encodeURIComponent(tenantSlug)}`
    })
    res.set('Cache-Control', 'no-store, max-age=0')
    res.type('html').send(injectTenantWebsiteSocialMetadata(template, metadata))
  } catch (err) {
    sendError(res, err)
  }
}
