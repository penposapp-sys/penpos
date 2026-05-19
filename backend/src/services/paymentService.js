import { error } from '../utils/errors.js'
import { findPlanById } from '../repositories/planRepository.js'
import { findTenantById, updateById as updateTenantById } from '../repositories/tenantRepository.js'
import { log as auditLog } from './auditService.js'
import { ensurePlanMatchesTenant, getPlanStatus } from './planService.js'
import PaymentRequest from '../models/PaymentRequest.js'

export const fakePaymentAndActivatePlan = async ({ tenantId, planId, actorUserId }) => {
  const plan = await findPlanById(planId)
  if (!plan || !plan.isActive) throw error('plan_inactive', 'Plan aktif degil', 400)
  const tenant = await findTenantById(tenantId)
  if (!tenant || !tenant.isActive) throw error('tenant_inactive', 'Uye pasif', 403)
  ensurePlanMatchesTenant(tenant, plan)
  const now = new Date()
  const endsAt = plan.trialDays && plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000) : null
  await updateTenantById(tenantId, { planId: plan.id, packageId: plan.id, planStartedAt: now, planEndsAt: endsAt, trialStartsAt: plan.isTrial ? now : null, trialEndsAt: plan.isTrial ? endsAt : null, subscriptionStatus: plan.isTrial ? 'trial' : 'active', status: 'active' })
  await auditLog(tenantId, actorUserId || null, 'payment_fake_success', 'Plan', plan.id, { planId: plan.id })
  await auditLog(tenantId, actorUserId || null, 'uye_plan_degisti', 'Tenant', tenantId, { planId: plan.id })
  return { success: true, message: 'Paket basariyla aktif edildi.' }
}

export const createPaymentRequestService = async (tenantId, actorUserId, planId) => {
  const plan = await findPlanById(planId)
  if (!plan || !plan.isActive) throw error('plan_inactive', 'Plan aktif degil', 400)
  if (plan.isTrial) throw error('invalid_plan', 'Deneme paketi satin alma akisinda kullanilamaz', 400)
  const tenant = await findTenantById(tenantId)
  if (!tenant || !tenant.isActive) throw error('tenant_inactive', 'Uye pasif', 403)
  ensurePlanMatchesTenant(tenant, plan)
  const existingPending = await PaymentRequest.exists({ tenantId, status: 'pending' })
  if (existingPending) throw error('request_exists', 'Onay bekleyen talebiniz var', 400)
  const pr = await PaymentRequest.create({ tenantId, planId: plan.id, amount: Number(plan.price || 0), method: 'bank_transfer', status: 'pending', createdBy: actorUserId })
  await auditLog(tenantId, actorUserId || null, 'odeme_talebi_olusturuldu', 'PaymentRequest', pr.id, { planId: plan.id, amount: Number(plan.price || 0) })
  return { success: true, message: 'Odeme talebiniz olusturuldu. Onay sonrasi paketiniz aktif edilecektir.' }
}

export const listPaymentRequestsService = async () => {
  const list = await PaymentRequest.find({}).sort({ createdAt: -1 })
  const items = []
  for (const r of list) {
    let tenantName = null
    let planName = null
    try {
      const t = await findTenantById(r.tenantId)
      tenantName = t?.name || null
    } catch {}
    try {
      const p = await findPlanById(r.planId)
      planName = p?.name || null
    } catch {}
    items.push({
      id: r.id,
      tenantId: r.tenantId,
      tenantName,
      planId: r.planId,
      planName,
      amount: r.amount,
      method: r.method,
      status: r.status,
      createdBy: r.createdBy,
      createdAt: r.createdAt
    })
  }
  return { requests: items }
}

export const approvePaymentRequestService = async (id, actorUserId) => {
  const r = await PaymentRequest.findById(id)
  if (!r) throw error('not_found', 'Talep bulunamadi', 404)
  if (r.status !== 'pending') throw error('invalid_state', 'Talep beklemiyor', 400)
  const plan = await findPlanById(r.planId)
  if (!plan || !plan.isActive) throw error('plan_inactive', 'Plan aktif degil', 400)
  const tenant = await findTenantById(r.tenantId)
  if (!tenant) throw error('not_found', 'Tenant not found', 404)
  ensurePlanMatchesTenant(tenant, plan)
  const now = new Date()
  const endsAt = plan.trialDays && plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000) : null
  await updateTenantById(r.tenantId, { planId: plan.id, packageId: plan.id, planStartedAt: now, planEndsAt: endsAt, trialStartsAt: plan.isTrial ? now : null, trialEndsAt: plan.isTrial ? endsAt : null, subscriptionStatus: plan.isTrial ? 'trial' : 'active', status: 'active' })
  await PaymentRequest.findByIdAndUpdate(id, { status: 'approved' }, { new: true })
  await auditLog(r.tenantId, actorUserId || null, 'odeme_onaylandi', 'PaymentRequest', id, { planId: plan.id })
  await auditLog(r.tenantId, actorUserId || null, 'uye_plan_degisti', 'Tenant', r.tenantId, { planId: plan.id })
  return { success: true, tenantId: r.tenantId, planId: plan.id }
}

export const rejectPaymentRequestService = async (id, actorUserId) => {
  const r = await PaymentRequest.findById(id)
  if (!r) throw error('not_found', 'Talep bulunamadi', 404)
  if (r.status !== 'pending') throw error('invalid_state', 'Talep beklemiyor', 400)
  await PaymentRequest.findByIdAndUpdate(id, { status: 'rejected' }, { new: true })
  await auditLog(r.tenantId, actorUserId || null, 'odeme_reddedildi', 'PaymentRequest', id, {})
  return { success: true }
}

export { getPlanStatus }
