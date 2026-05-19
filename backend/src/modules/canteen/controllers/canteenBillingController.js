import mongoose from 'mongoose'
import { sendError, error } from '../../../utils/errors.js'
import MembershipRequest from '../../../models/MembershipRequest.js'
import Plan from '../../../models/Plan.js'
import Tenant from '../../../models/Tenant.js'
import { ensurePlanMatchesTenant } from '../../../services/planService.js'
import { buildPlanTypeMatchQuery, normalizeSystemType } from '../../../utils/systemType.js'

const toPublic = (r) => {
  if (!r) return null
  const planDoc = r.requestedPlanId && typeof r.requestedPlanId === 'object'
    ? r.requestedPlanId
    : null
  const snap = r.requestedPlanSnapshot && typeof r.requestedPlanSnapshot === 'object' ? r.requestedPlanSnapshot : null
  return {
    id: String(r._id || ''),
    tenantId: String(r.tenantId || ''),
    requestedPlanId: planDoc ? String(planDoc._id || '') : (r.requestedPlanId ? String(r.requestedPlanId) : ''),
    requestedPlanName: String(planDoc?.name || snap?.name || r.requestedPlan || ''),
    requestedPlanPrice: Number(planDoc?.price ?? snap?.price ?? 0),
    requestedPlanSystemType: String(planDoc?.systemType || snap?.systemType || ''),
    requestedPlanSnapshot: snap,
    requestedLimits: r.requestedLimits || null,
    note: String(r.note || ''),
    status: String(r.status || ''),
    createdBy: r.createdBy ? { id: String(r.createdBy._id || r.createdBy || ''), name: String(r.createdBy.name || '') } : null,
    createdAt: r.createdAt || null,
    updatedAt: r.updatedAt || null,
    decidedBy: r.decidedBy ? { id: String(r.decidedBy._id || r.decidedBy || ''), name: String(r.decidedBy.name || '') } : null,
    decidedAt: r.decidedAt || null,
    decisionNote: String(r.decisionNote || '')
  }
}

export const listRequests = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId
    if (!tenantId) throw error('tenant_required', 'Tenant required', 403)
    const items = await MembershipRequest
      .find({ tenantId })
      .sort({ createdAt: -1 })
      .populate('requestedPlanId', 'name price systemType packageType isTrial')
      .populate('createdBy', 'name')
      .populate('decidedBy', 'name')
      .lean()
    res.json({ success: true, items: (items || []).map(toPublic) })
  } catch (err) {
    sendError(res, err)
  }
}

export const createRequest = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId
    const actorUserId = req.user?.id
    if (!tenantId) throw error('tenant_required', 'Tenant required', 403)
    if (!actorUserId) throw error('unauthorized', 'Unauthorized', 401)
    const requestedPlanIdRaw = String(req.body?.requestedPlanId || '').trim()
    if (!mongoose.isValidObjectId(requestedPlanIdRaw)) throw error('invalid_request', 'requestedPlanId zorunlu', 400)

    const tenant = await Tenant.findById(tenantId).lean()
    if (!tenant) throw error('tenant_required', 'Tenant required', 403)

    const plan = await Plan.findOne({ _id: requestedPlanIdRaw, isActive: true }).lean()
    if (!plan) throw error('not_found', 'Plan bulunamadi', 404)
    if (plan.isTrial) throw error('invalid_plan', 'Deneme paketi talep edilemez', 400)
    ensurePlanMatchesTenant(tenant, plan)

    const hasPending = await MembershipRequest.exists({ tenantId, status: 'pending' })
    if (hasPending) throw error('pending_request_exists', 'Beklemede bir talebiniz var', 409)

    const rawLimits = req.body?.requestedLimits
    const requestedLimits = rawLimits && typeof rawLimits === 'object' && !Array.isArray(rawLimits) ? rawLimits : null
    const note = String(req.body?.note || '').trim()

    const doc = await MembershipRequest.create({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      requestedPlanId: new mongoose.Types.ObjectId(requestedPlanIdRaw),
      requestedPlanSnapshot: {
        name: String(plan.name || ''),
        price: Number(plan.price || 0),
        limits: plan.limits || null,
        features: plan.features || null,
        systemType: String(plan.systemType || '')
      },
      requestedLimits,
      note,
      status: 'pending',
      createdBy: new mongoose.Types.ObjectId(actorUserId)
    })

    const populated = await MembershipRequest
      .findById(doc._id)
      .populate('requestedPlanId', 'name price systemType packageType isTrial')
      .populate('createdBy', 'name')
      .populate('decidedBy', 'name')
      .lean()
    res.json({ success: true, item: toPublic(populated) })
  } catch (err) {
    sendError(res, err)
  }
}

export const cancelRequest = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId
    const actorUserId = req.user?.id
    if (!tenantId) throw error('tenant_required', 'Tenant required', 403)
    if (!actorUserId) throw error('unauthorized', 'Unauthorized', 401)
    const id = String(req.params?.id || '').trim()
    if (!mongoose.isValidObjectId(id)) throw error('invalid_request', 'Invalid request id', 400)

    const current = await MembershipRequest.findOne({ _id: id, tenantId }).lean()
    if (!current) throw error('not_found', 'Talep bulunamadi', 404)
    if (String(current.status) !== 'pending') throw error('invalid_status', 'Sadece beklemedeki talepler iptal edilebilir', 400)

    await MembershipRequest.updateOne(
      { _id: id, tenantId, status: 'pending' },
      {
        $set: {
          status: 'cancelled',
          decidedBy: new mongoose.Types.ObjectId(actorUserId),
          decidedAt: new Date(),
          decisionNote: 'Iptal edildi'
        }
      }
    )

    const updated = await MembershipRequest
      .findById(id)
      .populate('requestedPlanId', 'name price systemType packageType isTrial')
      .populate('createdBy', 'name')
      .populate('decidedBy', 'name')
      .lean()
    res.json({ success: true, item: toPublic(updated) })
  } catch (err) {
    sendError(res, err)
  }
}

export const listPlans = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId
    if (!tenantId) throw error('tenant_required', 'Tenant required', 403)
    const tenant = await Tenant.findById(tenantId).lean()
    if (!tenant) throw error('tenant_required', 'Tenant required', 403)
    const normalizedType = normalizeSystemType(tenant.vertical || tenant.businessType || tenant.systemType, 'canteen')
    const list = await Plan.find({
      $and: [
        { isActive: true, isTrial: { $ne: true } },
        { $or: buildPlanTypeMatchQuery(normalizedType) }
      ]
    }).setOptions({ strictQuery: false }).sort({ createdAt: -1 }).lean()
    const items = (list || []).map(p => ({
      id: String(p._id || ''),
      name: String(p.name || ''),
      price: Number(p.price || 0),
      limits: p.limits || null,
      features: p.features || null,
      trialDays: Number(p.trialDays || 0),
      systemType: String(p.systemType || ''),
      packageType: String(p.packageType || '')
    }))
    res.json({ success: true, items })
  } catch (err) {
    sendError(res, err)
  }
}
