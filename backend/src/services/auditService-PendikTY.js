import mongoose from 'mongoose'
import AuditLog from '../models/AuditLog.js'

export const log = async (tenantId, actorUserId, action, entityType, entityId, meta = {}) => {
  const clean = { tenantId, actorUserId, action, entityType, meta }
  if (entityId !== undefined && entityId !== null && entityId !== '') {
    if (mongoose.isValidObjectId(entityId)) {
      clean.entityId = entityId
    }
  }
  await AuditLog.create(clean)
}

export const list = async (tenantId, query = {}) => {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 20))
  const filter = { tenantId }
  if (query.action) filter.action = query.action
  if (query.actorUserId) filter.actorUserId = query.actorUserId
  if (query.from || query.to) {
    filter.createdAt = {}
    if (query.from) filter.createdAt.$gte = new Date(query.from)
    if (query.to) filter.createdAt.$lte = new Date(query.to)
  }
  const total = await AuditLog.countDocuments(filter)
  const items = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('actorUserId', 'name email')
    .lean()
  return {
    items: items.map(a => {
      const actor = a?.actorUserId && typeof a.actorUserId === 'object' ? a.actorUserId : null
      const rawActorId = actor?._id ?? a?.actorUserId ?? null
      return {
        id: String(a?._id || a?.id || ''),
        action: a?.action,
        entityType: a?.entityType,
        entityId: a?.entityId ?? null,
        actorUserId: rawActorId != null ? String(rawActorId) : null,
        actorUser: actor
          ? {
              id: String(actor._id),
              name: String(actor.name || ''),
              email: String(actor.email || '')
            }
          : null,
        meta: a?.meta,
        createdAt: a?.createdAt
      }
    }),
    page,
    limit,
    total
  }
}
