import bcrypt from 'bcryptjs'
import { signToken } from '../utils/jwt.js'
import { error } from '../utils/errors.js'
import { findByEmail, findById, findByUsername } from '../repositories/userRepository.js'
import { findTenantById } from '../repositories/tenantRepository.js'
import { error as logError, info } from '../utils/logger.js'

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const normalizeIdentifier = (value) => String(value || '').trim().toLowerCase()

const normalizePortal = (portal) => {
  const p = String(portal || '').trim().toLowerCase()
  if (!p) return ''
  if (p === 'platform' || p === 'platform_admin') return 'platform'
  if (p === 'restaurant' || p === 'restoran' || p === 'kermes') return 'kermes'
  if (p === 'canteen' || p === 'kantin') return 'canteen'
  return p
}

export const login = async (identifier, password, _portal, { requestId } = {}) => {
  const normalizedIdentifier = normalizeIdentifier(identifier)
  const portal = normalizePortal(_portal)
  const isEmail = normalizedIdentifier.includes('@')
  const portalUsernameFilter = portal === 'platform'
    ? { role: { $in: ['platform_admin', 'superadmin'] } }
    : (portal === 'kermes' ? { systemType: 'kermes' } : (portal === 'canteen' ? { systemType: 'kantin' } : {}))

  let user = null

  try {
    user = isEmail
      ? await findByEmail(normalizedIdentifier)
      : (await findByUsername(normalizedIdentifier, portal ? portalUsernameFilter : {}))
        || (await findByUsername(normalizedIdentifier))

    if (process.env.NODE_ENV !== 'production') {
      try {
        info('[AUTH_LOGIN_TRY]', {
          requestId: requestId || null,
          identifier: normalizedIdentifier,
          mode: isEmail ? 'email' : 'username',
          portal: portal || null,
          userFound: !!user,
          hasPasswordField: !!(user && (user.passwordHash || user.password)),
          role: user?.role || null,
          tenantId: user?.tenantId ? String(user.tenantId) : null
        })
      } catch {}
    }

    if (!user) throw error('invalid_credentials', 'Invalid credentials', 401)
    if (!user.isActive) throw error('account_disabled', 'Account disabled', 403)
    const pwHash = user.passwordHash || user.password
    if (!pwHash) throw error('invalid_credentials', 'Invalid credentials', 401)
    let ok = false
    try {
      ok = await bcrypt.compare(String(password || ''), String(pwHash || ''))
    } catch (e) {
      const err = error('invalid_credentials', 'Invalid credentials', 401)
      err.cause = e
      throw err
    }
    if (!ok) throw error('invalid_credentials', 'Invalid credentials', 401)

  let tenant = null
  if (user.tenantId) {
    tenant = await findTenantById(user.tenantId)
    if (!tenant || !tenant.isActive || tenant.status !== 'active') throw error('tenant_inactive', 'Tenant inactive', 403)
    if (!tenant.systemType) {
      tenant.systemType = 'kermes'
      await tenant.save().catch(() => {})
    }
  }
  let branchId = user.branchId || null
  let branchIds = Array.isArray(user.branchIds) ? user.branchIds.map(String).filter(Boolean) : []

  const isPlatformUser = user.role === 'platform_admin' || user.role === 'superadmin'
  if (!isPlatformUser && !user.tenantId) {
    throw error('tenant_required', 'Tenant hesabı gerekli.', 403)
  }

  let systemType = null
  if (!isPlatformUser) {
    systemType = tenant?.systemType || user.systemType || 'kermes'
    if (systemType !== 'kermes' && systemType !== 'kantin') {
      throw error('invalid_system_type', 'Invalid system type', 403)
    }
    if (user.systemType !== systemType) {
      user.systemType = systemType
      await user.save().catch(() => {})
    }
  }

  if (portal) {
    if (portal === 'platform') {
      if (!isPlatformUser) throw error('wrong_portal', 'Wrong portal', 403)
    } else if (portal === 'kermes' || portal === 'canteen') {
      if (isPlatformUser) throw error('wrong_portal', 'Wrong portal', 403)
      if (portal === 'kermes' && systemType !== 'kermes') throw error('wrong_portal', 'Wrong portal', 403)
      if (portal === 'canteen' && systemType !== 'kantin') throw error('wrong_portal', 'Wrong portal', 403)
    }
  }

  if (user.role === 'staff') {
    if (branchIds.length === 0 && branchId) branchIds = [String(branchId)]
    if (systemType === 'kantin') {
      branchId = branchIds.length > 0 ? branchIds[0] : null
    } else {
      if (branchIds.length === 1) {
        branchId = branchIds[0]
      } else {
        branchId = null
      }
    }
  }

  if (!isPlatformUser && systemType === 'kantin') {
    if (!branchId) {
      try {
        if (branchIds.length === 1) {
          branchId = branchIds[0]
        } else {
          const { findTenantSettings } = await import('../modules/canteen/repositories/canteenSettingsRepository.js')
          const doc = await findTenantSettings(user.tenantId)
          const allowed = Array.isArray(doc?.canteenAllowedBranchIds) ? doc.canteenAllowedBranchIds.map(String).filter(Boolean) : []
          const candidate = doc?.canteenDefaultBranchId
            ? String(doc.canteenDefaultBranchId)
            : (doc?.defaultBranchId ? String(doc.defaultBranchId) : null)

          if (candidate && (allowed.length === 0 || allowed.includes(candidate))) {
            const { findByIdAndTenant } = await import('../modules/canteen/repositories/canteenBranchRepository.js')
            const b = await findByIdAndTenant(candidate, user.tenantId)
            if (b) branchId = String(b.id)
          }

          if (!branchId) {
            const { listByTenant } = await import('../modules/canteen/repositories/canteenBranchRepository.js')
            const branches = await listByTenant(user.tenantId)
            const scoped = allowed.length > 0
              ? (branches || []).filter(b => allowed.includes(String(b._id || b.id)))
              : branches
            if (Array.isArray(scoped) && scoped.length === 1) {
              branchId = String(scoped[0]._id)
            }
          }
        }
      } catch {
      }
    }

    if (user.role === 'staff' && branchId) {
      try {
        const { findTenantSettings } = await import('../modules/canteen/repositories/canteenSettingsRepository.js')
        const doc = await findTenantSettings(user.tenantId)
        const allowed = Array.isArray(doc?.canteenAllowedBranchIds) ? doc.canteenAllowedBranchIds.map(String).filter(Boolean) : []
        if (allowed.length > 0 && !allowed.includes(String(branchId))) {
          const candidate = branchIds.find(id => allowed.includes(String(id)))
          branchId = candidate || null
        }
      } catch {
      }
    }
  }

    const token = signToken({
      sub: user.id,
      name: user.name,
      role: user.role,
      tenantId: isPlatformUser ? null : (user.tenantId || null),
      permissions: user.permissions || [],
      systemType,
      branchId,
      branchIds: user.role === 'staff' ? branchIds : undefined
    })
    const userDto = {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username || null,
      role: user.role,
      tenantId: isPlatformUser ? null : (user.tenantId || null),
      permissions: user.permissions || [],
      systemType
    }
    return { token, user: userDto }
  } catch (err) {
    const status = Number(err?.status || 500)
    const safe = {
      requestId: requestId || null,
      identifier: normalizedIdentifier,
      portal: portal || null,
      userFound: !!user,
      userHasPasswordHash: !!user?.passwordHash,
      userHasPasswordField: !!user?.password,
      role: user?.role || null,
      tenantId: user?.tenantId ? String(user.tenantId) : null
    }

    const debug = process.env.DEBUG_LOGIN === '1'
    if (debug) {
      logError('[AUTH_LOGIN_ERROR]', safe, err?.stack || err)
    } else if (status >= 500) {
      logError('[AUTH_LOGIN_ERROR]', { requestId: safe.requestId, portal: safe.portal, userFound: safe.userFound, msg: String(err?.message || 'Internal error') })
    }

    throw err
  }
}

export const me = async (userId) => {
  const user = await findById(userId)
  if (!user) throw error('unauthorized', 'Unauthorized', 401)
  let tenant = null
  let branch = null
  if (user.tenantId) {
    tenant = await findTenantById(user.tenantId)
    if (tenant && !tenant.systemType) {
      tenant.systemType = 'kermes'
      await tenant.save().catch(() => {})
    }
  }
  if (user.branchId) {
    if (user.systemType === 'kantin') {
      try {
        const { findByIdAndTenant } = await import('../modules/canteen/repositories/canteenBranchRepository.js')
        const b = await findByIdAndTenant(user.branchId, user.tenantId)
        if (b) branch = { id: b.id, name: b.name }
      } catch {
      }
    } else {
      const b = await (await import('../repositories/branchRepository.js')).findByIdAndTenant(user.branchId, user.tenantId)
      if (b) branch = { id: b.id, name: b.name }
    }
  }
  if (user.role === 'tenant_admin' || user.role === 'staff') {
    const next = tenant?.systemType || user.systemType || 'kermes'
    if (next === 'kermes' || next === 'kantin') {
      if (user.systemType !== next) {
        user.systemType = next
        await user.save().catch(() => {})
      }
    }
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username || null,
    role: user.role,
    tenantId: user.tenantId || null,
    permissions: user.permissions || [],
    systemType: user.systemType || null,
    branchIds: Array.isArray(user.branchIds) ? user.branchIds.map(String) : [],
    tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status, systemType: tenant.systemType || null } : null,
    branch
  }
}
