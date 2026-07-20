import mongoose from 'mongoose'
import CustomerAccount from '../models/CustomerAccount.js'
import AccountTransaction from '../models/AccountTransaction.js'
import Order from '../models/Order.js'
import MenuItem from '../models/MenuItem.js'
import { error } from '../utils/errors.js'
import { log as auditLog } from './auditService.js'
import { isTxnSupported } from '../utils/mongoTxn.js'
import { resolvePaymentMethodSelection } from './paymentSettingsService.js'
import { notDeletedFilter } from '../utils/softDelete.js'

const toMoney = (v) => {
  const raw = v === null || v === undefined ? '' : String(v).trim().replace(/\s/g, '').replace(',', '.')
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

const normalizePhone = (v) => {
  const raw = v === null || v === undefined ? '' : String(v)
  const out = raw.replace(/\s/g, '').trim()
  return out ? out : null
}

const mapTransactionDto = (t, orderMap = null) => ({
  id: t._id.toString(),
  type: t.type,
  amount: toMoney(t.amount),
  method: t.method,
  methodLabel: String(t?.methodLabel || t?.method || ''),
  methodBucket: String(t?.methodBucket || ''),
  note: t.note,
  source: t.source,
  orderId: t.orderId ? t.orderId.toString() : null,
  orderSummary: t.orderId && orderMap ? (orderMap.get(String(t.orderId)) || null) : null,
  lines: Array.isArray(t?.lines)
    ? t.lines.map((line) => ({
      menuItemId: line?.menuItemId ? String(line.menuItemId) : null,
      name: String(line?.name || '').trim(),
      qty: Number(line?.qty || 0),
      price: toMoney(line?.price),
      lineTotal: toMoney(line?.lineTotal),
      note: String(line?.note || '').trim()
    }))
    : [],
  createdAt: t.createdAt
})

 

export const listAccountsService = async (tenantId, branchFilter, query = {}) => {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 20))
  const q = String(query.q || '').trim()

  let filter = { tenantId, isActive: true }

  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } }
    ]
  }

  const [items, total] = await Promise.all([
    CustomerAccount.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CustomerAccount.countDocuments(filter)
  ])

  return {
    accounts: items.map(a => ({
      id: a._id.toString(),
      branchId: a.branchId ? String(a.branchId) : null,
      name: a.name,
      phone: a.phone,
      note: a.note,
      balance: toMoney(a.balance),
      isActive: !!a.isActive,
      createdAt: a.createdAt
    })),
    page,
    limit,
    total
  }
}

export const createAccountService = async (tenantId, branchId, actorUserId, body = {}) => {
  const name = String(body.name || '').trim()
  if (!name) throw error('invalid_request', 'Name required', 400)
  const phone = normalizePhone(body.phone)
  const note = String(body.note || '').trim()

  let doc
  try {
    doc = await CustomerAccount.create({
      tenantId,
      branchId,
      name,
      phone,
      note,
      isActive: true,
      balance: 0
    })
  } catch (err) {
    throw err
  }
  await auditLog(tenantId, actorUserId, 'cari_olustur', 'CustomerAccount', doc.id, {})
  return { success: true, account: { _id: doc.id, id: doc.id, name: doc.name, phone: doc.phone, note: doc.note, balance: toMoney(doc.balance), isActive: doc.isActive } }
}

export const updateAccountService = async (tenantId, branchId, actorUserId, id, body = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid account id', 400)
  const doc = await CustomerAccount.findOne({ _id: id, tenantId })
  if (!doc) throw error('not_found', 'Account not found', 404)

  if (body.name !== undefined) {
    const name = String(body.name || '').trim()
    if (!name) throw error('invalid_request', 'Name required', 400)
    doc.name = name
  }
  if (body.phone !== undefined) {
    const phone = normalizePhone(body.phone)
    doc.phone = phone
  }
  if (body.note !== undefined) doc.note = String(body.note || '').trim()
  if (body.isActive !== undefined) doc.isActive = !!body.isActive

  try {
    await doc.save()
  } catch (err) {
    throw err
  }
  await auditLog(tenantId, actorUserId, 'cari_guncelle', 'CustomerAccount', doc.id, {})
  return { account: { id: doc.id, name: doc.name, phone: doc.phone, note: doc.note, balance: toMoney(doc.balance), isActive: doc.isActive } }
}

export const deleteAccountService = async (tenantId, branchId, actorUserId, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid account id', 400)
  const doc = await CustomerAccount.findOne({ _id: id, tenantId })
  if (!doc) throw error('not_found', 'Account not found', 404)

  const [txCount, orderCount] = await Promise.all([
    AccountTransaction.countDocuments({ tenantId, accountId: id, isDeleted: { $ne: true } }),
    Order.countDocuments({ tenantId, veresiyeAccountId: id })
  ])

  if (txCount > 0 || orderCount > 0) {
    throw error('has_transactions', 'Bu cari hareket gördüğü için silinemez. Pasife alabilirsiniz.', 409)
  }

  await CustomerAccount.deleteOne({ _id: id, tenantId })
  await auditLog(tenantId, actorUserId, 'cari_sil', 'CustomerAccount', id, {})
  return { success: true, id }
}

export const getAccountService = async (tenantId, branchId, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid account id', 400)
  const acc = await CustomerAccount.findOne({ _id: id, tenantId }).lean()
  if (!acc) throw error('not_found', 'Account not found', 404)
  const tx = await AccountTransaction.find({ tenantId, accountId: id, isDeleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()

  const orderIds = tx
    .filter(t => t?.source === 'order_veresiye' && t?.orderId)
    .map(t => String(t.orderId))
    .filter(Boolean)

  const orders = orderIds.length > 0
    ? await Order.find({ tenantId, _id: { $in: orderIds } })
      .select('status orderNo totals createdAt')
      .lean()
    : []

  const orderMap = new Map(
    (orders || []).map(o => {
      const grossTotal = Number(o?.totals?.grandTotal ?? o?.totals?.total ?? o?.total ?? 0) || 0
      return [
        String(o._id),
        {
          id: String(o._id),
          orderNo: o.orderNo ?? null,
          status: o.status,
          total: toMoney(grossTotal)
        }
      ]
    })
  )

  return {
    account: {
      id: acc._id.toString(),
      name: acc.name,
      phone: acc.phone,
      note: acc.note,
      balance: toMoney(acc.balance),
      isActive: !!acc.isActive,
      createdAt: acc.createdAt
    },
    recentTransactions: tx.map(t => mapTransactionDto(t, orderMap))
  }
}

export const getAccountCatalogService = async (tenantId) => {
  const [categories, items] = await Promise.all([
    mongoose.model('Category').find({ tenantId }).sort({ sortOrder: 1, name: 1 }).lean(),
    MenuItem.find(notDeletedFilter({ tenantId })).sort({ sortOrder: 1, name: 1 }).lean()
  ])

  return {
    categories: (categories || []).map((c) => ({
      id: String(c._id),
      name: String(c.name || '').trim(),
      isActive: c.isActive !== false,
      sortOrder: Number(c.sortOrder || 0)
    })),
    items: (items || []).map((i) => ({
      id: String(i._id),
      categoryId: i.categoryId ? String(i.categoryId) : null,
      name: String(i.name || '').trim(),
      price: toMoney(i.price),
      imageUrl: String(i.imageUrl || '').trim(),
      isActive: i.isActive !== false,
      isWeightBased: !!i.isWeightBased
    }))
  }
}

export const listTransactionsService = async (tenantId, branchId, id, query = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid account id', 400)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.max(1, Math.min(100, Number(query.limit) || 20))
  const filter = { tenantId, accountId: id, isDeleted: { $ne: true } }
  const [items, total] = await Promise.all([
    AccountTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AccountTransaction.countDocuments(filter)
  ])

  const orderIds = (items || [])
    .filter(t => t?.source === 'order_veresiye' && t?.orderId)
    .map(t => String(t.orderId))
    .filter(Boolean)

  const orders = orderIds.length > 0
    ? await Order.find({ tenantId, _id: { $in: orderIds } })
      .select('status orderNo totals createdAt')
      .lean()
    : []

  const orderMap = new Map(
    (orders || []).map(o => {
      const grossTotal = Number(o?.totals?.grandTotal ?? o?.totals?.total ?? o?.total ?? 0) || 0
      return [
        String(o._id),
        {
          id: String(o._id),
          orderNo: o.orderNo ?? null,
          status: o.status,
          total: toMoney(grossTotal)
        }
      ]
    })
  )

  return {
    transactions: items.map(t => mapTransactionDto(t, orderMap)),
    page,
    limit,
    total
  }
}

export const getTransactionOrderService = async (tenantId, branchId, txId) => {
  if (!mongoose.Types.ObjectId.isValid(txId)) throw error('invalid_request', 'Invalid transaction id', 400)

  const tx = await AccountTransaction.findOne({ _id: txId, tenantId, isDeleted: { $ne: true } }).lean()
  if (!tx) throw error('not_found', 'Transaction not found', 404)
  if (tx.source !== 'order_veresiye') throw error('invalid_request', 'Transaction has no order', 400)
  if (!tx.orderId) throw error('not_found', 'Order not found', 404)

  const ord = await Order.findOne({ _id: tx.orderId, tenantId }).lean()
  if (!ord) throw error('not_found', 'Order not found', 404)

  const pct = Math.max(0, Math.min(100, Number(ord?.discountPercent ?? 0) || 0))
  const rawItems = Array.isArray(ord?.items) ? ord.items : []
  const items = rawItems.map((it) => {
    const qty = Number(it?.qty ?? 0) || 0
    const price = Number(it?.priceSnapshot ?? 0) || 0
    const isCancelled = String(it?.status || '') === 'cancelled'
    const base = isCancelled ? 0 : qty * price
    const lineTotal = base - (base * pct) / 100
    return {
      name: String(it?.nameSnapshot ?? '').trim(),
      qty,
      price: toMoney(price),
      lineTotal: toMoney(lineTotal)
    }
  })

  const grossTotal = Number(ord?.totals?.grandTotal ?? ord?.totals?.total ?? ord?.total ?? 0) || 0
  return {
    order: {
      id: String(ord._id),
      orderNo: ord.orderNo ?? null,
      status: ord.status,
      total: toMoney(grossTotal),
      items
    }
  }
}

export const collectDebtService = async (tenantId, branchId, actorUserId, id, body = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid account id', 400)
  const amount = toMoney(body.amount)
  const discountAmount = toMoney(body.discountAmount)
  const totalEffect = toMoney(amount + discountAmount)
  if (totalEffect <= 0) throw error('invalid_amount', 'Invalid amount', 400)
  if (amount < 0) throw error('invalid_amount', 'Invalid amount', 400)
  const paymentMethod = await resolvePaymentMethodSelection(tenantId, branchId, body.method)
  const rawNote = String(body.note || '').trim()
  const note = discountAmount > 0
    ? [rawNote, `Tahsilat: ${toMoney(amount).toFixed(2)} TL`, `İndirim: ${toMoney(discountAmount).toFixed(2)} TL`].filter(Boolean).join(' • ')
    : rawNote
  const orderId = body?.orderId && mongoose.Types.ObjectId.isValid(String(body.orderId)) ? new mongoose.Types.ObjectId(String(body.orderId)) : null
  const createdAt = body?.createdAt instanceof Date && !Number.isNaN(body.createdAt.getTime()) ? body.createdAt : null

  const acc = await CustomerAccount.findOneAndUpdate(
    { _id: id, tenantId },
    { $inc: { balance: -totalEffect } },
    { new: true }
  )
  if (!acc) throw error('not_found', 'Account not found', 404)

  const tx = await AccountTransaction.create({
    tenantId,
    branchId,
    accountId: acc.id,
    type: 'credit',
    amount: totalEffect,
    method: paymentMethod.method,
    methodId: paymentMethod.methodId,
    methodLabel: paymentMethod.methodLabel,
    methodName: paymentMethod.methodName,
    methodBucket: paymentMethod.methodBucket,
    methodType: paymentMethod.methodType,
    note,
    source: 'collection',
    orderId,
    ...(createdAt ? { createdAt } : {})
  })

  await auditLog(tenantId, actorUserId, 'cari_tahsilat', 'CustomerAccount', acc.id, { amount, discountAmount, method: paymentMethod.method })

  return {
    account: { id: acc.id, name: acc.name, phone: acc.phone, note: acc.note, balance: toMoney(acc.balance), isActive: acc.isActive },
    transaction: { id: tx.id, type: tx.type, amount: toMoney(tx.amount), method: tx.method, methodId: tx.methodId, methodLabel: tx.methodLabel, methodName: tx.methodName, methodBucket: tx.methodBucket, methodType: tx.methodType, note: tx.note, source: tx.source, createdAt: tx.createdAt }
  }
}

export const addManualBalanceTransactionService = async (tenantId, branchId, actorUserId, id, body = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid account id', 400)

  const amount = toMoney(body.amount)
  if (amount <= 0) throw error('invalid_amount', 'Geçerli bir tutar girin', 400)

  const type = body?.type === 'credit' ? 'credit' : 'debit'
  const note = String(body.note || '').trim()
  const balanceDelta = type === 'debit' ? amount : -amount

  const acc = await CustomerAccount.findOneAndUpdate(
    { _id: id, tenantId },
    { $inc: { balance: balanceDelta } },
    { new: true }
  )
  if (!acc) throw error('not_found', 'Account not found', 404)

  const tx = await AccountTransaction.create({
    tenantId,
    branchId,
    accountId: acc.id,
    type,
    amount,
    method: 'other',
    note,
    source: 'manual',
    orderId: null
  })

  await auditLog(tenantId, actorUserId, type === 'debit' ? 'cari_manual_borc' : 'cari_manual_alacak', 'CustomerAccount', acc.id, { amount })

  return {
    account: { id: acc.id, name: acc.name, phone: acc.phone, note: acc.note, balance: toMoney(acc.balance), isActive: acc.isActive },
    transaction: { id: tx.id, type: tx.type, amount: toMoney(tx.amount), method: tx.method, note: tx.note, source: tx.source, createdAt: tx.createdAt }
  }
}

export const addManualProductChargeService = async (tenantId, branchId, actorUserId, id, body = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid account id', 400)
  const menuItemId = String(body.menuItemId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(menuItemId)) throw error('invalid_request', 'Geçerli bir ürün seçin', 400)

  const qty = Number(body.qty)
  if (!Number.isFinite(qty) || qty <= 0) throw error('invalid_amount', 'Geçerli bir miktar girin', 400)

  const item = await MenuItem.findOne({ _id: menuItemId, tenantId })
    .select('name price isActive isWeightBased')
    .lean()
  if (!item) throw error('not_found', 'Ürün bulunamadı', 404)

  const amount = toMoney((Number(item.price || 0) || 0) * qty)
  if (amount <= 0) throw error('invalid_amount', 'Ürün tutarı geçersiz', 400)

  const extraNote = String(body.note || '').trim()
  const qtyLabel = Number.isInteger(qty) ? String(qty) : String(qty).replace('.', ',')
  const baseNote = `${String(item.name || 'Ürün').trim() || 'Ürün'} x${qtyLabel}`
  const note = extraNote ? `${baseNote} - ${extraNote}` : baseNote

  const acc = await CustomerAccount.findOneAndUpdate(
    { _id: id, tenantId },
    { $inc: { balance: amount } },
    { new: true }
  )
  if (!acc) throw error('not_found', 'Account not found', 404)

  const tx = await AccountTransaction.create({
    tenantId,
    branchId,
    accountId: acc.id,
    type: 'debit',
    amount,
    method: 'other',
    note,
    lines: [{
      menuItemId: item._id,
      name: String(item.name || '').trim(),
      qty,
      price: toMoney(item.price),
      lineTotal: amount,
      note: extraNote
    }],
    source: 'manual',
    orderId: null
  })

  await auditLog(tenantId, actorUserId, 'cari_manual_urun', 'CustomerAccount', acc.id, {
    menuItemId,
    qty,
    amount
  })

  return {
    account: { id: acc.id, name: acc.name, phone: acc.phone, note: acc.note, balance: toMoney(acc.balance), isActive: acc.isActive },
    transaction: { id: tx.id, type: tx.type, amount: toMoney(tx.amount), method: tx.method, note: tx.note, source: tx.source, createdAt: tx.createdAt }
  }
}

export const addManualCartChargeService = async (tenantId, branchId, actorUserId, id, body = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw error('invalid_request', 'Invalid account id', 400)

  const rawItems = Array.isArray(body.items) ? body.items : []
  const normalizedItems = rawItems
    .map((entry) => ({
      menuItemId: String(entry?.menuItemId || '').trim(),
      qty: Number(entry?.qty),
      note: String(entry?.note || '').trim()
    }))
    .filter((entry) => mongoose.Types.ObjectId.isValid(entry.menuItemId) && Number.isFinite(entry.qty) && entry.qty > 0)

  if (normalizedItems.length === 0) throw error('invalid_request', 'Sepette ürün yok', 400)

  const uniqueIds = [...new Set(normalizedItems.map((entry) => entry.menuItemId))]
  const menuItems = await MenuItem.find(notDeletedFilter({ tenantId, _id: { $in: uniqueIds } }))
    .select('name price isActive')
    .lean()
  const menuItemMap = new Map(menuItems.map((item) => [String(item._id), item]))

  const txPayload = normalizedItems.map((entry) => {
    const item = menuItemMap.get(entry.menuItemId)
    if (!item) throw error('not_found', 'Ürün bulunamadı', 404)
    const amount = toMoney((Number(item.price || 0) || 0) * entry.qty)
    if (amount <= 0) throw error('invalid_amount', 'Ürün tutarı geçersiz', 400)
    const qtyLabel = Number.isInteger(entry.qty) ? String(entry.qty) : String(entry.qty).replace('.', ',')
    const baseNote = `${String(item.name || 'Ürün').trim() || 'Ürün'} x${qtyLabel}`
    const note = entry.note ? `${baseNote} - ${entry.note}` : baseNote
    return {
      menuItemId: entry.menuItemId,
      name: String(item.name || '').trim(),
      qty: entry.qty,
      price: toMoney(item.price),
      amount,
      note,
      lineTotal: amount
    }
  })

  const totalAmount = toMoney(txPayload.reduce((sum, entry) => sum + entry.amount, 0))
  const acc = await CustomerAccount.findOneAndUpdate(
    { _id: id, tenantId },
    { $inc: { balance: totalAmount } },
    { new: true }
  )
  if (!acc) throw error('not_found', 'Account not found', 404)

  const summaryNote = txPayload.length === 1
    ? txPayload[0].note
    : `${txPayload.length} ürünlük sepet`

  const created = await AccountTransaction.create({
    tenantId,
    branchId,
    accountId: acc.id,
    type: 'debit',
    amount: totalAmount,
    method: 'other',
    note: summaryNote,
    lines: txPayload.map((entry) => ({
      menuItemId: entry.menuItemId,
      name: entry.name,
      qty: entry.qty,
      price: entry.price,
      lineTotal: entry.lineTotal,
      note: entry.note
    })),
    source: 'manual',
    orderId: null
  })

  await auditLog(tenantId, actorUserId, 'cari_manual_sepet', 'CustomerAccount', acc.id, {
    totalAmount,
    lineCount: txPayload.length
  })

  return {
    account: { id: acc.id, name: acc.name, phone: acc.phone, note: acc.note, balance: toMoney(acc.balance), isActive: acc.isActive },
    transaction: {
      id: created.id,
      type: created.type,
      amount: toMoney(created.amount),
      method: created.method,
      note: created.note,
      source: created.source,
      lines: Array.isArray(created.lines)
        ? created.lines.map((line) => ({
          menuItemId: line?.menuItemId ? String(line.menuItemId) : null,
          name: String(line?.name || '').trim(),
          qty: Number(line?.qty || 0),
          price: toMoney(line?.price),
          lineTotal: toMoney(line?.lineTotal),
          note: String(line?.note || '').trim()
        }))
        : [],
      createdAt: created.createdAt
    },
    totalAmount
  }
}

export const deleteCollectionTransactionService = async (tenantId, branchId, actorUserId, txId) => {
  if (!mongoose.Types.ObjectId.isValid(txId)) throw error('invalid_request', 'Invalid transaction id', 400)

  const computeAccountBalance = async (accountId, session) => {
    const cursor = AccountTransaction.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(tenantId),
          accountId: new mongoose.Types.ObjectId(accountId),
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$type',
          sum: { $sum: '$amount' }
        }
      }
    ])
    if (session) cursor.session(session)
    const rows = await cursor
    const debit = rows.find(r => r._id === 'debit')?.sum || 0
    const credit = rows.find(r => r._id === 'credit')?.sum || 0
    return toMoney(debit) - toMoney(credit)
  }

  const runFallback = async () => {
    const txExisting = await AccountTransaction.findOne({ _id: txId, tenantId })
    if (!txExisting) throw error('not_found', 'Transaction not found', 404)
    if (txExisting.isDeleted) throw error('already_deleted', 'Transaction already deleted', 409)
    const isCollection = txExisting.source === 'collection' && txExisting.type === 'credit'
    const isManual = txExisting.source === 'manual' && !txExisting.orderId
    if (!isCollection && !isManual) throw error('invalid_request', 'Bu hareket silinemez', 409)

    if (txExisting.orderId) {
      throw error('payment_locked', 'Bu hareket silinemez', 409)
    }

    const deletedTx = await AccountTransaction.findOneAndUpdate(
      { _id: txId, tenantId, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    )
    if (!deletedTx) throw error('already_deleted', 'Transaction already deleted', 409)

    const nextBalance = await computeAccountBalance(txExisting.accountId)
    const acc = await CustomerAccount.findOneAndUpdate(
      { _id: txExisting.accountId, tenantId },
      { $set: { balance: nextBalance } },
      { new: true }
    )
    if (!acc) throw error('account_not_found_after_delete', 'Account not found', 409)

    await auditLog(
      tenantId,
      actorUserId,
      isManual ? 'cari_manual_hareket_silindi' : 'cari_tahsilat_silindi',
      'CustomerAccount',
      acc.id,
      { amount: toMoney(txExisting.amount), txId, mode: 'no_txn' }
    )
    return { success: true, accountId: acc.id, balance: toMoney(acc.balance), txId: deletedTx.id }
  }

  const supported = await isTxnSupported()
  if (!supported) return runFallback()

  const session = await mongoose.startSession()
  try {
    let out
    try {
      await session.withTransaction(async () => {
        const tx = await AccountTransaction.findOne({ _id: txId, tenantId }).session(session)
        if (!tx) throw error('not_found', 'Transaction not found', 404)
        if (tx.isDeleted) throw error('already_deleted', 'Transaction already deleted', 409)
        const isCollection = tx.source === 'collection' && tx.type === 'credit'
        const isManual = tx.source === 'manual' && !tx.orderId
        if (!isCollection && !isManual) throw error('invalid_request', 'Bu hareket silinemez', 409)

        if (tx.orderId) {
          throw error('payment_locked', 'Bu hareket silinemez', 409)
        }

        const acc = await CustomerAccount.findOne({ _id: tx.accountId, tenantId }).session(session)
        if (!acc) throw error('not_found', 'Account not found', 404)

        tx.isDeleted = true
        tx.deletedAt = new Date()
        await tx.save({ session })

        acc.balance = await computeAccountBalance(tx.accountId, session)
        await acc.save({ session })

        out = { accountId: acc.id, balance: toMoney(acc.balance), txId: tx.id }
      })
    } catch (err) {
      const msg = String(err?.message || '')
      if (msg.includes('Transaction numbers are only allowed')) {
        return runFallback()
      }
      throw err
    }

    await auditLog(tenantId, actorUserId, 'cari_hareket_silindi', 'CustomerAccount', out?.accountId || null, { txId, mode: 'txn' })
    return { success: true, ...out }
  } finally {
    await session.endSession()
  }
}
