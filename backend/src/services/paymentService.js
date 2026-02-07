import { error } from '../utils/errors.js'
import { findPlanById } from '../repositories/planRepository.js'
import { findTenantById, updateById as updateTenantById } from '../repositories/tenantRepository.js'
import { log as auditLog } from './auditService.js'
import { getPlanStatus, pickDefaultPlan } from './planService.js'
import PaymentRequest from '../models/PaymentRequest.js'

export const fakePaymentAndActivatePlan = async ({ tenantId, planId, actorUserId }) => {
  const plan = await findPlanById(planId)
  if (!plan || !plan.isActive) throw error('plan_inactive', 'Plan aktif değil', 400)
  const tenant = await findTenantById(tenantId)
  if (!tenant || !tenant.isActive) throw error('tenant_inactive', 'Üye pasif', 403)
  const now = new Date()
  const endsAt = plan.trialDays && plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000) : null
  const updated = await updateTenantById(tenantId, { planId: plan.id, planStartedAt: now, planEndsAt: endsAt, status: 'active' })
  await auditLog(tenantId, actorUserId || null, 'payment_fake_success', 'Plan', plan.id, { planId: plan.id })
  await auditLog(tenantId, actorUserId || null, 'uye_plan_degisti', 'Tenant', tenantId, { planId: plan.id })
  return { success: true, message: 'Paket başarıyla aktif edildi.' }
}

export const createPaymentRequestService = async (tenantId, actorUserId, planId) => {
  const plan = await findPlanById(planId)
  if (!plan || !plan.isActive) throw error('plan_inactive', 'Plan aktif değil', 400)
  const tenant = await findTenantById(tenantId)
  if (!tenant || !tenant.isActive) throw error('tenant_inactive', 'Üye pasif', 403)
  const existingPending = await PaymentRequest.exists({ tenantId, status: 'pending' })
  if (existingPending) throw error('request_exists', 'Onay bekleyen talebiniz var', 400)
  const pr = await PaymentRequest.create({ tenantId, planId: plan.id, amount: Number(plan.price || 0), method: 'bank_transfer', status: 'pending', createdBy: actorUserId })
  await auditLog(tenantId, actorUserId || null, 'odeme_talebi_olusturuldu', 'PaymentRequest', pr.id, { planId: plan.id, amount: Number(plan.price || 0) })
  return { success: true, message: 'Ödeme talebiniz oluşturuldu. Onay sonrası paketiniz aktif edilecektir.' }
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
  if (!r) throw error('not_found', 'Talep bulunamadı', 404)
  if (r.status !== 'pending') throw error('invalid_state', 'Talep beklemiyor', 400)
  const plan = await findPlanById(r.planId)
  if (!plan || !plan.isActive) throw error('plan_inactive', 'Plan aktif değil', 400)
  const now = new Date()
  const endsAt = plan.trialDays && plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000) : null
  const updatedTenant = await updateTenantById(r.tenantId, { planId: plan.id, planStartedAt: now, planEndsAt: endsAt, status: 'active' })
  await PaymentRequest.findByIdAndUpdate(id, { status: 'approved' }, { new: true })
  await auditLog(r.tenantId, actorUserId || null, 'odeme_onaylandi', 'PaymentRequest', id, { planId: plan.id })
  await auditLog(r.tenantId, actorUserId || null, 'uye_plan_degisti', 'Tenant', r.tenantId, { planId: plan.id })
  return { success: true, tenantId: r.tenantId, planId: plan.id }
}

export const rejectPaymentRequestService = async (id, actorUserId) => {
  const r = await PaymentRequest.findById(id)
  if (!r) throw error('not_found', 'Talep bulunamadı', 404)
  if (r.status !== 'pending') throw error('invalid_state', 'Talep beklemiyor', 400)
  await PaymentRequest.findByIdAndUpdate(id, { status: 'rejected' }, { new: true })
  await auditLog(r.tenantId, actorUserId || null, 'odeme_reddedildi', 'PaymentRequest', id, {})
  return { success: true }
}
