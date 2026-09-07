import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { signToken } from '../utils/jwt.js'
import { error } from '../utils/errors.js'
import { sendMail } from '../utils/mailer.js'
import { findByEmail, findById, findByUsername } from '../repositories/userRepository.js'
import { findTenantById } from '../repositories/tenantRepository.js'
import { error as logError, info } from '../utils/logger.js'
import { getUserAccessibleBranchIds } from '../utils/branchVisibility.js'
import { normalizePackageType } from '../utils/systemType.js'
import User from '../models/User.js'

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const normalizeIdentifier = (value) => String(value || '').trim().toLowerCase()
const RESET_PASSWORD_TTL_MS = 15 * 60 * 1000

const normalizePortal = (portal) => {
  const p = String(portal || '').trim().toLowerCase()
  if (!p) return ''
  if (p === 'platform' || p === 'platform_admin') return 'platform'
  if (p === 'restaurant' || p === 'restoran' || p === 'kermes') return 'kermes'
  if (p === 'canteen' || p === 'kantin') return 'canteen'
  if (['anaokulu', 'kindergarten', 'kres', 'kre-s', 'okul-oncesi', 'kre', 'kres'].includes(p)) return 'anaokulu'
  return p
}

const getFrontendBaseUrl = () => {
  const raw = String(process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.APP_URL || 'https://penpos.cloud').trim()
  return raw.replace(/\/+$/, '')
}

const buildResetPasswordUrl = (token, portal) => {
  const baseUrl = getFrontendBaseUrl()
  const params = new URLSearchParams({ token: String(token || '') })
  const normalizedPortal = normalizePortal(portal)
  if (normalizedPortal) params.set('portal', normalizedPortal)
  return `${baseUrl}/reset-password?${params.toString()}`
}

const hashResetToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex')

const getMongoDiagnostics = () => ({
  readyState: mongoose.connection?.readyState ?? null,
  host: mongoose.connection?.host || null,
  name: mongoose.connection?.name || null,
  port: mongoose.connection?.port || null,
  nodeEnv: process.env.NODE_ENV || null
})

const resolveForgotFilter = (portal) => {
  const normalizedPortal = normalizePortal(portal)
  if (normalizedPortal === 'platform') return { role: { $in: ['platform_admin', 'superadmin'] } }
  if (normalizedPortal === 'canteen') return { systemType: 'kantin' }
  if (normalizedPortal === 'kermes') return { systemType: 'kermes' }
  if (normalizedPortal === 'anaokulu') return {
    $or: [
      { systemType: 'anaokulu' },
      { role: 'anaokulu_region_admin', regionSystemType: 'anaokulu' }
    ]
  }
  return { role: { $nin: ['platform_admin', 'superadmin'] } }
}

const resolveLoginPathForUser = (user) => {
  if (user?.role === 'platform_admin' || user?.role === 'superadmin') return '/platform-login'
  if (user?.role === 'anaokulu_region_admin') return '/anaokulu/login'
  if (user?.systemType === 'kantin') return '/canteen/login'
  if (user?.systemType === 'anaokulu') return '/anaokulu/login'
  return '/login/restoran'
}

const buildResetPasswordMail = ({ name, resetUrl }) => {
  const safeName = String(name || 'PenPOS Kullanıcısı').trim() || 'PenPOS Kullanıcısı'
  return {
    subject: 'PenPOS Şifre Sıfırlama',
    text: [
      `Merhaba ${safeName},`,
      '',
      'Şifrenizi sıfırlamak için aşağıdaki bağlantıyı açın:',
      resetUrl,
      '',
      'Bu bağlantı 15 dakika geçerlidir.',
      'Eğer bu işlemi siz yapmadıysanız bu e-postayı dikkate almayabilirsiniz.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:32px;color:#0f172a">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe7f3;border-radius:24px;padding:32px;box-shadow:0 18px 48px rgba(15,23,42,0.08)">
          <div style="font-size:28px;font-weight:800;margin-bottom:12px">PenPOS Şifre Sıfırlama</div>
          <p style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 18px">Merhaba ${safeName}, şifrenizi yenilemek için aşağıdaki butona tıklayın.</p>
          <a href="${resetUrl}" style="display:inline-block;padding:14px 22px;border-radius:14px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:800">Şifremi Sıfırla</a>
          <p style="font-size:13px;line-height:1.7;color:#64748b;margin:18px 0 0">Bu bağlantı 15 dakika geçerlidir.</p>
          <p style="font-size:13px;line-height:1.7;color:#64748b;margin:10px 0 0">Buton çalışmazsa bu bağlantıyı tarayıcınıza yapıştırın:</p>
          <p style="font-size:13px;line-height:1.7;color:#0f766e;word-break:break-all;margin:6px 0 0">${resetUrl}</p>
        </div>
      </div>
    `,
  }
}

export const login = async (identifier, password, _portal, { requestId } = {}) => {
  const normalizedIdentifier = normalizeIdentifier(identifier)
  const portal = normalizePortal(_portal)
  const isEmail = normalizedIdentifier.includes('@')
  const portalSystemType = portal === 'kermes'
    ? 'kermes'
    : (portal === 'canteen' ? 'kantin' : (portal === 'anaokulu' ? 'anaokulu' : null))
  const portalUsernameFilter = portal === 'platform'
    ? { role: { $in: ['platform_admin', 'superadmin'] } }
    : (portal === 'anaokulu'
        ? { $or: [{ systemType: portalSystemType }, { role: 'anaokulu_region_admin', regionSystemType: 'anaokulu' }] }
        : (portalSystemType ? { systemType: portalSystemType } : {}))

  let user = null

  try {
    const searchFilter = portal === 'platform' || portal === 'anaokulu'
      ? portalUsernameFilter
      : (portalSystemType ? { systemType: portalSystemType } : {})

    user = isEmail
      ? ((await findByEmail(normalizedIdentifier, searchFilter)) || (await findByEmail(normalizedIdentifier)))
      : ((await findByUsername(normalizedIdentifier, searchFilter)) || (await findByUsername(normalizedIdentifier)))

    if (!user) {
      if (process.env.DEBUG_LOGIN === '1') {
        try { info('[AUTH_LOGIN_LAST_RESORT]', { portal, identifier: normalizedIdentifier, note: 'Filtresiz son deneme' }) } catch {}
      }
      const lastResort = isEmail
        ? await User.findOne({ email: new RegExp(`^${String(normalizedIdentifier).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
        : await User.findOne({ username: new RegExp(`^${String(normalizedIdentifier).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
      if (lastResort) {
        const canLogin = (() => {
          if (portal === 'platform') return lastResort.role === 'platform_admin' || lastResort.role === 'superadmin'
          if (portal === 'anaokulu') {
            if (lastResort.role === 'anaokulu_region_admin') return true
            const lst = String(lastResort.systemType || '').trim().toLowerCase()
            const lstTenant = String(lastResort.tenantSystemType || '').trim().toLowerCase()
            return lst === 'anaokulu' || lstTenant === 'anaokulu' || lastResort.tenantId != null
          }
          if (portal === 'kermes') return String(lastResort.systemType || '').trim().toLowerCase() === 'kermes'
          if (portal === 'canteen') return String(lastResort.systemType || '').trim().toLowerCase() === 'kantin'
          return true
        })()
        if (canLogin) user = lastResort
      }
    }

    if (process.env.DEBUG_LOGIN === '1') {
      try {
        info('[AUTH_LOGIN_TRY]', {
          requestId: requestId || null,
          ...getMongoDiagnostics(),
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
      if (process.env.DEBUG_LOGIN === '1') {
        try {
          info('[AUTH_LOGIN_COMPARE]', {
            requestId: requestId || null,
            ...getMongoDiagnostics(),
            identifier: normalizedIdentifier,
            portal: portal || null,
            userFound: !!user,
            bcryptOk: !!ok
          })
        } catch {}
      }
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
      const tenantDefault = (() => {
        if (user.role === 'anaokulu_region_admin') return 'anaokulu'
        if (portal === 'anaokulu') return 'anaokulu'
        if (portal === 'canteen') return 'kantin'
        if (portal === 'kermes') return 'kermes'
        return 'kermes'
      })()
      tenant.systemType = tenantDefault
      await tenant.save().catch(() => {})
    }
  }
  let branchId = user.branchId || null
  let branchIds = getUserAccessibleBranchIds(user)

  const isPlatformUser = user.role === 'platform_admin' || user.role === 'superadmin'
  const isRegionAdmin = user.role === 'anaokulu_region_admin' || user.regionSystemType === 'anaokulu'

  if (!isPlatformUser && !user.tenantId && !isRegionAdmin) {
    throw error('tenant_required', 'Tenant hesabı gerekli.', 403)
  }

  let systemType = null
  if (!isPlatformUser) {
    if (isRegionAdmin) {
      systemType = 'anaokulu'
    } else {
      const defaultFromPortal = portal === 'kermes' ? 'kermes' : portal === 'canteen' ? 'kantin' : portal === 'anaokulu' ? 'anaokulu' : 'kermes'
      systemType = tenant?.systemType || user.systemType || defaultFromPortal
    }
    if (systemType !== 'kermes' && systemType !== 'kantin' && systemType !== 'anaokulu') {
      const defaultFromPortal2 = portal === 'kermes' ? 'kermes' : portal === 'canteen' ? 'kantin' : portal === 'anaokulu' ? 'anaokulu' : 'kermes'
      systemType = defaultFromPortal2
    }
    if (!isRegionAdmin && user.systemType !== systemType) {
      try {
        user.systemType = systemType
        await user.save().catch(() => {})
      } catch {}
    }
  }

  if (portal) {
    if (portal === 'platform') {
      if (!isPlatformUser) throw error('wrong_portal', 'Wrong portal', 403)
    } else if (portal === 'kermes' || portal === 'canteen') {
      if (isPlatformUser) throw error('wrong_portal', 'Wrong portal', 403)
      if (portal === 'kermes' && systemType !== 'kermes') throw error('wrong_portal', 'Wrong portal', 403)
      if (portal === 'canteen' && systemType !== 'kantin') throw error('wrong_portal', 'Wrong portal', 403)
    } else if (portal === 'anaokulu') {
      if (!isPlatformUser && !isRegionAdmin && systemType !== 'anaokulu') {
        throw error('wrong_portal', 'Wrong portal', 403)
      }
    }
  }

  if (tenant && !tenant.vertical) {
    tenant.vertical = normalizePackageType(tenant.systemType, 'restaurant')
    tenant.businessType = tenant.vertical
    await tenant.save().catch(() => {})
  }

  if (user.role === 'staff') {
    if (branchIds.length === 0 && branchId) branchIds = [String(branchId)]
    if (systemType === 'kantin' || systemType === 'anaokulu') {
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

  if (!isPlatformUser && systemType === 'anaokulu') {
    if (!isRegionAdmin && !branchId && branchIds.length === 1) {
      branchId = branchIds[0]
    }
  }

  let accessibleTenantsForDto = []
  let validAccessibleTenantIds = []
  if (isRegionAdmin && Array.isArray(user.accessibleTenantIds)) {
    try {
      const tenants = await Promise.all(
        user.accessibleTenantIds.map((tid) => findTenantById(tid).catch(() => null))
      )
      accessibleTenantsForDto = tenants
        .filter((t) => t && t.status !== 'deleted' && t.status !== 'inactive')
        .map((t) => ({
          id: String(t._id || t.id),
          name: t.name || 'Anaokulu',
          slug: t.slug || '',
          systemType: t.systemType || ''
        }))
      validAccessibleTenantIds = accessibleTenantsForDto.map((t) => t.id)
    } catch {
      accessibleTenantsForDto = []
      validAccessibleTenantIds = []
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
      branchIds: user.role === 'staff' ? branchIds : undefined,
      accessibleTenantIds: isRegionAdmin ? validAccessibleTenantIds : undefined,
      accessibleTenants: accessibleTenantsForDto.length > 0 ? accessibleTenantsForDto : undefined,
      regionSystemType: isRegionAdmin ? user.regionSystemType : undefined
    })
    const userDto = {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username || null,
      role: user.role,
      tenantId: isPlatformUser ? null : (user.tenantId || null),
      permissions: user.permissions || [],
      systemType,
      vertical: normalizePackageType(systemType),
      branchId,
      branchIds,
      accessibleBranchIds: user.role === 'staff' ? branchIds : [],
      accessibleTenantIds: isRegionAdmin ? validAccessibleTenantIds : [],
      accessibleTenants: accessibleTenantsForDto,
      regionSystemType: isRegionAdmin ? user.regionSystemType : null
    }
    return { token, user: userDto }
  } catch (err) {
    const status = Number(err?.status || 500)
    const safe = {
      requestId: requestId || null,
      ...getMongoDiagnostics(),
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

export const forgotPassword = async (email, portal) => {
  const normalizedEmail = normalizeEmail(email)
  const normalizedPortal = normalizePortal(portal)
  if (!normalizedEmail) throw error('invalid_email', 'Lütfen geçerli bir e-posta adresi girin.', 400)

  const filter = resolveForgotFilter(normalizedPortal)
  const user = await findByEmail(normalizedEmail, filter)
  if (!user || !user.isActive || user.isDeleted || user.status !== 'active') {
    try {
      info('[AUTH_FORGOT_PASSWORD_USER_NOT_FOUND]', {
        email: normalizedEmail,
        portal: normalizedPortal || null
      })
    } catch {}
    return { success: true, message: 'Eğer bu e-posta sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi.' }
  }

  const rawToken = crypto.randomBytes(32).toString('hex')
  const hashedToken = hashResetToken(rawToken)
  const expiresAt = new Date(Date.now() + RESET_PASSWORD_TTL_MS)
  const previousResetPasswordToken = user.resetPasswordToken
  const previousResetPasswordExpires = user.resetPasswordExpires

  user.resetPasswordToken = hashedToken
  user.resetPasswordExpires = expiresAt
  await user.save()

  const resetUrl = buildResetPasswordUrl(rawToken, normalizedPortal)
  const mail = buildResetPasswordMail({ name: user.name, resetUrl })
  try {
    await sendMail({
      to: user.email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
  } catch (err) {
    user.resetPasswordToken = previousResetPasswordToken
    user.resetPasswordExpires = previousResetPasswordExpires
    await user.save().catch(() => {})
    try {
      logError('[AUTH_FORGOT_PASSWORD_SEND_ERROR]', {
        email: normalizedEmail,
        portal: normalizedPortal || null,
        userId: String(user?._id || user?.id || ''),
        code: String(err?.code || err?.payload?.error || ''),
        message: String(err?.message || '')
      }, err?.stack || err)
    } catch {}
    if (err?.status) throw err

    throw error(
      'password_reset_unavailable',
      'Şifre sıfırlama e-postası şu anda gönderilemiyor. Lütfen daha sonra tekrar deneyin.',
      503
    )
  }

  return { success: true, message: 'Eğer bu e-posta sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi.' }
}

export const resetPassword = async (token, newPassword) => {
  const rawToken = String(token || '').trim()
  const nextPassword = String(newPassword || '')

  if (!rawToken) throw error('token_required', 'Şifre sıfırlama bağlantısı geçersiz.', 400)
  if (nextPassword.length < 6) throw error('password_too_short', 'Şifre en az 6 karakter olmalıdır.', 400)

  const hashedToken = hashResetToken(rawToken)
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: new Date() },
  })

  if (!user) throw error('invalid_reset_token', 'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.', 400)

  user.passwordHash = await bcrypt.hash(nextPassword, 10)
  user.resetPasswordToken = null
  user.resetPasswordExpires = null
  await user.save()

  return {
    success: true,
    message: 'Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.',
    loginPath: resolveLoginPathForUser(user),
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
    if (next === 'kermes' || next === 'kantin' || next === 'anaokulu') {
      if (user.systemType !== next) {
        user.systemType = next
        await user.save().catch(() => {})
      }
    }
  }
  let accessibleTenants = []
  const isRegion = user.role === 'anaokulu_region_admin' || user.regionSystemType === 'anaokulu'
  if (isRegion && Array.isArray(user.accessibleTenantIds) && user.accessibleTenantIds.length > 0) {
    try {
      const Tenant = (await import('../models/Tenant.js')).default
      const tList = await Tenant.find({
        _id: { $in: user.accessibleTenantIds },
        isDeleted: { $ne: true },
        status: { $ne: 'deleted' }
      }).select('name slug status systemType vertical businessType').lean()
      accessibleTenants = (tList || []).map(t => ({
        id: String(t._id),
        _id: String(t._id),
        name: t.name,
        slug: t.slug,
        status: t.status,
        systemType: t.systemType || t.vertical || 'anaokulu'
      }))
    } catch {}
  } else if (user.role === 'superadmin' || user.role === 'platform_admin') {
    try {
      const Tenant = (await import('../models/Tenant.js')).default
      const tList = await Tenant.find({
        $or: [
          { systemType: 'anaokulu' },
          { vertical: 'anaokulu' },
          { businessType: 'anaokulu' }
        ],
        isDeleted: { $ne: true },
        status: { $ne: 'deleted' }
      }).select('name slug status systemType vertical businessType').lean()
      accessibleTenants = (tList || []).map(t => ({
        id: String(t._id),
        _id: String(t._id),
        name: t.name,
        slug: t.slug,
        status: t.status,
        systemType: t.systemType || t.vertical || 'anaokulu'
      }))
    } catch {}
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username || null,
    role: user.role,
    tenantId: user.tenantId || null,
    permissions: user.permissions || [],
    systemType: user.systemType || (isRegion ? 'anaokulu' : null),
    regionSystemType: user.regionSystemType || (isRegion ? 'anaokulu' : null),
    accessibleTenantIds: isRegion
      ? accessibleTenants.map((t) => t.id)
      : (Array.isArray(user.accessibleTenantIds) ? user.accessibleTenantIds.map(String) : []),
    accessibleTenants,
    branchIds: getUserAccessibleBranchIds(user),
    accessibleBranchIds: getUserAccessibleBranchIds(user),
    pushNotificationsEnabled: Array.isArray(user.pushDevices) && user.pushDevices.some((device) => !device?.disabledAt && String(device?.token || '').trim()),
    tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status, systemType: tenant.systemType || null } : null,
    branch
  }
}
