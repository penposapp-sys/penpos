import { sendError, error } from '../utils/errors.js'
import { createTenantWithOwnerService } from '../services/platformAdminService.js'
import { login } from '../services/authService.js'
import { normalizePackageType, toLegacySystemType } from '../utils/systemType.js'

const normalizeSystemType = (value) => {
  const packageType = normalizePackageType(value, 'restaurant')
  return {
    packageType,
    legacySystemType: toLegacySystemType(packageType, 'kermes')
  }
}

export const registerPublicTenant = async (req, res) => {
  try {
    const body = req.body || {}
    const { packageType, legacySystemType } = normalizeSystemType(body.systemType || body.businessType)
    const name = String(body.businessName || body.name || '').trim()
    const ownerName = String(body.ownerName || '').trim()
    const ownerEmail = String(body.email || body.ownerEmail || '').trim()
    const ownerPhone = String(body.phone || body.ownerPhone || '').trim()
    const ownerPassword = String(body.password || body.ownerPassword || '').trim()
    const description = String(body.notes || body.description || '').trim()

    if (!name || !ownerName || !ownerEmail || !ownerPhone || !ownerPassword) {
      throw error('validation_error', 'Eksik zorunlu alan var', 400)
    }

    const created = await createTenantWithOwnerService({ name, ownerName, ownerEmail, ownerPhone, ownerPassword, systemType: packageType, description })
    const portal = legacySystemType === 'kantin' ? 'canteen' : 'kermes'
    const loginResult = await login(ownerEmail, ownerPassword, portal, { requestId: req.requestId })

    res.json({
      success: true,
      token: loginResult.token,
      user: loginResult.user,
      tenant: created.tenant,
      portal,
      redirectTo: portal === 'canteen' ? '/canteen' : '/kermes'
    })
  } catch (err) {
    sendError(res, err)
  }
}
