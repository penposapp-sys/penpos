import mongoose from 'mongoose'
import { error } from '../utils/errors.js'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import * as printerRepo from '../repositories/printPrinterRepository.js'
import * as profileRepo from '../repositories/printProfileRepository.js'
import * as stationRepo from '../repositories/printStationRepository.js'
import * as jobRepo from '../repositories/printJobRepository.js'

export const normalizeSystem = (value) => {
  const v = String(value || '').trim().toLowerCase()
  return v === 'canteen' ? 'canteen' : 'kermes'
}

const logicalPrinterNameByType = (typeOrCode) => {
  const v = String(typeOrCode || '').trim().toLowerCase()
  if (v === 'label') return 'Etiket Yazıcısı'
  if (v === 'receipt') return 'Fiş Yazıcısı'
  return ''
}

const toPositiveNumberOrNull = (value, fallback = null) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

const normalizeReceiptUsage = (entry = {}) => {
  const rawCashier = entry?.useForCashierReceipt
  const rawKitchen = entry?.useForKitchenReceipt
  if (typeof rawCashier === 'boolean' || typeof rawKitchen === 'boolean') {
    return {
      useForCashierReceipt: rawCashier === true,
      useForKitchenReceipt: rawKitchen === true
    }
  }
  const receiptRole = String(entry?.receiptRole || '').trim().toLowerCase()
  if (receiptRole === 'kitchen') {
    return { useForCashierReceipt: false, useForKitchenReceipt: true }
  }
  return { useForCashierReceipt: true, useForKitchenReceipt: false }
}

const normalizeStationPrinters = (value) => {
  const src = Array.isArray(value) ? value : []
  const out = []
  for (const entry of src) {
    if (!entry || typeof entry !== 'object') continue
    const name = String(entry.name || '').trim()
    const printerType = String(entry.printerType || '').trim().toLowerCase()
    const windowsPrinterName = String(entry.windowsPrinterName || '').trim()
    if (!name || !windowsPrinterName) continue
    if (!['receipt', 'label'].includes(printerType)) continue
    const rawCategoryIds = Array.isArray(entry.labelCategoryIds) ? entry.labelCategoryIds : []
    const labelCategoryIds = rawCategoryIds
      .map(String)
      .filter(mongoose.isValidObjectId)
      .map((id) => new mongoose.Types.ObjectId(id))
    const rawReceiptCategoryIds = Array.isArray(entry.categoryIds) ? entry.categoryIds : []
    const categoryIds = rawReceiptCategoryIds
      .map(String)
      .filter(mongoose.isValidObjectId)
      .map((id) => new mongoose.Types.ObjectId(id))
    const receiptRole = String(entry.receiptRole || '').trim().toLowerCase() === 'kitchen' ? 'kitchen' : 'cashier'
    const { useForCashierReceipt, useForKitchenReceipt } = normalizeReceiptUsage(entry)
    out.push({
      _id: entry._id && mongoose.isValidObjectId(String(entry._id)) ? new mongoose.Types.ObjectId(String(entry._id)) : new mongoose.Types.ObjectId(),
      name,
      printerType,
      windowsPrinterName,
      isActive: entry.isActive !== false,
      labelCategoryIds,
      categoryIds,
      receiptRole,
      useForCashierReceipt,
      useForKitchenReceipt,
      autoPrintOnOrder: entry.autoPrintOnOrder === true,
      printOnReady: entry.printOnReady === true,
      widthMm: printerType === 'label' ? toPositiveNumberOrNull(entry.widthMm) : null,
      heightMm: printerType === 'label' ? toPositiveNumberOrNull(entry.heightMm) : null,
      receiptWidthMm: printerType === 'receipt' ? toPositiveNumberOrNull(entry.receiptWidthMm, 80) : null,
      copies: Math.max(1, Math.min(10, Number(entry.copies || 1) || 1))
    })
  }
  return out
}

const mapStationPrinter = (entry) => ({
  id: String(entry?._id || ''),
  name: String(entry?.name || ''),
  printerType: String(entry?.printerType || ''),
  windowsPrinterName: String(entry?.windowsPrinterName || ''),
  isActive: entry?.isActive !== false,
  labelCategoryIds: Array.isArray(entry?.labelCategoryIds) ? entry.labelCategoryIds.map(String) : [],
  categoryIds: Array.isArray(entry?.categoryIds) ? entry.categoryIds.map(String) : [],
  receiptRole: String(entry?.receiptRole || '').trim().toLowerCase() === 'kitchen' ? 'kitchen' : 'cashier',
  useForCashierReceipt: normalizeReceiptUsage(entry).useForCashierReceipt,
  useForKitchenReceipt: normalizeReceiptUsage(entry).useForKitchenReceipt,
  autoPrintOnOrder: entry?.autoPrintOnOrder === true,
  printOnReady: entry?.printOnReady === true,
  widthMm: toPositiveNumberOrNull(entry?.widthMm),
  heightMm: toPositiveNumberOrNull(entry?.heightMm),
  receiptWidthMm: toPositiveNumberOrNull(entry?.receiptWidthMm, 80),
  copies: Math.max(1, Math.min(10, Number(entry?.copies || 1) || 1))
})

export const resolveStationPrinterConfig = ({ station, jobType, jobMeta, triggerMode = '' }) => {
  const printers = Array.isArray(station?.printers) ? station.printers : []
  const activePrinters = printers.filter((entry) => entry && entry.isActive !== false)
  if (activePrinters.length === 0) return null
  const explicitStationPrinterId = String(jobMeta?.stationPrinterId || '').trim()
  if (explicitStationPrinterId) {
    const exact = activePrinters.find((entry) => String(entry?._id || entry?.id || '') === explicitStationPrinterId)
    if (exact) return exact
  }

  if (jobType === 'receipt') {
    const receiptRole = String(jobMeta?.receiptRole || '').trim().toLowerCase() === 'kitchen' ? 'kitchen' : 'cashier'
    const receiptPrinters = activePrinters.filter((entry) => entry.printerType === 'receipt')
    if (receiptPrinters.length === 0) return null

    const roleMatched = receiptPrinters.filter((entry) => {
      const usage = normalizeReceiptUsage(entry)
      return receiptRole === 'kitchen' ? usage.useForKitchenReceipt === true : usage.useForCashierReceipt === true
    })
    if (receiptRole !== 'kitchen') {
      return roleMatched[0] || null
    }

    const categoryIds = Array.isArray(jobMeta?.categoryIds)
      ? jobMeta.categoryIds.map(String).filter(Boolean)
      : (jobMeta?.categoryId ? [String(jobMeta.categoryId)] : [])

    const specificMatch = roleMatched.find((entry) => {
      const printerCategories = Array.isArray(entry?.categoryIds) ? entry.categoryIds.map(String).filter(Boolean) : []
      if (printerCategories.length === 0) return false
      if (categoryIds.length === 0) return false
      return categoryIds.some((id) => printerCategories.includes(id))
    })
    if (specificMatch) return specificMatch
    return roleMatched.find((entry) => {
      const printerCategories = Array.isArray(entry?.categoryIds) ? entry.categoryIds.map(String).filter(Boolean) : []
      return printerCategories.length === 0
    }) || roleMatched[0] || null
  }

  if (jobType !== 'label') return null

  const categoryId = String(jobMeta?.categoryId || '').trim()
  const labelPrinters = activePrinters.filter((entry) => entry.printerType === 'label')
  if (labelPrinters.length === 0) return null

  const candidates = labelPrinters.filter((entry) => {
    if (triggerMode === 'order_send' && entry.autoPrintOnOrder !== true) return false
    if (triggerMode === 'item_ready' && entry.printOnReady !== true) return false
    const categories = Array.isArray(entry.labelCategoryIds) ? entry.labelCategoryIds.map(String) : []
    if (!categoryId) return true
    return categories.length === 0 || categories.includes(categoryId)
  })
  return candidates[0] || null
}

export const resolveActiveStationForJob = async ({ tenantId, system, jobType, jobMeta, preferredStationId = '' }) => {
  const preferredId = String(preferredStationId || '').trim()
  if (preferredId && mongoose.isValidObjectId(preferredId)) {
    const preferred = await stationRepo.findByIdAndScope(preferredId, tenantId, system)
    if (preferred && preferred.isActive === true) return preferred
  }

  const activeStations = await stationRepo.listActiveByTenantAndSystem(tenantId, system)
  const list = Array.isArray(activeStations) ? activeStations : []
  if (list.length === 0) return null

  for (const station of list) {
    const printer = resolveStationPrinterConfig({
      station,
      jobType,
      jobMeta,
      triggerMode: String(jobMeta?.triggerMode || '')
    })
    if (printer) return station
  }

  return list[0] || null
}

const resolveProfilePrinter = async (tenantId, system, profile, typeOrCode) => {
  const printerId = String(profile?.printerId || '').trim()
  let printer = null
  if (printerId && mongoose.isValidObjectId(printerId)) {
    printer = await printerRepo.findByIdAndScope(printerId, tenantId, system)
  }
  if (printer) return { profile, printer }

  const logicalName = logicalPrinterNameByType(typeOrCode || profile?.code)
  if (!logicalName) return { profile, printer: null }
  const fallbackPrinter = await printerRepo.findByNameAndScope(logicalName, tenantId, system)
  if (!fallbackPrinter) return { profile, printer: null }

  const repairedProfile = await profileRepo.updateByIdAndScope(
    String(profile.id || profile._id || ''),
    tenantId,
    system,
    { printerId: fallbackPrinter.id }
  )
  return { profile: repairedProfile || profile, printer: fallbackPrinter }
}

export const listPrinters = async (tenantId, system) => {
  const items = await printerRepo.listByTenantAndSystem(tenantId, system)
  return (items || []).map(p => ({
    id: String(p.id),
    name: String(p.name || ''),
    windowsPrinterName: String(p.windowsPrinterName || ''),
    isActive: p.isActive !== false
  }))
}

export const createPrinter = async (tenantId, system, input) => {
  const name = String(input?.name || '').trim()
  const windowsPrinterName = String(input?.windowsPrinterName || '').trim()
  if (!name) throw error('name_required', 'Yazıcı adı zorunlu', 400)
  if (!windowsPrinterName) throw error('printer_required', 'Windows yazıcı seçimi zorunlu', 400)
  const created = await printerRepo.create({ tenantId, system, name, windowsPrinterName, isActive: input?.isActive !== false })
  return { id: String(created.id), name: created.name, windowsPrinterName: created.windowsPrinterName, isActive: created.isActive !== false }
}

export const updatePrinter = async (tenantId, system, id, input) => {
  if (!mongoose.isValidObjectId(String(id || ''))) throw error('invalid_request', 'Invalid printer id', 400)
  const update = {}
  if (input?.name !== undefined) {
    const name = String(input?.name || '').trim()
    if (!name) throw error('name_required', 'Yazıcı adı zorunlu', 400)
    update.name = name
  }
  if (input?.windowsPrinterName !== undefined) {
    const windowsPrinterName = String(input?.windowsPrinterName || '').trim()
    if (!windowsPrinterName) throw error('printer_required', 'Windows yazıcı seçimi zorunlu', 400)
    update.windowsPrinterName = windowsPrinterName
  }
  if (input?.isActive !== undefined) update.isActive = input?.isActive === true
  const updated = await printerRepo.updateByIdAndScope(id, tenantId, system, update)
  if (!updated) throw error('not_found', 'Yazıcı bulunamadı', 404)
  return { id: String(updated.id), name: updated.name, windowsPrinterName: updated.windowsPrinterName, isActive: updated.isActive !== false }
}

export const listProfiles = async (tenantId, system) => {
  const items = await profileRepo.listByTenantAndSystem(tenantId, system)
  return (items || []).map(p => ({
    id: String(p.id),
    code: String(p.code || ''),
    name: String(p.name || ''),
    printerId: String(p.printerId || ''),
    payloadType: String(p.payloadType || 'raw'),
    options: p.options || {},
    isActive: p.isActive !== false
  }))
}

export const createProfile = async (tenantId, system, input) => {
  const name = String(input?.name || '').trim()
  const code = String(input?.code || '').trim()
  const printerId = String(input?.printerId || '').trim()
  const payloadType = String(input?.payloadType || 'raw').trim()
  if (!name) throw error('name_required', 'Profil adı zorunlu', 400)
  if (!mongoose.isValidObjectId(printerId)) throw error('invalid_request', 'Invalid printerId', 400)
  const prn = await printerRepo.findByIdAndScope(printerId, tenantId, system)
  if (!prn) throw error('not_found', 'Yazıcı bulunamadı', 404)
  const created = await profileRepo.create({
    tenantId,
    system,
    code,
    name,
    printerId,
    payloadType: ['raw', 'html', 'pdf_base64'].includes(payloadType) ? payloadType : 'raw',
    options: input?.options && typeof input.options === 'object' ? input.options : {},
    isActive: input?.isActive !== false
  })
  return {
    id: String(created.id),
    code: String(created.code || ''),
    name: created.name,
    printerId: String(created.printerId),
    payloadType: created.payloadType,
    options: created.options || {},
    isActive: created.isActive !== false
  }
}

export const updateProfile = async (tenantId, system, id, input) => {
  if (!mongoose.isValidObjectId(String(id || ''))) throw error('invalid_request', 'Invalid profile id', 400)
  const update = {}
  if (input?.code !== undefined) update.code = String(input?.code || '').trim()
  if (input?.name !== undefined) {
    const name = String(input?.name || '').trim()
    if (!name) throw error('name_required', 'Profil adı zorunlu', 400)
    update.name = name
  }
  if (input?.printerId !== undefined) {
    const printerId = String(input?.printerId || '').trim()
    if (!mongoose.isValidObjectId(printerId)) throw error('invalid_request', 'Invalid printerId', 400)
    const prn = await printerRepo.findByIdAndScope(printerId, tenantId, system)
    if (!prn) throw error('not_found', 'Yazıcı bulunamadı', 404)
    update.printerId = printerId
  }
  if (input?.payloadType !== undefined) {
    const payloadType = String(input?.payloadType || 'raw').trim()
    update.payloadType = ['raw', 'html', 'pdf_base64'].includes(payloadType) ? payloadType : 'raw'
  }
  if (input?.options !== undefined) update.options = input?.options && typeof input.options === 'object' ? input.options : {}
  if (input?.isActive !== undefined) update.isActive = input?.isActive === true
  const updated = await profileRepo.updateByIdAndScope(id, tenantId, system, update)
  if (!updated) throw error('not_found', 'Profil bulunamadı', 404)
  return {
    id: String(updated.id),
    code: String(updated.code || ''),
    name: updated.name,
    printerId: String(updated.printerId),
    payloadType: updated.payloadType,
    options: updated.options || {},
    isActive: updated.isActive !== false
  }
}

export const listStations = async (tenantId, system) => {
  const items = await stationRepo.listByTenantAndSystem(tenantId, system)
  return (items || []).map(s => ({
    id: String(s.id),
    name: String(s.name || ''),
    branchId: s.branchId ? String(s.branchId) : null,
    assignedProfileIds: Array.isArray(s.assignedProfileIds) ? s.assignedProfileIds.map(String) : [],
    isActive: s.isActive === true,
    lastHeartbeatAt: s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).toISOString() : null,
    lastHeartbeatMeta: {
      hostname: String(s.lastHeartbeatMeta?.hostname || ''),
      version: String(s.lastHeartbeatMeta?.version || ''),
      printersCount: Array.isArray(s.lastHeartbeatMeta?.printers) ? s.lastHeartbeatMeta.printers.length : 0,
      printers: Array.isArray(s.lastHeartbeatMeta?.printers) ? s.lastHeartbeatMeta.printers.map(String) : []
    },
    printers: Array.isArray(s.printers) ? s.printers.map(mapStationPrinter) : []
  }))
}

export const listStationPrinters = async (tenantId, system, stationId) => {
  if (!mongoose.isValidObjectId(String(stationId || ''))) throw error('invalid_request', 'Invalid station id', 400)
  const st = await stationRepo.findByIdAndScope(stationId, tenantId, system)
  if (!st) throw error('not_found', 'İstasyon bulunamadı', 404)
  const raw = st.lastHeartbeatMeta && typeof st.lastHeartbeatMeta === 'object' ? st.lastHeartbeatMeta.printers : null
  const list = Array.isArray(raw) ? raw.map(String).filter(Boolean) : []
  return list
}

export const createStation = async (tenantId, system, input) => {
  const name = String(input?.name || '').trim()
  const existing = await stationRepo.findByNameAndScope(name, tenantId, system)
  if (existing) throw error('duplicate_station_name', 'Bu istasyon adı zaten kayıtlı', 409)
  if (!name) throw error('name_required', 'İstasyon adı zorunlu', 400)
  const branchIdRaw = input?.branchId === undefined || input?.branchId === null ? null : String(input.branchId).trim()
  const branchId = branchIdRaw && mongoose.isValidObjectId(branchIdRaw) ? new mongoose.Types.ObjectId(branchIdRaw) : null
  const assignedProfileIds = Array.isArray(input?.assignedProfileIds)
    ? input.assignedProfileIds.map(String).filter(mongoose.isValidObjectId).map(id => new mongoose.Types.ObjectId(id))
    : []
  const printers = normalizeStationPrinters(input?.printers)
  const secret = crypto.randomBytes(24).toString('base64url')
  const secretHash = await bcrypt.hash(secret, 10)
  const created = await stationRepo.create({
    tenantId,
    system,
    name,
    secretHash,
    branchId,
    assignedProfileIds,
    isActive: input?.isActive === true,
    lastHeartbeatAt: null,
    lastHeartbeatMeta: { hostname: '', version: '', printers: [] },
    lastSeenAt: null,
    lastSeenMeta: {},
    printers
  })
  return {
    id: String(created.id),
    name: created.name,
    branchId: created.branchId ? String(created.branchId) : null,
    assignedProfileIds: Array.isArray(created.assignedProfileIds) ? created.assignedProfileIds.map(String) : [],
    isActive: created.isActive === true,
    lastHeartbeatAt: created.lastHeartbeatAt ? new Date(created.lastHeartbeatAt).toISOString() : null,
    printers: Array.isArray(created.printers) ? created.printers.map(mapStationPrinter) : [],
    stationSecret: secret
  }
}

export const updateStation = async (tenantId, system, id, input) => {
  if (!mongoose.isValidObjectId(String(id || ''))) throw error('invalid_request', 'Invalid station id', 400)
  const update = {}
  if (input?.name !== undefined) {
    const name = String(input?.name || '').trim()
    if (!name) throw error('name_required', 'İstasyon adı zorunlu', 400)
    update.name = name
  }
  if (input?.branchId !== undefined) {
    const branchIdRaw = input?.branchId === null ? null : String(input?.branchId || '').trim()
    update.branchId = branchIdRaw && mongoose.isValidObjectId(branchIdRaw) ? new mongoose.Types.ObjectId(branchIdRaw) : null
  }
  if (input?.assignedProfileIds !== undefined) {
    const assignedProfileIds = Array.isArray(input?.assignedProfileIds)
      ? input.assignedProfileIds.map(String).filter(mongoose.isValidObjectId).map(pid => new mongoose.Types.ObjectId(pid))
      : []
    update.assignedProfileIds = assignedProfileIds
  }
  if (input?.printers !== undefined) {
    update.printers = normalizeStationPrinters(input?.printers)
  }
  if (input?.isActive !== undefined) update.isActive = input?.isActive === true
  if (input?.lastSeenMeta !== undefined) update.lastSeenMeta = input?.lastSeenMeta && typeof input.lastSeenMeta === 'object' ? input.lastSeenMeta : {}
  if (input?.touch === true) update.lastSeenAt = new Date()
  const updated = await stationRepo.updateByIdAndScope(id, tenantId, system, update)
  if (!updated) throw error('not_found', 'İstasyon bulunamadı', 404)
  return {
    id: String(updated.id),
    name: updated.name,
    branchId: updated.branchId ? String(updated.branchId) : null,
    assignedProfileIds: Array.isArray(updated.assignedProfileIds) ? updated.assignedProfileIds.map(String) : [],
    isActive: updated.isActive === true,
    lastSeenAt: updated.lastSeenAt ? new Date(updated.lastSeenAt).toISOString() : null,
    printers: Array.isArray(updated.printers) ? updated.printers.map(mapStationPrinter) : []
  }
}

export const rotateStationSecret = async (tenantId, system, id) => {
  if (!mongoose.isValidObjectId(String(id || ''))) throw error('invalid_request', 'Invalid station id', 400)
  const secret = crypto.randomBytes(32).toString('base64url').slice(0, 48)
  const secretHash = await bcrypt.hash(secret, 10)
  const updated = await stationRepo.updateByIdAndScope(id, tenantId, system, { secretHash })
  if (!updated) throw error('not_found', 'İstasyon bulunamadı', 404)
  return { stationId: String(updated.id), secret }
}

export const deleteStation = async (tenantId, system, stationId) => {
  if (!mongoose.isValidObjectId(String(stationId || ''))) throw error('invalid_request', 'Invalid station id', 400)
  const st = await stationRepo.findByIdAndScope(stationId, tenantId, system)
  if (!st) throw error('not_found', 'İstasyon bulunamadı', 404)

  const lastError = { code: 'station_deleted', message: 'Station deleted' }
  await jobRepo.markLockedByStationFailed(tenantId, system, stationId, lastError)
  await jobRepo.unassignQueuedByStation(tenantId, system, stationId)
  await stationRepo.deleteByIdAndScope(stationId, tenantId, system)

  return { stationId: String(stationId) }
}

export const listJobs = async (tenantId, system, limit) => {
  const items = await jobRepo.listRecentByTenantAndSystem(tenantId, system, limit)
  return (items || []).map(j => ({
    id: String(j.id),
    type: String(j.type),
    stationId: j.stationId ? String(j.stationId) : '',
    profileId: String(j.profileId),
    status: String(j.status),
    payload: { type: String(j.payload?.type || 'raw'), content: String(j.payload?.content || '') },
    attempts: Number(j.attempts || 0),
    lastError: j.lastError || null,
    createdAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    updatedAt: j.updatedAt ? new Date(j.updatedAt).toISOString() : null
  }))
}

const ensureSystemProfileForType = async ({ tenantId, system, type, station }) => {
  const code = String(type || '').trim().toLowerCase()
  if (!['receipt', 'label'].includes(code)) throw error('invalid_request', 'Invalid type', 400)

  const profileName = code === 'receipt' ? 'Fiş' : 'Etiket'
  const logicalName = logicalPrinterNameByType(code)
  const stationPrinter = station
    ? resolveStationPrinterConfig({ station, jobType: code, jobMeta: {}, triggerMode: '' })
    : null
  const stationWindowsPrinterName = String(stationPrinter?.windowsPrinterName || '').trim()

  let printer = await printerRepo.findByNameAndScope(logicalName, tenantId, system)
  if (!printer && stationWindowsPrinterName) {
    printer = await printerRepo.create({
      tenantId,
      system,
      name: logicalName,
      windowsPrinterName: stationWindowsPrinterName,
      isActive: true
    })
  } else if (printer && stationWindowsPrinterName && String(printer.windowsPrinterName || '').trim() !== stationWindowsPrinterName) {
    printer = await printerRepo.updateByIdAndScope(printer.id, tenantId, system, {
      windowsPrinterName: stationWindowsPrinterName,
      isActive: true
    })
  } else if (printer && printer.isActive === false) {
    printer = await printerRepo.updateByIdAndScope(printer.id, tenantId, system, { isActive: true })
  }

  if (!printer) throw error('printer_missing', `${profileName} yazıcısı bulunamadı`, 400)

  const nextOptions = code === 'receipt'
    ? { widthMm: toPositiveNumberOrNull(stationPrinter?.receiptWidthMm, 80) || 80 }
    : {
        widthMm: toPositiveNumberOrNull(stationPrinter?.widthMm, 50) || 50,
        heightMm: toPositiveNumberOrNull(stationPrinter?.heightMm, 30) || 30
      }

  const existingProfile = await profileRepo.findByCodeAndScope(code, tenantId, system)
  if (existingProfile) {
    const updatedProfile = await profileRepo.updateByIdAndScope(existingProfile.id, tenantId, system, {
      name: String(existingProfile.name || '').trim() || profileName,
      printerId: printer.id,
      payloadType: existingProfile.payloadType || 'raw',
      options: { ...(existingProfile.options || {}), ...nextOptions },
      isActive: true
    })
    return updatedProfile || existingProfile
  }

  return await profileRepo.create({
    tenantId,
    system,
    code,
    name: profileName,
    printerId: printer.id,
    payloadType: 'raw',
    options: nextOptions,
    isActive: true
  })
}

export const createJob = async (tenantId, system, actorUserId, input) => {
  const type = String(input?.type || '').trim()
  const requestedProfileId = String(input?.profileId || '').trim()
  const stationIdRaw = String(input?.stationId || '').trim()
  const payloadType = String(input?.payload?.type || input?.payloadType || 'raw').trim()
  const payloadContent = String(input?.payload?.content || input?.payloadContent || '')
  if (!['receipt', 'label'].includes(type)) throw error('invalid_request', 'Invalid type', 400)

  let stationId = stationIdRaw
  let queuedWithoutStation = false
  if (stationId && !mongoose.isValidObjectId(stationId)) throw error('invalid_request', 'Invalid stationId', 400)
  if (!stationId) {
    const active = await resolveActiveStationForJob({
      tenantId,
      system,
      jobType: type,
      jobMeta: input?.meta || {}
    })
    if (!active) {
      stationId = null
      queuedWithoutStation = true
    } else {
      stationId = String(active.id)
    }
  }

  let st = null
  if (stationId) {
    st = await stationRepo.findByIdAndScope(stationId, tenantId, system)
    if (!st) throw error('not_found', 'İstasyon bulunamadı', 404)
    if (st.isActive !== true) throw error('station_inactive', 'Print Station aktif değil', 400)
  }

  let prf = null
  if (requestedProfileId) {
    if (!mongoose.isValidObjectId(requestedProfileId)) throw error('invalid_request', 'Invalid profileId', 400)
    prf = await profileRepo.findByIdAndScope(requestedProfileId, tenantId, system)
  } else {
    prf = await ensureSystemProfileForType({ tenantId, system, type, station: st })
  }
  if (!prf) throw error('not_found', 'Profil bulunamadı', 404)
  if (prf.isActive === false) {
    prf = await ensureSystemProfileForType({ tenantId, system, type, station: st })
  }

  const stationPrinter = st
    ? resolveStationPrinterConfig({ station: st, jobType: type, jobMeta: input?.meta || {}, triggerMode: String(input?.meta?.triggerMode || '') })
    : null
  const { profile: resolvedProfile, printer: profilePrinter } = await resolveProfilePrinter(tenantId, system, prf, type)
  if (!stationPrinter && !profilePrinter) {
    throw error('printer_missing', `Printer seçilmemiş: ${type}`, 400)
  }
  if (!stationPrinter && profilePrinter.isActive === false) {
    throw error('printer_inactive', `Yazıcı pasif: ${type}`, 400)
  }

  const created = await jobRepo.create({
    tenantId,
    system,
    type,
    stationId: st ? new mongoose.Types.ObjectId(String(st.id)) : null,
    profileId: new mongoose.Types.ObjectId(String((resolvedProfile?.id || prf.id))),
    status: 'queued',
    payload: {
      type: ['raw', 'html', 'pdf_base64'].includes(payloadType) ? payloadType : 'raw',
      content: payloadContent
    },
    meta: input?.meta && typeof input.meta === 'object' ? input.meta : {},
    attempts: 0,
    lockedByStationId: null,
    lockedAt: null,
    printedAt: null,
    lastError: null,
    createdByUserId: actorUserId && mongoose.isValidObjectId(String(actorUserId)) ? new mongoose.Types.ObjectId(String(actorUserId)) : null
  })
  return { id: String(created.id), status: created.status, queuedWithoutStation }
}

export const claimNextJob = async (tenantId, system, stationId, meta) => {
  if (!mongoose.isValidObjectId(String(stationId || ''))) throw error('invalid_request', 'Invalid station id', 400)
  const st = await stationRepo.findByIdAndScope(stationId, tenantId, system)
  if (!st) throw error('not_found', 'İstasyon bulunamadı', 404)
  if (st.isActive !== true) throw error('station_inactive', 'İstasyon aktif değil', 403)

  const job = await jobRepo.claimNext(tenantId, system, st.id)
  if (!job) return { job: null }
  const profile = await profileRepo.findByIdAndScope(job.profileId, tenantId, system)
  const printer = profile ? await printerRepo.findByIdAndScope(profile.printerId, tenantId, system) : null
  return {
    job: {
      id: String(job.id),
      type: String(job.type),
      status: String(job.status),
      stationId: job.stationId ? String(job.stationId) : '',
      profileId: String(job.profileId),
      payload: { type: String(job.payload?.type || 'raw'), content: String(job.payload?.content || '') },
      attempts: Number(job.attempts || 0),
      meta: job.meta || {}
    },
    profile: profile ? {
      id: String(profile.id),
      name: String(profile.name || ''),
      payloadType: String(profile.payloadType || 'raw'),
      options: profile.options || {},
      printerId: String(profile.printerId)
    } : null,
    printer: printer ? {
      id: String(printer.id),
      name: String(printer.name || ''),
      windowsPrinterName: String(printer.windowsPrinterName || ''),
      isActive: printer.isActive !== false
    } : null
  }
}

export const completeJob = async (tenantId, system, stationId, jobId) => {
  if (!mongoose.isValidObjectId(String(jobId || ''))) throw error('invalid_request', 'Invalid job id', 400)
  const updated = await jobRepo.markPrinted(jobId, tenantId, system, stationId)
  if (!updated) throw error('not_found', 'Job bulunamadı', 404)
  return { id: String(updated.id), status: updated.status }
}

export const failJob = async (tenantId, system, stationId, jobId, input) => {
  if (!mongoose.isValidObjectId(String(jobId || ''))) throw error('invalid_request', 'Invalid job id', 400)
  const retry = input?.retry === true
  const maxAttempts = Number.isFinite(Number(input?.maxAttempts)) ? Number(input.maxAttempts) : 3
  const errObj =
    input?.error && typeof input.error === 'object' ? input.error :
      typeof input?.error === 'string' ? { message: String(input.error) } :
        { message: String(input?.message || 'Print failed') }
  const nextStatus = retry ? 'queued' : 'failed'
  const updated = await jobRepo.markFailed(jobId, tenantId, system, stationId, nextStatus, errObj)
  if (!updated) throw error('not_found', 'Job bulunamadı', 404)
  const attempts = Number(updated.attempts || 0)
  if (retry && attempts >= maxAttempts) {
    const forced = await jobRepo.findByIdAndScope(updated.id, tenantId, system)
    if (forced) {
      forced.status = 'failed'
      await forced.save()
      return { id: String(forced.id), status: forced.status, attempts: Number(forced.attempts || 0) }
    }
  }
  return { id: String(updated.id), status: updated.status, attempts: Number(updated.attempts || 0) }
}

export const cancelJob = async (tenantId, system, jobId) => {
  if (!mongoose.isValidObjectId(String(jobId || ''))) throw error('invalid_request', 'Invalid job id', 400)
  const updated = await jobRepo.markCanceled(jobId, tenantId, system)
  if (!updated) throw error('not_found', 'Job bulunamadı', 404)
  return { id: String(updated.id), status: updated.status }
}
