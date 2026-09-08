import { Router } from 'express'
import { requireAuth } from '../middlewares/requireAuth.js'
import { requireRole } from '../middlewares/requireRole.js'
import { sendError } from '../utils/errors.js'
import { error } from '../utils/errors.js'
import * as selfAccount from '../services/selfAccountService.js'
import { createTenantWithOwnerService, listPlatformTenantsService, updateTenantStatusService, createPlanService, listPlansService, listPlansForTenantService, updatePlanService, deletePlanService, assignTenantPlanService, trialExtendService, trialEndService, editTenantService, softDeleteTenantService, hardDeleteTenantService, setPlatformUserPasswordService } from '../services/platformAdminService.js'
import { listAnaokuluRegionAdminsService, createAnaokuluRegionAdminService, updateAnaokuluRegionAdminService, deleteAnaokuluRegionAdminService } from '../services/superadminService.js'
import { listPaymentRequestsService, approvePaymentRequestService, rejectPaymentRequestService } from '../services/paymentService.js'
import { listMembershipRequestsService, approveMembershipRequestService, rejectMembershipRequestService } from '../services/platformBillingService.js'

const router = Router()

router.get('/me', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const user = await selfAccount.getMe(req.user.id)
    res.json({ success: true, user })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/me/email', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const { email, currentPassword } = req.body || {}
    const user = await selfAccount.updateEmail(req.user.id, email, currentPassword)
    res.json({ success: true, user })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/me/password', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {}
    const result = await selfAccount.updatePassword(req.user.id, currentPassword, newPassword)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/me/username', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const { username, currentPassword } = req.body || {}
    const user = await selfAccount.updateUsername(req.user.id, username, currentPassword)
    res.json({ success: true, user })
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/tenants/kermes', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await createTenantWithOwnerService({ ...(req.body || {}), systemType: 'kermes' })
    res.json({ success: true, id: result.tenant?._id || null })
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/tenants/canteen', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const incoming = req.body || {}
    if (incoming.systemType !== undefined && !['kantin', 'canteen'].includes(String(incoming.systemType))) {
      throw error('invalid_request', 'Invalid system type', 400)
    }
    const result = await createTenantWithOwnerService({ ...incoming, systemType: 'canteen' })
    res.json({ success: true, id: result.tenant?._id || null })
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/tenants/anaokulu', requireAuth, requireRole(['platform_admin', 'superadmin', 'anaokulu_region_admin']), async (req, res) => {
  try {
    const incoming = req.body || {}
    if (incoming.systemType !== undefined && !['anaokulu', 'anaokulu', 'kindergarten', 'kres', 'kreş'].includes(String(incoming.systemType))) {
      throw error('invalid_request', 'Invalid system type', 400)
    }
    const phoneVal = String(incoming.ownerPhone || incoming.phone || '').trim()
    const result = await createTenantWithOwnerService({
      ...incoming,
      ownerPhone: phoneVal,
      phone: phoneVal,
      systemType: 'anaokulu'
    })
    const newTenantId = result?.tenant?._id || result?.tenant?.id
    if (newTenantId && req.user?.role === 'anaokulu_region_admin') {
      const User = (await import('../models/User.js')).default
      const adminUser = await User.findById(req.user.id)
      if (adminUser) {
        const existingIds = Array.isArray(adminUser.accessibleTenantIds) ? adminUser.accessibleTenantIds.map(String) : []
        if (!existingIds.includes(String(newTenantId))) {
          adminUser.accessibleTenantIds = [...existingIds, String(newTenantId)]
          await adminUser.save().catch(() => {})
        }
      }
    }
    res.json({ success: true, ok: true, id: newTenantId || null, tenant: result.tenant, owner: result.owner || null })
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/tenants', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await createTenantWithOwnerService(req.body || {})
    res.json({ success: true, id: result.tenant?._id || null })
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/tenants', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const list = await listPlatformTenantsService(req.query?.system)
    res.json(list)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:id/status', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const { isActive } = req.body || {}
    const result = await updateTenantStatusService(req.params.id, !!isActive, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:tenantId', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const { name, email } = req.body || {}
    const tenant = await editTenantService(req.params.tenantId, { name, email }, req.user.id)
    res.json({ success: true, tenant })
  } catch (err) {
    sendError(res, err)
  }
})

router.delete('/tenants/:tenantId', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await hardDeleteTenantService(req.params.tenantId, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/plans', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const plan = await createPlanService(req.body || {}, req.user.id)
    res.json({ success: true, id: plan._id })
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/plans', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const tenantId = String(req.query?.tenantId || '').trim()
    const items = tenantId
      ? await listPlansForTenantService(tenantId, req.query?.systemType)
      : await listPlansService(req.query?.systemType)
    res.json({ success: true, items, plans: items })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/plans/:id', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const plan = await updatePlanService(req.params.id, req.body || {}, req.user.id)
    res.json({ plan })
  } catch (err) {
    sendError(res, err)
  }
})

router.delete('/plans/:id', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await deletePlanService(req.params.id, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:tenantId/plan', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await assignTenantPlanService(req.params.tenantId, req.body || {}, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:tenantId/trial-extend', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const days = Number(req.body?.days || 0)
    const result = await trialExtendService(req.params.tenantId, days, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/tenants/:tenantId/trial-end', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await trialEndService(req.params.tenantId, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/payments', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await listPaymentRequestsService()
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/payments/:id/approve', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await approvePaymentRequestService(req.params.id, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/payments/:id/reject', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await rejectPaymentRequestService(req.params.id, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/billing/requests', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await listMembershipRequestsService({ status: req.query?.status, systemType: req.query?.systemType })
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/billing/requests/:id/approve', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await approveMembershipRequestService(req.params.id, req.user.id, req.body?.decisionNote)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/billing/requests/:id/reject', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const result = await rejectMembershipRequestService(req.params.id, req.user.id, req.body?.decisionNote)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/users/:id/password', requireAuth, requireRole(['platform_admin', 'superadmin']), async (req, res) => {
  try {
    const password = req.body?.password
    const result = await setPlatformUserPasswordService(req.params.id, password, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/anaokulu-region-admins', requireAuth, requireRole(['superadmin', 'platform_admin']), async (req, res) => {
  try {
    const items = await listAnaokuluRegionAdminsService()
    res.json({ items })
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/anaokulu-region-admins', requireAuth, requireRole(['superadmin', 'platform_admin']), async (req, res) => {
  try {
    const b = req.body || {}
    const result = await createAnaokuluRegionAdminService({
      name: b.name,
      email: b.email,
      password: b.password,
      phone: b.phone,
      accessibleTenantIds: b.accessibleTenantIds
    }, req.user.id)
    res.json({ success: true, user: result })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/anaokulu-region-admins/:userId', requireAuth, requireRole(['superadmin', 'platform_admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const b = req.body || {}
    const result = await updateAnaokuluRegionAdminService(userId, {
      name: b.name,
      email: b.email,
      phone: b.phone,
      password: b.password,
      accessibleTenantIds: b.accessibleTenantIds,
      isActive: b.isActive
    }, req.user.id)
    res.json({ success: true, user: result })
  } catch (err) {
    sendError(res, err)
  }
})

router.delete('/anaokulu-region-admins/:userId', requireAuth, requireRole(['superadmin', 'platform_admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const result = await deleteAnaokuluRegionAdminService(userId, req.user.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

// Region admin kendi adına yeni anaokulu oluşturur (kendine otomatik atanır)
router.post('/region-admin/create-school', requireAuth, requireRole(['anaokulu_region_admin', 'superadmin', 'platform_admin']), async (req, res) => {
  try {
    const actorId = req.user?.id
    if (!actorId) throw error('unauthorized', 'Kimlik doğrulaması gerekli', 401)

    const incoming = req.body || {}
    if (!incoming.name || !String(incoming.name).trim()) {
      throw error('invalid_request', 'Okul adı zorunludur', 400)
    }

    // Create the new tenant with owner
    const phoneVal = String(incoming.ownerPhone || incoming.phone || '').trim()
    const result = await createTenantWithOwnerService({
      ...incoming,
      ownerPhone: phoneVal,
      phone: phoneVal,
      systemType: 'anaokulu'
    })
    const newTenantId = result?.tenant?._id || result?.tenant?.id
    if (!newTenantId) throw error('server_error', 'Okul oluşturulamadı', 500)

    // Auto-assign this new tenant to the requesting user if region admin
    const User = (await import('../models/User.js')).default
    const adminUser = await User.findById(actorId)
    if (adminUser) {
      const existingIds = Array.isArray(adminUser.accessibleTenantIds)
        ? adminUser.accessibleTenantIds.map(String)
        : []
      const newId = String(newTenantId)
      if (!existingIds.includes(newId)) {
        adminUser.accessibleTenantIds = [...existingIds, newId]
        await adminUser.save().catch(() => {})
      }
    }

    res.json({ ok: true, success: true, tenant: result.tenant, owner: result.owner, tenantId: String(newTenantId) })
  } catch (err) {
    sendError(res, err)
  }
})

// Region admin'e yeni tenant atama (platform admin tarafından)
router.post('/anaokulu-region-admins/:userId/assign-tenant', requireAuth, requireRole(['superadmin', 'platform_admin', 'anaokulu_region_admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const { tenantId } = req.body || {}

    // Region admin sadece kendi ID'si için işlem yapabilir
    if (req.user.role === 'anaokulu_region_admin' && String(req.user.id) !== String(userId)) {
      throw error('forbidden', 'Yalnızca kendi hesabınıza atama yapabilirsiniz', 403)
    }

    if (!tenantId) throw error('invalid_request', 'Tenant ID zorunludur', 400)

    const User = (await import('../models/User.js')).default
    const adminUser = await User.findById(userId)
    if (!adminUser) throw error('not_found', 'Kullanıcı bulunamadı', 404)

    const existingIds = Array.isArray(adminUser.accessibleTenantIds)
      ? adminUser.accessibleTenantIds.map(String)
      : []
    const newId = String(tenantId)
    if (!existingIds.includes(newId)) {
      adminUser.accessibleTenantIds = [...existingIds, newId]
      await adminUser.save()
    }

    res.json({ ok: true, success: true, accessibleTenantIds: adminUser.accessibleTenantIds.map(String) })
  } catch (err) {
    sendError(res, err)
  }
})

// Region Admin Kendi Hesabı İçin Üye (Yönetici/Asistan) Yönetimi
router.get('/region-admin/members', requireAuth, requireRole(['anaokulu_region_admin', 'superadmin', 'platform_admin']), async (req, res) => {
  try {
    const User = (await import('../models/User.js')).default
    const isSuper = req.user.role === 'superadmin' || req.user.role === 'platform_admin'
    
    let query = {
      role: 'anaokulu_region_admin',
      isDeleted: { $ne: true }
    }
    if (!isSuper) {
      const myTenantIds = Array.isArray(req.user.accessibleTenantIds) ? req.user.accessibleTenantIds.map(String) : []
      query = {
        role: 'anaokulu_region_admin',
        isDeleted: { $ne: true },
        $or: [
          { _id: req.user.id },
          { creatorId: req.user.id },
          { accessibleTenantIds: { $in: myTenantIds } }
        ]
      }
    }

    const items = await User.find(query)
      .sort({ createdAt: -1 })
      .select('_id name email username phone role isActive status createdAt accessibleTenantIds creatorId')
      .lean()

    res.json({ success: true, items: items.map(u => ({ ...u, id: String(u._id) })) })
  } catch (err) {
    sendError(res, err)
  }
})

router.post('/region-admin/members', requireAuth, requireRole(['anaokulu_region_admin', 'superadmin', 'platform_admin']), async (req, res) => {
  try {
    const { name, email, username, phone, password } = req.body || {}
    if (!name || !String(name).trim()) throw error('invalid_request', 'Ad Soyad zorunludur', 400)
    if (!email || !String(email).trim()) throw error('invalid_request', 'E-posta zorunludur', 400)
    if (!password || String(password).length < 6) throw error('invalid_request', 'Şifre en az 6 karakter olmalıdır', 400)

    const cleanEmail = String(email).trim().toLowerCase()
    const cleanUsername = username ? String(username).trim().toLowerCase() : undefined

    const User = (await import('../models/User.js')).default
    const bcrypt = (await import('bcryptjs')).default

    const existingEmail = await User.findOne({ email: cleanEmail, isDeleted: { $ne: true } })
    if (existingEmail) throw error('duplicate_email', 'Bu e-posta zaten kullanımda', 409)

    if (cleanUsername) {
      const existingUser = await User.findOne({ username: cleanUsername, isDeleted: { $ne: true } })
      if (existingUser) throw error('duplicate_username', 'Bu kullanıcı adı zaten kullanımda', 409)
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const targetTenantIds = Array.isArray(req.user.accessibleTenantIds)
      ? req.user.accessibleTenantIds.map(String)
      : []

    const user = await User.create({
      name: String(name).trim(),
      email: cleanEmail,
      username: cleanUsername,
      phone: phone ? String(phone).trim() : '',
      passwordHash,
      role: 'anaokulu_region_admin',
      regionSystemType: 'anaokulu',
      systemType: null,
      accessibleTenantIds: targetTenantIds,
      accessibleBranchIds: [],
      creatorId: req.user.id,
      isActive: true,
      status: 'active'
    })

    res.json({
      success: true,
      user: {
        id: String(user._id),
        _id: String(user._id),
        name: user.name,
        email: user.email,
        username: user.username,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        accessibleTenantIds: user.accessibleTenantIds
      }
    })
  } catch (err) {
    sendError(res, err)
  }
})

router.put('/region-admin/members/:userId', requireAuth, requireRole(['anaokulu_region_admin', 'superadmin', 'platform_admin']), async (req, res) => {
  try {
    const { userId } = req.params
    const { name, email, username, phone, password, isActive } = req.body || {}
    const User = (await import('../models/User.js')).default
    const bcrypt = (await import('bcryptjs')).default

    const user = await User.findById(userId)
    if (!user || user.isDeleted) throw error('not_found', 'Kullanıcı bulunamadı', 404)

    if (name !== undefined) user.name = String(name).trim()
    if (phone !== undefined) user.phone = String(phone).trim()
    if (isActive !== undefined) {
      user.isActive = Boolean(isActive)
      user.active = Boolean(isActive)
    }

    if (email && String(email).trim().toLowerCase() !== user.email) {
      const cleanEmail = String(email).trim().toLowerCase()
      const existing = await User.findOne({ email: cleanEmail, _id: { $ne: user._id }, isDeleted: { $ne: true } })
      if (existing) throw error('duplicate_email', 'Bu e-posta başka bir kullanıcı tarafından kullanılıyor', 409)
      user.email = cleanEmail
    }

    if (username !== undefined) {
      const cleanUsername = username ? String(username).trim().toLowerCase() : undefined
      if (cleanUsername && cleanUsername !== user.username) {
        const existingU = await User.findOne({ username: cleanUsername, _id: { $ne: user._id }, isDeleted: { $ne: true } })
        if (existingU) throw error('duplicate_username', 'Bu kullanıcı adı zaten kullanımda', 409)
      }
      user.username = cleanUsername
    }

    if (password && String(password).length >= 6) {
      user.passwordHash = await bcrypt.hash(password, 10)
    }

    await user.save()

    res.json({
      success: true,
      user: {
        id: String(user._id),
        _id: String(user._id),
        name: user.name,
        email: user.email,
        username: user.username,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        accessibleTenantIds: user.accessibleTenantIds
      }
    })
  } catch (err) {
    sendError(res, err)
  }
})

router.delete('/region-admin/members/:userId', requireAuth, requireRole(['anaokulu_region_admin', 'superadmin', 'platform_admin']), async (req, res) => {
  try {
    const { userId } = req.params
    if (String(req.user.id) === String(userId)) {
      throw error('invalid_request', 'Kendi hesabınızı silemezsiniz', 400)
    }
    const User = (await import('../models/User.js')).default
    const user = await User.findById(userId)
    if (!user || user.isDeleted) throw error('not_found', 'Kullanıcı bulunamadı', 404)

    user.isDeleted = true
    user.isActive = false
    user.active = false
    user.status = 'deleted'
    user.deletedAt = new Date()
    await user.save()

    res.json({ ok: true, success: true })
  } catch (err) {
    sendError(res, err)
  }
})

export default router
