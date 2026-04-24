import { error } from '../utils/errors.js'
import { findByIdAndTenant as findBranchByIdAndTenant, findAllByTenant as listActiveBranchesByTenant } from '../repositories/branchRepository.js'
import { findTenantById } from '../repositories/tenantRepository.js'
import { log as auditLog } from '../services/auditService.js'
import * as logger from '../utils/logger.js'
import { parseBranchIds, requireValidObjectIds, intersectAllowed } from '../utils/branchIds.js'

export const branchGuard = async (req, res, next) => {
  const { role, tenantId, branchId } = req.user || {}
  if (req.method === 'GET' && (req.query?.branchId || req.query?.branchIds)) {
    try { res.setHeader('x-branch-guard', 'branchGuard_list_passthrough_v2') } catch {}
    const requested = parseBranchIds(req.query?.branchId, req.query?.branchIds)
    const bad = requireValidObjectIds(requested)
    if (bad.length > 0) {
      return res.status(400).json({ status: 400, code: 'invalid_request', message: 'Invalid branch id' })
    }
    let tenantAllowed = []
    try {
      const t = await findTenantById(tenantId)
      tenantAllowed = Array.isArray(t?.allowedBranchIds) ? t.allowedBranchIds.map(String) : []
    } catch {}
    let staffAllowed = null
    if (role === 'staff') {
      staffAllowed = Array.isArray(req.user?.branchIds) && req.user.branchIds.length > 0
        ? req.user.branchIds.map(String)
        : (req.user?.branchId ? [String(req.user.branchId)] : [])
    }
    const effectiveAllowed = staffAllowed
      ? tenantAllowed.filter(id => staffAllowed.includes(String(id)))
      : tenantAllowed
    const { finalIds } = intersectAllowed(requested, effectiveAllowed)
    let activeIds = []
    try {
      const activeBranches = await listActiveBranchesByTenant(tenantId)
      activeIds = (activeBranches || []).map(b => String(b._id))
    } catch {}
    const validIds = finalIds.filter(id => activeIds.includes(String(id)))
    if (requested.length > 0 && validIds.length === 0) {
      return res.status(403).json({ status: 403, code: 'branch_not_allowed', message: 'Bu şubeye erişim yetkin yok' })
    }
    if (validIds.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        return res.status(403).json({
          status: 403,
          code: 'no_allowed_branches',
          message: 'Kullanıcıya atanmış aktif şube yok',
          details: { requested, effectiveAllowed, activeIds }
        })
      }
      return res.status(403).json({
        status: 403,
        code: 'no_allowed_branches',
        message: 'Kullanıcıya atanmış aktif şube yok'
      })
    }
    req.branchIds = validIds.map(String)
    return next()
  }
  if (role === 'staff' || role === 'tenant_admin') {
    const requestedIds = parseBranchIds(req.query?.branchId, req.query?.branchIds)
    if (Array.isArray(requestedIds) && requestedIds.length > 0) {
      const bad = requireValidObjectIds(requestedIds)
      if (bad.length > 0) {
        return res.status(400).json({ status: 400, code: 'invalid_request', message: 'Invalid branch id' })
      }
      let candidates = requestedIds.map(String)
      if (role === 'staff') {
        const allowed = Array.isArray(req.user?.branchIds) ? req.user.branchIds.map(String) : []
        candidates = candidates.filter(id => allowed.includes(String(id)))
      }
      const branches = []
      for (const id of candidates) {
        const b = await findBranchByIdAndTenant(id, tenantId)
        if (b && b.isActive) {
          branches.push({ id: String(b.id), name: b.name })
        }
      }
      req.branches = branches
      req.branchIds = branches.map(b => String(b.id))
      try { res.setHeader('x-branch-guard', 'branchGuard_list_passthrough_v1') } catch {}
      return next()
    }
    const headerBranchId = req.headers?.['x-branch-id'] ? String(req.headers['x-branch-id']) : null
    const tokenBranchId = branchId ? String(branchId) : null
    const resolvedBranchId = req.branchId ? String(req.branchId) : (headerBranchId || tokenBranchId)
    const branchSource = req.branchId
      ? (req.branchSource || 'resolver')
      : (headerBranchId ? 'header' : (tokenBranchId ? 'token' : null))

    const staffAllowedBranchIds = role === 'staff'
      ? (Array.isArray(req.user?.branchIds) && req.user.branchIds.length > 0
        ? req.user.branchIds.map(String)
        : (req.user?.branchId ? [String(req.user.branchId)] : []))
      : null

    if (!resolvedBranchId) {
      const details = {
        headerBranchId,
        tokenBranchId,
        resolvedBranchId: null,
        allowedBranchIds: staffAllowedBranchIds,
        reason: 'missing_branch',
        branchSource
      }
      if (process.env.NODE_ENV !== 'production') {
        return res.status(403).json({ status: 403, code: 'missing_branch', message: 'Branch required', details })
      }
      return res.status(403).json({ status: 403, code: 'missing_branch', message: 'Branch required' })
    }

    if (role === 'staff' && Array.isArray(staffAllowedBranchIds) && staffAllowedBranchIds.length > 0) {
      if (!staffAllowedBranchIds.includes(String(resolvedBranchId))) {
        const details = {
          headerBranchId,
          tokenBranchId,
          resolvedBranchId: String(resolvedBranchId),
          allowedBranchIds: staffAllowedBranchIds,
          reason: 'forbidden_invalid_branch',
          branchSource
        }
        if (process.env.NODE_ENV !== 'production') {
          return res.status(403).json({ status: 403, code: 'forbidden_invalid_branch', message: 'Invalid branch', details })
        }
        return res.status(403).json({ status: 403, code: 'forbidden_invalid_branch', message: 'Invalid branch' })
      }
    }

    const branch = await findBranchByIdAndTenant(resolvedBranchId, tenantId)
    if (!branch) {
      const details = {
        headerBranchId,
        tokenBranchId,
        resolvedBranchId: String(resolvedBranchId),
        allowedBranchIds: staffAllowedBranchIds,
        reason: 'not_found_in_tenant',
        branchSource
      }
      if (process.env.NODE_ENV !== 'production') {
        return res.status(403).json({ status: 403, code: 'forbidden_invalid_branch', message: 'Invalid branch', details })
      }
      return res.status(403).json({ status: 403, code: 'forbidden_invalid_branch', message: 'Invalid branch' })
    }
    if (!branch.isActive) {
      try {
        const actorUserId = req.user.id
        await auditLog(tenantId || null, actorUserId, 'yetkisiz_islem_engellendi', 'User', actorUserId, { route: req.path, reason: 'branch_inactive' })
      } catch {}
      const details = {
        headerBranchId,
        tokenBranchId,
        resolvedBranchId: String(resolvedBranchId),
        allowedBranchIds: staffAllowedBranchIds,
        reason: 'branch_inactive',
        branchSource
      }
      if (process.env.NODE_ENV !== 'production') {
        return res.status(403).json({ status: 403, code: 'forbidden_invalid_branch', message: 'Branch inactive', details })
      }
      return res.status(403).json({ status: 403, code: 'forbidden_invalid_branch', message: 'Branch inactive' })
    }

    req.branch = { id: branch.id, name: branch.name }
    try {
      if (req.user) req.user.branchId = branch.id
    } catch {}
    req.branchIds = [String(branch.id)]
    try { res.setHeader('x-branch-guard', 'branchGuard_action_v2') } catch {}
  }
  if (process.env.NODE_ENV !== 'production') {
    try {
      console.debug('[BRANCH_GUARD]', {
        route: req.originalUrl,
        role: req.user?.role,
        branchIds: req.branchIds,
        headerBranch: req.headers?.['x-branch-id'] || null,
        query: req.query
      })
    } catch {}
  }
  next()
}
