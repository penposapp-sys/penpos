import mongoose from 'mongoose'
import { error } from '../utils/errors.js'
import { log as auditLog } from './auditService.js'
import MembershipRequest from '../models/MembershipRequest.js'
import Tenant from '../models/Tenant.js'
import Plan from '../models/Plan.js'
import { updateById as updateTenantById } from '../repositories/tenantRepository.js'

const normalizeStatus = (s) => {
  const t = String(s || '').trim().toLowerCase()
  if (!t) return 'pending'
  if (t === 'all') return 'all'
  if (t === 'pending' || t === 'approved' || t === 'rejected' || t === 'cancelled') return t
  throw error('invalid_request', 'Invalid status filter', 400)
}

const normalizeSystemType = (s) => {
  const t = String(s || '').trim().toLowerCase()
  if (!t) return ''
  if (t === 'canteen') return 'kantin'
  if (t === 'kantin' || t === 'kermes') return t
  throw error('invalid_request', 'Invalid systemType filter', 400)
}

const toItem = ({ req, tenant, plan }) => {
  const snap = req?.requestedPlanSnapshot && typeof req.requestedPlanSnapshot === 'object' ? req.requestedPlanSnapshot : null
  const planName = String(plan?.name || snap?.name || req?.requestedPlan || '')
  return {
    id: String(req?._id || ''),
    tenant: {
      id: String(req?.tenantId || ''),
      name: String(tenant?.name || ''),
      systemType: String(tenant?.systemType || '')
    },
    requestedPlanId: req?.requestedPlanId ? String(req.requestedPlanId) : '',
    planName,
    requestedLimits: req?.requestedLimits || null,
    createdAt: req?.createdAt || null,
    status: String(req?.status || '')
  }
}

export const listMembershipRequestsService = async ({ status, systemType } = {}) => {
  const st = normalizeStatus(status)
  const sys = normalizeSystemType(systemType)

  const filter = {}
  if (st !== 'all') filter.status = st
  if (sys) {
    const tenantIds = await Tenant.find({ systemType: sys }).select('_id').lean()
    const ids = tenantIds.map(t => t._id)
    filter.tenantId = { $in: ids }
  }

  const list = await MembershipRequest.find(filter).sort({ createdAt: -1 }).lean()
  const tenantIds = Array.from(new Set(list.map(r => String(r.tenantId || '')).filter(Boolean)))
  const planIds = Array.from(new Set(list.map(r => String(r.requestedPlanId || '')).filter(Boolean).filter(id => mongoose.isValidObjectId(id))))

  const tenants = tenantIds.length > 0
    ? await Tenant.find({ _id: { $in: tenantIds.map(id => new mongoose.Types.ObjectId(id)) } }).select('name systemType').lean()
    : []
  const plans = planIds.length > 0
    ? await Plan.find({ _id: { $in: planIds.map(id => new mongoose.Types.ObjectId(id)) } }).select('name price systemType isActive trialDays').lean()
    : []

  const tenantById = new Map(tenants.map(t => [String(t._id), t]))
  const planById = new Map(plans.map(p => [String(p._id), p]))

  return {
    success: true,
    items: list.map(r => toItem({ req: r, tenant: tenantById.get(String(r.tenantId)), plan: planById.get(String(r.requestedPlanId)) }))
  }
}

export const approveMembershipRequestService = async (id, actorUserId, decisionNote) => {
  if (!mongoose.isValidObjectId(id)) throw error('invalid_request', 'Invalid request id', 400)
  const reqDoc = await MembershipRequest.findById(id)
  if (!reqDoc) throw error('not_found', 'Talep bulunamadı', 404)
  if (reqDoc.status !== 'pending') throw error('invalid_state', 'Talep beklemiyor', 409)

  const tenant = await Tenant.findById(reqDoc.tenantId)
  if (!tenant) throw error('not_found', 'Tenant bulunamadı', 404)
  if (!reqDoc.requestedPlanId) throw error('invalid_request', 'requestedPlanId yok', 400)
  const plan = await Plan.findById(reqDoc.requestedPlanId)
  if (!plan || !plan.isActive) throw error('plan_inactive', 'Plan aktif değil', 400)

  const tenantSystem = String(tenant.systemType || 'kermes')
  const planSystem = String(plan.systemType || 'kermes')
  if (tenantSystem !== planSystem) throw error('plan_system_mismatch', 'Plan sistem tipi uyumsuz', 409)

  const now = new Date()
  const endsAt = plan.trialDays && plan.trialDays > 0
    ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
    : null

  reqDoc.status = 'approved'
  reqDoc.decidedBy = actorUserId
  reqDoc.decidedAt = now
  reqDoc.decisionNote = decisionNote !== undefined
    ? String(decisionNote || '').trim()
    : (reqDoc.decisionNote || '')
  await reqDoc.save()

  await updateTenantById(String(tenant._id), { planId: plan._id, planStartedAt: now, planEndsAt: endsAt, status: 'active' })
  await auditLog(String(tenant._id), actorUserId || null, 'membership_request_approved', 'MembershipRequest', String(reqDoc._id), { planId: String(plan._id) })
  await auditLog(String(tenant._id), actorUserId || null, 'uye_plan_degisti', 'Tenant', String(tenant._id), { planId: String(plan._id) })
  return { success: true, tenantId: String(tenant._id), planId: String(plan._id) }
}

export const rejectMembershipRequestService = async (id, actorUserId, decisionNote) => {
  if (!mongoose.isValidObjectId(id)) throw error('invalid_request', 'Invalid request id', 400)
  const reqDoc = await MembershipRequest.findById(id)
  if (!reqDoc) throw error('not_found', 'Talep bulunamadı', 404)
  if (reqDoc.status !== 'pending') throw error('invalid_state', 'Talep beklemiyor', 409)
  const now = new Date()
  reqDoc.status = 'rejected'
  reqDoc.decidedBy = actorUserId
  reqDoc.decidedAt = now
  reqDoc.decisionNote = String(decisionNote || '').trim()
  await reqDoc.save()
  await auditLog(String(reqDoc.tenantId), actorUserId || null, 'membership_request_rejected', 'MembershipRequest', String(reqDoc._id), {})
  return { success: true }
}
