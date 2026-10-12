import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import mongoose from 'mongoose'
import Tenant from '../models/Tenant.js'
import AuditLog from '../models/AuditLog.js'
import { signToken, verifyToken } from '../utils/jwt.js'
import { error } from '../utils/errors.js'
import { normalizeSystemType } from '../utils/systemType.js'
import {
  getResetComparableCounts,
  getTenantResetDeletionPlan,
  isCollectionPreservedOnReset,
  isCollectionVolatileDuringReset,
  normalizeCollectionName,
  resetCountsMatch
} from './dataManagementPolicy.js'
import {
  classifyTenantCollection,
  getSystemDiscriminatorFilter,
  isCollectionInSystemScope
} from './dataManagementScope.js'

const BACKUP_FORMAT = 'penpos-tenant-full-backup'
const BACKUP_VERSION = 1
const MAX_BACKUP_BYTES = 100 * 1024 * 1024
const EXCLUDED_COLLECTIONS = new Set(['tenants'])
const SYSTEM_COLLECTION_PREFIX = 'system.'
const TENANT_FIELDS = ['tenantId', 'tenant']
const RESTORABLE_TENANT_FIELDS = ['name', 'description', 'phone', 'logoUrl', 'settings', 'allowedBranchIds']

const bsonEjson = () => mongoose.mongo.BSON.EJSON
const backupSigningSecret = () => process.env.JWT_SECRET || 'dev_secret'
const getChecksum = (content) =>
  createHash('sha256').update(bsonEjson().stringify(content, null, 0, { relaxed: false })).digest('hex')

const getBackupSignature = (tenantId, system, checksum) =>
  createHmac('sha256', backupSigningSecret())
    .update(`${BACKUP_FORMAT}:${BACKUP_VERSION}:${tenantId}:${system}:${checksum}`)
    .digest('hex')

const sameHex = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false
  try {
    return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
  } catch {
    return false
  }
}

const toTenantObjectId = (tenantId) => {
  if (!mongoose.isValidObjectId(tenantId)) throw error('invalid_tenant', 'Firma bilgisi doğrulanamadı.', 400)
  return new mongoose.Types.ObjectId(String(tenantId))
}

export const buildTenantDataFilter = (tenantId) => {
  const id = toTenantObjectId(tenantId)
  const values = [id, String(id)]
  return {
    $or: TENANT_FIELDS.map((field) => ({ [field]: { $in: values } }))
  }
}

const fieldMatchesTenant = (value, tenantId) => {
  if (value === null || value === undefined) return false
  return String(value) === String(tenantId)
}

export const isTenantOwnedBackupDocument = (document, tenantId) =>
  TENANT_FIELDS.some((field) => fieldMatchesTenant(document?.[field], tenantId))

export const classifyReferenceTargetOwnership = (document, tenantId) => {
  const tenantOwners = TENANT_FIELDS
    .filter((field) => document?.[field] !== undefined && document[field] !== null)
    .map((field) => document[field])
  if (tenantOwners.length === 0) return 'global'
  return tenantOwners.every((owner) => fieldMatchesTenant(owner, tenantId)) ? 'tenant' : 'foreign'
}

export const getTenantResetSnapshotHash = (collections, system, tenantProfile = {}) => getChecksum({
  collections: Object.entries(collections)
    .filter(([name]) =>
      isCollectionInSystemScope(name, system) &&
      !isCollectionPreservedOnReset(name) &&
      !isCollectionVolatileDuringReset(name)
    )
    .map(([name, documents]) => [
      name,
      [...documents].sort((left, right) => String(left._id).localeCompare(String(right._id)))
    ])
    .sort(([left], [right]) => left.localeCompare(right)),
  allowedBranchIds: tenantProfile.allowedBranchIds || []
})

const getKnownTenantCollections = (system) => {
  const collections = new Set()
  for (const modelName of mongoose.modelNames()) {
    const model = mongoose.model(modelName)
    let isTenantScoped = false
    model.schema.eachPath((path) => {
      if (path === 'tenantId' || path === 'tenant') isTenantScoped = true
    })
    const collectionName = model.collection.collectionName
    if (
      isTenantScoped &&
      isCollectionInSystemScope(collectionName, system) &&
      !collectionName.startsWith(SYSTEM_COLLECTION_PREFIX) &&
      !EXCLUDED_COLLECTIONS.has(normalizeCollectionName(collectionName))
    ) {
      collections.add(collectionName)
    }
  }
  return collections
}

const getTenantScopeDocs = async (tenantId, system, session, options = {}) => {
  const tenantFilter = buildTenantDataFilter(tenantId)
  const projection = options.metadataOnly ? { _id: 1, tenantId: 1, tenant: 1 } : undefined
  const knownCollections = getKnownTenantCollections(system)
  const names = new Set(knownCollections)
  const existingCollections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()
  const warnings = new Set()
  const unknownCollections = []
  for (const collection of existingCollections) {
    if (collection.name.startsWith(SYSTEM_COLLECTION_PREFIX) ||
      EXCLUDED_COLLECTIONS.has(normalizeCollectionName(collection.name))) continue
    const classification = classifyTenantCollection(collection.name)
    if (classification.kind === 'unknown') {
      unknownCollections.push(collection.name)
      continue
    }
    if (classification.kind === 'shared' || classification.system === system) {
      names.add(collection.name)
    }
  }

  const result = []
  for (const name of [...names].sort()) {
    const collection = mongoose.connection.db.collection(name)
    const discriminator = getSystemDiscriminatorFilter(name, system)
    const filter = discriminator
      ? { $and: [tenantFilter, discriminator] }
      : tenantFilter
    const query = collection.find(filter, { session, projection })
    const docs = await query.toArray()
    if (docs.length > 0 || knownCollections.has(name)) result.push({ name, docs })
  }

  for (const name of unknownCollections) {
    const docs = await mongoose.connection.db.collection(name)
      .find(tenantFilter, { session, projection: { _id: 1 } })
      .limit(1)
      .toArray()
    if (docs.length > 0) warnings.add(`“${name}” koleksiyonu sistem kapsamı tanımlı olmadığından yedekleme/sıfırlama dışında bırakıldı.`)
  }

  const byCollection = new Map(result.map(({ name, docs }) => [name, new Map(docs.map((document) => [String(document._id), document]))]))
  const references = getReferencePaths()
  let added = true
  for (let pass = 0; added && pass < mongoose.modelNames().length; pass += 1) {
    added = false
    for (const reference of references) {
      if (EXCLUDED_COLLECTIONS.has(normalizeCollectionName(reference.sourceCollection))) continue
      const sourceScope = classifyTenantCollection(reference.sourceCollection)
      if (sourceScope.kind === 'unknown') {
        const targetDocs = byCollection.get(reference.targetCollection)
        if (!targetDocs?.size) continue
        const ids = [...targetDocs.keys()]
          .filter(mongoose.isValidObjectId)
          .flatMap((id) => [new mongoose.Types.ObjectId(id), id])
        if (ids.length === 0) continue
        const hasUnknownRelatedData = await mongoose.connection.db.collection(reference.sourceCollection)
          .find({ [reference.path]: { $in: ids } }, { session, projection: { _id: 1 } })
          .limit(1)
          .hasNext()
        if (hasUnknownRelatedData) warnings.add(`“${reference.sourceCollection}” ilişkili koleksiyonu sistem kapsamı tanımlı olmadığından yedekleme/sıfırlama dışında bırakıldı.`)
        continue
      }
      if (sourceScope.kind === 'system' && sourceScope.system !== system) continue
      const targetDocs = byCollection.get(reference.targetCollection)
      if (!targetDocs?.size) continue
      const ids = [...targetDocs.keys()]
        .filter(mongoose.isValidObjectId)
        .flatMap((id) => [new mongoose.Types.ObjectId(id), id])
      if (ids.length === 0) continue
      const source = mongoose.connection.db.collection(reference.sourceCollection)
      const relationFilter = { [reference.path]: { $in: ids } }
      const discriminator = getSystemDiscriminatorFilter(reference.sourceCollection, system)
      const query = source.find(
        discriminator ? { $and: [relationFilter, discriminator] } : relationFilter,
        { session, projection: options.metadataOnly ? { _id: 1, tenantId: 1, tenant: 1 } : undefined }
      )
      const relatedDocs = await query.toArray()
      if (relatedDocs.length === 0) continue
      let sourceDocs = byCollection.get(reference.sourceCollection)
      if (!sourceDocs) {
        sourceDocs = new Map()
        byCollection.set(reference.sourceCollection, sourceDocs)
      }
      for (const document of relatedDocs) {
        const owner = TENANT_FIELDS.find((field) => document[field] !== undefined && document[field] !== null)
        if (owner && !fieldMatchesTenant(document[owner], tenantId)) continue
        const id = String(document._id)
        if (!sourceDocs.has(id)) {
          sourceDocs.set(id, document)
          added = true
        }
      }
    }
  }
  return {
    collections: [...byCollection.entries()]
      .map(([name, docs]) => ({ name, docs: [...docs.values()] }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    warnings: [...warnings]
  }
}

export const getTenantScopeWarnings = async (tenantId, system, session) =>
  (await getTenantScopeDocs(tenantId, system, session, { metadataOnly: true })).warnings

const readTenant = async (tenantId, system, session) => {
  const id = toTenantObjectId(tenantId)
  let query = Tenant.findById(id).select('name description phone logoUrl settings allowedBranchIds systemType vertical businessType')
  if (session) query = query.session(session)
  const tenant = await query.lean()
  if (!tenant) throw error('tenant_not_found', 'Firma bulunamadı.', 404)
  if (normalizeSystemType(tenant.systemType) !== system) {
    throw error('tenant_system_mismatch', 'Yedek dosyasının işletme türü bu firmayla eşleşmiyor.', 403)
  }
  return tenant
}

const createBackupContent = async (tenant, system, session) => {
  const collections = Object.create(null)
  const { collections: scopedCollections, warnings } = await getTenantScopeDocs(tenant._id, system, session)
  for (const { name, docs } of scopedCollections) collections[name] = docs
  if (system === 'restaurant') {
    const branches = new Set((collections.branches || []).map((branch) => String(branch._id)))
    if ((tenant.allowedBranchIds || []).some((branchId) => !branches.has(String(branchId)))) {
      throw error('tenant_branch_scope_invalid', 'Firma şube erişimleri mevcut şubelerle eşleşmiyor; yedek oluşturulamadı.', 409)
    }
  }

  return {
    warnings,
    content: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      tenant: {
        id: String(tenant._id),
        name: tenant.name,
        system,
        profile: Object.fromEntries(
          RESTORABLE_TENANT_FIELDS
            .filter((field) => field !== 'allowedBranchIds' || system === 'restaurant')
            .filter((field) => tenant[field] !== undefined)
            .map((field) => [field, tenant[field]])
        )
      },
      collections
    }
  }
}

export const finalizeTenantBackup = (content) => {
  const checksum = getChecksum(content)
  const resetSnapshotHash = getTenantResetSnapshotHash(
    content.collections,
    content.tenant.system,
    content.tenant.profile
  )
  const signature = getBackupSignature(content.tenant.id, content.tenant.system, checksum)
  const backup = { ...content, checksum, signature }
  const serialized = bsonEjson().stringify(backup, null, 2, { relaxed: false })
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BACKUP_BYTES) {
    throw error('backup_too_large', 'JSON yedek dosyası 100 MB sınırını aşıyor.', 413)
  }
  return {
    backup: JSON.parse(serialized),
    checksum,
    resetToken: signToken({
      purpose: 'tenant-full-backup',
      tenantId: content.tenant.id,
      system: content.tenant.system,
      checksum,
      resetSnapshotHash
    }, { expiresIn: '15m' })
  }
}

export const parseAndVerifyTenantBackup = (input, tenantId, system) => {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input || '')
  if (buffer.length === 0) throw error('backup_file_required', 'JSON yedek dosyası seçin.', 400)
  if (buffer.length > MAX_BACKUP_BYTES) throw error('backup_too_large', 'JSON yedek dosyası 100 MB sınırını aşıyor.', 413)

  let backup
  try {
    backup = bsonEjson().parse(buffer.toString('utf8'), { relaxed: false })
  } catch {
    throw error('invalid_backup_json', 'Yedek dosyası geçerli JSON/EJSON değil.', 400)
  }

  if (
    !backup ||
    typeof backup !== 'object' ||
    backup.format !== BACKUP_FORMAT ||
    Number(backup.version) !== BACKUP_VERSION ||
    !backup.tenant ||
    typeof backup.tenant.id !== 'string' ||
    !mongoose.isValidObjectId(backup.tenant.id) ||
    typeof backup.tenant.name !== 'string' ||
    typeof backup.tenant.system !== 'string' ||
    (backup.tenant.profile !== undefined &&
      (!backup.tenant.profile || typeof backup.tenant.profile !== 'object' || Array.isArray(backup.tenant.profile))) ||
    !backup.collections ||
    typeof backup.collections !== 'object' ||
    Array.isArray(backup.collections)
  ) {
    throw error('invalid_backup_schema', 'Yedek dosyasının PenPOS tam yedek şeması geçersiz.', 400)
  }
  if (String(backup.tenant.id) !== String(tenantId) || backup.tenant.system !== system) {
    throw error('backup_tenant_mismatch', 'Yedek dosyası farklı bir firma veya işletme türü için oluşturulmuş.', 403)
  }

  const { checksum, signature, ...content } = backup
  const actualChecksum = getChecksum(content)
  if (!sameHex(checksum, actualChecksum)) {
    throw error('backup_checksum_mismatch', 'Yedek dosyasının bütünlük özeti doğrulanamadı.', 400)
  }
  const expectedSignature = getBackupSignature(String(tenantId), system, actualChecksum)
  if (!sameHex(signature, expectedSignature)) {
    throw error('backup_signature_invalid', 'Yedek dosyası bu PenPOS ortamında oluşturulmamış veya değiştirilmiş.', 400)
  }

  const collectionEntries = Object.entries(backup.collections)
  const idsByCollection = new Map()
  const tenantIdsByCollection = new Map()
  for (const [name, docs] of collectionEntries) {
    if (
      typeof name !== 'string' ||
      !name ||
      name.startsWith(SYSTEM_COLLECTION_PREFIX) ||
      EXCLUDED_COLLECTIONS.has(normalizeCollectionName(name)) ||
      !Array.isArray(docs)
    ) {
      throw error('invalid_backup_collection', 'Yedek dosyasında izin verilmeyen koleksiyon veya kayıt listesi var.', 400)
    }
    if (!isCollectionInSystemScope(name, system)) {
      const classification = classifyTenantCollection(name)
      const reason = classification.kind === 'unknown'
        ? 'sistem kapsamı tanımlı değil'
        : `yalnızca ${classification.system} işletme türüne ait`
      throw error(
        'backup_collection_out_of_scope',
        `Yedekteki “${name}” koleksiyonu ${reason}; bu firma için geri yüklenemez.`,
        400
      )
    }
    const ids = new Set()
    const tenantIds = new Set()
    for (const document of docs) {
      if (
        !document ||
        typeof document !== 'object' ||
        Array.isArray(document) ||
        !document._id
      ) {
        throw error('invalid_backup_record_scope', `Yedekte ${name} koleksiyonunda kimliği eksik veya geçersiz kayıt var.`, 400)
      }
      const id = String(document._id)
      if (ids.has(id)) throw error('duplicate_backup_id', `Yedekte ${name} koleksiyonunda yinelenen kayıt kimliği var.`, 400)
      ids.add(id)
      const hasTenantOwner = TENANT_FIELDS.some((field) => document[field] !== undefined && document[field] !== null)
      if (hasTenantOwner && !isTenantOwnedBackupDocument(document, tenantId)) {
        throw error('invalid_backup_record_scope', `Yedekte ${name} koleksiyonuna ait olmayan kayıt var.`, 400)
      }
      if (hasTenantOwner) tenantIds.add(id)
    }
    idsByCollection.set(name, ids)
    tenantIdsByCollection.set(name, tenantIds)
  }

  if (backup.tenant.profile?.allowedBranchIds !== undefined) {
    const branchIds = backup.tenant.profile.allowedBranchIds
    const archivedBranches = idsByCollection.get('branches')
    if (
      system !== 'restaurant' ||
      !Array.isArray(branchIds) ||
      branchIds.some((id) => !archivedBranches?.has(String(id)))
    ) {
      throw error('invalid_backup_branch_scope', 'Yedekteki firma şube erişimleri, yedeklenen şubelerle eşleşmiyor.', 400)
    }
  }

  const referencesBySource = new Map()
  for (const reference of getReferencePaths()) {
    const sourceReferences = referencesBySource.get(reference.sourceCollection) || []
    sourceReferences.push(reference)
    referencesBySource.set(reference.sourceCollection, sourceReferences)
  }
  for (const [name, docs] of collectionEntries) {
    const directTenantIds = tenantIdsByCollection.get(name)
    for (const document of docs) {
      if (directTenantIds.has(String(document._id))) continue
      const belongsByReference = (referencesBySource.get(name) || []).some((reference) => {
        const targetIds = tenantIdsByCollection.get(reference.targetCollection)
        return targetIds && getPathValues(document, reference.path)
          .some((value) => value !== null && value !== undefined && targetIds.has(String(value)))
      })
      if (!belongsByReference) {
        throw error('invalid_backup_record_scope', `Yedekte ${name} koleksiyonuna ait olduğu doğrulanamayan kayıt var.`, 400)
      }
    }
  }

  return { backup, content, checksum: actualChecksum, idsByCollection }
}

const getPathValues = (value, path) => {
  const parts = path.split('.')
  const walk = (current, index) => {
    if (current === null || current === undefined) return []
    if (Array.isArray(current)) return current.flatMap((item) => walk(item, index))
    if (index === parts.length) return [current]
    return walk(current[parts[index]], index + 1)
  }
  return walk(value, 0)
}

export const getReferencePaths = () => {
  const references = []
  for (const modelName of mongoose.modelNames()) {
    const model = mongoose.model(modelName)
    const visitSchema = (schema, prefix = '') => schema.eachPath((path, schemaType) => {
      const fullPath = `${prefix}${path}`
      const ref = schemaType.options?.ref || schemaType.caster?.options?.ref
      if (ref) {
        const target = mongoose.models[ref]
        if (!target) throw error('backup_reference_model_missing', `Yedek ilişkisi için ${ref} modeli yüklenmemiş.`, 500)
        references.push({
          sourceCollection: model.collection.collectionName,
          path: fullPath,
          targetCollection: target.collection.collectionName,
          required: Boolean(schemaType.isRequired)
        })
      }
      const nestedSchema = schemaType.schema || schemaType.caster?.schema
      if (nestedSchema) visitSchema(nestedSchema, `${fullPath}.`)
    })
    visitSchema(model.schema)
  }
  return references
}

const referenceIdKey = (value) => bsonEjson().stringify(value, null, 0, { relaxed: false })

export const getMissingReferenceHandling = (reference, document, system) => {
  const sourceCollection = normalizeCollectionName(reference.sourceCollection)
  if (
    system === 'canteen' &&
    sourceCollection === 'canteenqrorders' &&
    ['customerId', 'cariId'].includes(reference.path)
  ) {
    return 'preserve-history'
  }
  if (
    system === 'canteen' &&
    sourceCollection === 'canteensales' &&
    reference.path === 'items.batchId'
  ) {
    return 'preserve-history'
  }
  if (
    system === 'canteen' &&
    sourceCollection === 'users' &&
    ['branchId', 'branchIds', 'accessibleBranchIds'].includes(reference.path)
  ) {
    return 'preserve-history'
  }
  if (reference.sourceCollection === 'print_jobs') {
    if (reference.path === 'stationId' && document.status === 'queued') return 'unassign-queued'
    if (reference.path === 'stationId' || reference.path === 'lockedByStationId') return 'preserve-history'
  }
  return 'clear-optional'
}

export const resolveReferenceTargetCollection = (reference, system) => {
  if (
    system === 'canteen' &&
    normalizeCollectionName(reference.sourceCollection) === 'users' &&
    ['branchId', 'branchIds', 'accessibleBranchIds'].includes(reference.path)
  ) {
    return 'canteen_branches'
  }
  return reference.targetCollection
}

export const buildBackupReferenceLookupPlan = (
  parsed,
  system,
  references = getReferencePaths()
) => {
  const lookups = new Map()
  for (const reference of references) {
    if (!isCollectionInSystemScope(reference.sourceCollection, system)) continue
    const documents = parsed.backup.collections[reference.sourceCollection] || []
    const targetCollection = resolveReferenceTargetCollection(reference, system)
    for (const document of documents) {
      for (const value of getPathValues(document, reference.path)) {
        if (value === null || value === undefined || value === '') continue
        if (parsed.idsByCollection.get(targetCollection)?.has(String(value))) continue
        let targetLookups = lookups.get(targetCollection)
        if (!targetLookups) {
          targetLookups = new Map()
          lookups.set(targetCollection, targetLookups)
        }
        const id = mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(String(value)) : value
        const key = referenceIdKey(id)
        let lookup = targetLookups.get(key)
        if (!lookup) {
          lookup = { id, references: [] }
          targetLookups.set(key, lookup)
        }
        lookup.references.push({
          sourceCollection: reference.sourceCollection,
          sourceDocumentId: String(document._id),
          path: reference.path,
          required: reference.required,
          id
        })
      }
    }
  }
  return lookups
}

const validateBackupReferences = async (parsed, system, session, tenantId) => {
  const lookups = buildBackupReferenceLookupPlan(parsed, system)
  const batchSize = 500
  const repairs = new Map()
  const repairCounts = new Map()
  const queuedJobsToReassign = new Set()
  const preservedReferenceCounts = {}
  for (const [collectionName, targetLookups] of lookups) {
    const entries = [...targetLookups.values()]
    const found = new Set()
    const collection = mongoose.connection.db.collection(collectionName)
    for (let offset = 0; offset < entries.length; offset += batchSize) {
      const documents = await collection.find(
        { _id: { $in: entries.slice(offset, offset + batchSize).map(({ id }) => id) } },
        { session, projection: { _id: 1, tenantId: 1, tenant: 1 } }
      ).toArray()
      for (const document of documents) {
        const ownership = classifyReferenceTargetOwnership(document, tenantId)
        if (ownership === 'foreign') {
          throw error(
            'backup_reference_invalid',
            `Yedekte ${collectionName} ilişkisi başka firma verisine yöneliyor.`,
            400
          )
        }
        if (ownership === 'global') found.add(referenceIdKey(document._id))
      }
    }
    for (const [key, entry] of targetLookups) {
      if (found.has(key)) continue
      if (entry.references.some((reference) => reference.required)) {
        throw error(
          'backup_reference_invalid',
          `Yedekteki ${collectionName} zorunlu ilişkisi eksik veya doğrulanamıyor.`,
          400
        )
      }
      for (const reference of entry.references) {
        const documents = parsed.backup.collections[reference.sourceCollection] || []
        const document = documents.find((item) => String(item._id) === reference.sourceDocumentId)
        if (!document) {
          throw error('backup_reference_invalid', 'Yedekte isteğe bağlı ilişki kaydı doğrulanamadı.', 400)
        }
        const handling = getMissingReferenceHandling(reference, document, system)
        if (handling === 'preserve-history') {
          const field = `${reference.sourceCollection}.${reference.path}`
          preservedReferenceCounts[field] = (preservedReferenceCounts[field] || 0) + 1
          continue
        }
        let collectionRepairs = repairs.get(reference.sourceCollection)
        if (!collectionRepairs) {
          collectionRepairs = new Map()
          repairs.set(reference.sourceCollection, collectionRepairs)
        }
        let documentRepairs = collectionRepairs.get(reference.sourceDocumentId)
        if (!documentRepairs) {
          documentRepairs = []
          collectionRepairs.set(reference.sourceDocumentId, documentRepairs)
        }
        documentRepairs.push({ path: reference.path, key })
        if (handling === 'unassign-queued') queuedJobsToReassign.add(reference.sourceDocumentId)
        const field = `${reference.sourceCollection}.${reference.path}`
        repairCounts.set(field, (repairCounts.get(field) || 0) + 1)
      }
    }
  }
  return {
    repairs,
    queuedJobsToReassign: queuedJobsToReassign.size,
    preservedReferenceCounts,
    preservedStationReferenceCounts: {
      stationId: preservedReferenceCounts['print_jobs.stationId'] || 0,
      lockedByStationId: preservedReferenceCounts['print_jobs.lockedByStationId'] || 0
    },
    warnings: [...repairCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([field, count]) =>
        `Yedekteki ${field} alanında ${count} isteğe bağlı bağlantı hedefi bulunamadı; geri yüklemede bu bağlantılar boş bırakılacak.`
      )
  }
}

export const clearMissingOptionalReferences = (document, collectionName, repairs) => {
  const collectionRepairs = repairs.get(collectionName)
  const documentRepairs = collectionRepairs?.get(String(document._id))
  if (!documentRepairs) return document

  const clearMatch = (value, parts, index, key) => {
    if (Array.isArray(value)) return value.map((item) => clearMatch(item, parts, index, key))
    if (value === null || value === undefined) return value
    if (index === parts.length) return referenceIdKey(value) === key ? null : value
    if (typeof value !== 'object') return value
    const part = parts[index]
    value[part] = clearMatch(value[part], parts, index + 1, key)
    return value
  }

  for (const { path, key } of documentRepairs) {
    if (getMissingReferenceHandling({ sourceCollection: collectionName, path }, document) === 'preserve-history') {
      continue
    }
    clearMatch(document, path.split('.'), 0, key)
  }
  return document
}

const getCollectionCounts = (collections, excludePreserved, system) => Object.fromEntries(
  collections
    .filter(({ name }) =>
      isCollectionInSystemScope(name, system) &&
      (!excludePreserved || !isCollectionPreservedOnReset(name))
    )
    .map(({ name, docs }) => [name, docs.length])
)

const beginSnapshotTransaction = async (session, operation) => {
  try {
    return await session.withTransaction(operation, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }
    })
  } catch (err) {
    if (
      err?.code === 20 ||
      err?.codeName === 'IllegalOperation' ||
      /transaction numbers are only allowed|replica set|mongos/i.test(String(err?.message || ''))
    ) {
      throw error('transactions_required', 'MongoDB atomik transaction desteklemiyor; hiçbir kayıt değiştirilmedi.', 503)
    }
    throw err
  }
}

export const downloadTenantBackup = async ({ tenantId, system, actorUserId }) => {
  const session = await mongoose.startSession()
  try {
    let result
    await beginSnapshotTransaction(session, async () => {
      const tenant = await readTenant(tenantId, system, session)
      await AuditLog.create([{
        tenantId: tenant._id,
        actorUserId,
        action: 'tenant_full_backup_downloaded',
        entityType: 'Tenant',
        entityId: tenant._id,
        meta: { system }
      }], { session })
      const { content, warnings } = await createBackupContent(tenant, system, session)
      result = { ...finalizeTenantBackup(content), warnings }
    })
    return result
  } finally {
    await session.endSession()
  }
}

export const previewTenantReset = async ({ tenantId, system }) => {
  const session = await mongoose.startSession()
  try {
    let result
    await beginSnapshotTransaction(session, async () => {
      const tenant = await readTenant(tenantId, system, session)
      const { collections, warnings } = await getTenantScopeDocs(tenant._id, system, session, { metadataOnly: true })
      const counts = getCollectionCounts(collections, true, system)
      result = {
        tenantName: tenant.name,
        system,
        counts,
        totalCount: Object.values(counts).reduce((sum, count) => sum + count, 0),
        warnings
      }
    })
    return result
  } finally {
    await session.endSession()
  }
}

const verifyResetToken = (token, tenantId, system) => {
  if (typeof token !== 'string' || !token) {
    throw error('full_backup_required', 'Sıfırlama öncesinde tam JSON yedeği indirin.', 400)
  }
  let payload
  try {
    payload = verifyToken(token)
  } catch {
    throw error('full_backup_required', 'Tam yedek onayı geçersiz veya süresi dolmuş. Yeni yedek indirin.', 400)
  }
  if (
    payload?.purpose !== 'tenant-full-backup' ||
    String(payload.tenantId) !== String(tenantId) ||
    payload.system !== system
  ) {
    throw error('full_backup_required', 'Tam yedek bu firma için oluşturulmamış.', 400)
  }
  if (typeof payload.resetSnapshotHash !== 'string') {
    throw error('full_backup_required', 'Sıfırlama yedeği güncel değil. Yeni tam yedek indirin.', 400)
  }
  return payload
}

export const resetTenantBusinessData = async ({
  tenantId,
  actorUserId,
  system,
  confirmationName,
  resetToken,
  counts
}) => {
  const backupPayload = verifyResetToken(resetToken, tenantId, system)
  const session = await mongoose.startSession()
  try {
    let result
    await beginSnapshotTransaction(session, async () => {
      const tenant = await readTenant(tenantId, system, session)
      if (String(confirmationName || '') !== tenant.name) {
        throw error('confirmation_mismatch', 'Firma adını eksiksiz ve aynı şekilde yazın.', 400)
      }
      const { collections, warnings } = await getTenantScopeDocs(tenant._id, system, session)
      const currentCounts = getCollectionCounts(collections, true, system)
      if (!resetCountsMatch(counts, currentCounts)) {
        throw error('data_changed_since_preview', 'Veriler önizleme sonrasında değişti. Yeni önizleme oluşturup tekrar deneyin.', 409)
      }
      const currentSnapshotHash = getTenantResetSnapshotHash(
        Object.fromEntries(collections.map(({ name, docs }) => [name, docs])),
        system,
        { allowedBranchIds: tenant.allowedBranchIds }
      )
      if (currentSnapshotHash !== backupPayload.resetSnapshotHash) {
        throw error('data_changed_since_backup', 'Veriler tam yedek sonrasında değişti. Yeni tam JSON yedeği indirip sıfırlamayı yeniden başlatın.', 409)
      }

      const affectedCounts = {}
      for (const { name, docs } of getTenantResetDeletionPlan(collections, system)) {
        const collection = mongoose.connection.db.collection(name)
        const ids = docs.map((document) => document._id)
        const deletion = await collection.deleteMany({ _id: { $in: ids } }, { session })
        affectedCounts[name] = deletion.deletedCount || 0
      }
      if (system === 'restaurant') {
        await Tenant.updateOne({ _id: tenant._id }, { $set: { allowedBranchIds: [] } }, { session })
      }
      await AuditLog.create([{
        tenantId: tenant._id,
        actorUserId,
        action: 'tenant_full_business_reset',
        entityType: 'Tenant',
        entityId: tenant._id,
        meta: { system, businessName: tenant.name, affectedCounts, backupTokenChecksum: backupPayload.checksum }
      }], { session })
      result = {
        tenantName: tenant.name,
        system,
        affectedCounts,
        warnings,
        totalAffected: Object.values(affectedCounts).reduce((sum, count) => sum + count, 0)
      }
    })
    return result
  } finally {
    await session.endSession()
  }
}

export const previewTenantRestore = async ({ tenantId, system, fileBuffer }) => {
  const session = await mongoose.startSession()
  try {
    let result
    await beginSnapshotTransaction(session, async () => {
      const tenant = await readTenant(tenantId, system, session)
      const parsed = parseAndVerifyTenantBackup(fileBuffer, tenant._id, system)
      const referenceValidation = await validateBackupReferences(parsed, system, session, tenant._id)
      const { collections: currentCollections, warnings } = await getTenantScopeDocs(tenant._id, system, session)
      const backupCounts = Object.fromEntries(
        Object.entries(parsed.backup.collections).map(([name, docs]) => [name, docs.length])
      )
      const currentCounts = Object.fromEntries(currentCollections.map(({ name, docs }) => [name, docs.length]))
      result = {
        tenantName: tenant.name,
        backupTenantName: parsed.backup.tenant.name,
        tenantId: String(tenant._id),
        backupTenantId: String(parsed.backup.tenant.id),
        system,
        backupSystem: parsed.backup.tenant.system,
        checksum: parsed.checksum,
        backupCounts,
        currentCounts,
        warnings,
        referenceWarnings: referenceValidation.warnings,
        queuedJobsToReassign: referenceValidation.queuedJobsToReassign,
        preservedReferenceCounts: referenceValidation.preservedReferenceCounts,
        preservedStationReferenceCounts: referenceValidation.preservedStationReferenceCounts,
        backupTotal: Object.values(backupCounts).reduce((sum, count) => sum + count, 0),
        currentTotal: Object.values(currentCounts).reduce((sum, count) => sum + count, 0)
      }
    })
    return result
  } finally {
    await session.endSession()
  }
}

export const restoreTenantBackup = async ({
  tenantId,
  actorUserId,
  system,
  fileBuffer,
  confirmationName,
  overwriteConfirmed,
  referenceCleanupConfirmed,
  expectedChecksum
}) => {
  const session = await mongoose.startSession()
  try {
    let result
    await beginSnapshotTransaction(session, async () => {
      const tenant = await readTenant(tenantId, system, session)
      if (String(confirmationName || '') !== tenant.name || overwriteConfirmed !== true) {
        throw error('overwrite_confirmation_required', 'Firma adını yazıp mevcut verilerin üzerine yazılacağını açıkça onaylayın.', 400)
      }
      const parsed = parseAndVerifyTenantBackup(fileBuffer, tenant._id, system)
      if (parsed.checksum !== expectedChecksum) {
        throw error('backup_changed_after_preview', 'Yedek dosyası önizlemeden sonra değişti. Dosyayı yeniden doğrulayın.', 409)
      }
      const referenceValidation = await validateBackupReferences(parsed, system, session, tenant._id)
      if (referenceValidation.warnings.length > 0 && referenceCleanupConfirmed !== true) {
        throw error(
          'reference_cleanup_confirmation_required',
          'Yedekte bulunmayan isteğe bağlı bağlantıların temizlenmesini açıkça onaylayın.',
          400
        )
      }

      const { collections: currentCollections, warnings } = await getTenantScopeDocs(tenant._id, system, session)
      const allCollectionNames = new Set([
        ...currentCollections.map(({ name }) => name),
        ...Object.keys(parsed.backup.collections)
      ])
      for (const name of allCollectionNames) {
        if (
          name.startsWith(SYSTEM_COLLECTION_PREFIX) ||
          EXCLUDED_COLLECTIONS.has(normalizeCollectionName(name)) ||
          !isCollectionInSystemScope(name, system)
        ) {
          throw error('invalid_backup_collection', `Yedekte değiştirilemeyen ${name} koleksiyonu var.`, 400)
        }
      }

      for (const name of allCollectionNames) {
        const currentDocs = currentCollections.find((entry) => entry.name === name)?.docs || []
        if (currentDocs.length > 0) {
          await mongoose.connection.db.collection(name).deleteMany(
            { _id: { $in: currentDocs.map((document) => document._id) } },
            { session }
          )
        }
      }

      const affectedCounts = {}
      for (const [name, docs] of Object.entries(parsed.backup.collections)) {
        if (docs.length === 0) {
          affectedCounts[name] = 0
          continue
        }
        const restoredDocs = docs.map((document) =>
          clearMissingOptionalReferences(document, name, referenceValidation.repairs)
        )
        const inserted = await mongoose.connection.db.collection(name).insertMany(restoredDocs, { session, ordered: true })
        affectedCounts[name] = inserted.insertedCount
      }

      const tenantProfile = Object.fromEntries(
        RESTORABLE_TENANT_FIELDS
          .filter((field) => field === 'name' || parsed.backup.tenant.profile?.[field] !== undefined)
          .map((field) => [field, field === 'name' ? parsed.backup.tenant.name : parsed.backup.tenant.profile[field]])
      )
      await Tenant.updateOne({ _id: tenant._id }, { $set: tenantProfile }, { session })

      await AuditLog.create([{
        tenantId: tenant._id,
        actorUserId,
        action: 'tenant_full_backup_restored',
        entityType: 'Tenant',
        entityId: tenant._id,
        meta: {
          system,
          businessName: tenant.name,
          checksum: parsed.checksum,
          replacedCollections: [...allCollectionNames],
          affectedCounts,
          referenceWarnings: referenceValidation.warnings,
          queuedJobsToReassign: referenceValidation.queuedJobsToReassign,
          preservedReferenceCounts: referenceValidation.preservedReferenceCounts,
          preservedStationReferenceCounts: referenceValidation.preservedStationReferenceCounts
        }
      }], { session })
      result = {
        tenantName: parsed.backup.tenant.name,
        system,
        checksum: parsed.checksum,
        restoredCounts: affectedCounts,
        totalRestored: Object.values(affectedCounts).reduce((sum, count) => sum + count, 0),
        warnings,
        referenceWarnings: referenceValidation.warnings,
        queuedJobsToReassign: referenceValidation.queuedJobsToReassign,
        preservedReferenceCounts: referenceValidation.preservedReferenceCounts,
        preservedStationReferenceCounts: referenceValidation.preservedStationReferenceCounts
      }
    })
    return result
  } finally {
    await session.endSession()
  }
}
