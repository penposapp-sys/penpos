import { sendError } from '../utils/errors.js'
import { listAccountsService, createAccountService, updateAccountService, deleteAccountService, getAccountService, listTransactionsService, getTransactionOrderService, collectDebtService, deleteCollectionTransactionService } from '../services/accountsService.js'
import { findTenantById } from '../repositories/tenantRepository.js'
import { applyBranchFilter } from '../utils/branchFilter.js'

const ensureTenantAndBranch = (req, res) => {
  const tenantId = req.user?.tenantId
  const branchId = req.user?.branchId
  if (!tenantId) {
    res.status(403).json({ status: 403, code: 'missing_tenant', message: 'Tenant required' })
    return null
  }
  if (!branchId) {
    try {
      console.error('[MISSING_BRANCH_SOURCE]', { route: req.originalUrl, stack: new Error('MISSING_BRANCH_HIT').stack })
    } catch {}
    res.status(403).json({ status: 403, code: 'missing_branch', message: 'Branch required' })
    return null
  }
  return { tenantId, branchId }
}

export const listAccounts = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId
    if (!tenantId) return res.status(403).json({ status: 403, code: 'missing_tenant', message: 'Tenant required' })

    const branchIds = Array.isArray(req.branchIds) ? req.branchIds.map(String).filter(Boolean) : []
    if (branchIds.length === 0) {
      return res.status(403).json({
        success: false,
        code: 'no_allowed_branches',
        error: 'no_allowed_branches',
        message: 'Kullanıcıya atanmış aktif şube yok'
      })
    }
    if (process.env.NODE_ENV !== 'production') {
      try {
        const finalQuery = applyBranchFilter({ tenantId }, branchIds)
        console.debug('[BRANCH_FILTER]', { route: req.originalUrl, branchIds, finalQuery })
      } catch {}
    }
    const result = await listAccountsService(tenantId, { branchIds }, req.query)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const createAccount = async (req, res) => {
  try {
    const ctx = ensureTenantAndBranch(req, res)
    if (!ctx) return
    const { tenantId, branchId } = ctx
    const name = String(req.body?.name || '').trim()
    if (!name) {
      return res.status(400).json({ success: false, code: 'name_required', error: 'name_required', message: 'Name required' })
    }

    const result = await createAccountService(tenantId, branchId, req.user.id, { ...req.body, name })
    res.json(result)
  } catch (err) {
    if (err?.name === 'ValidationError') {
      return res.status(400).json({ success: false, code: 'validation_error', error: 'validation_error', message: err.message })
    }
    if ((err?.status && err?.payload?.error) || err?.payload?.error) {
      return sendError(res, err)
    }
    try {
      console.error('[ACCOUNTS_CREATE_500]', err?.stack || err)
    } catch {}
    return res.status(500).json({ success: false, code: 'internal_error', error: 'internal_error', message: 'Internal Server Error' })
  }
}

export const updateAccount = async (req, res) => {
  try {
    const ctx = ensureTenantAndBranch(req, res)
    if (!ctx) return
    const { tenantId, branchId } = ctx
    const result = await updateAccountService(tenantId, branchId, req.user.id, req.params.id, req.body)
    res.json(result)
  } catch (err) {
    if (err?.name === 'ValidationError') {
      return res.status(400).json({ success: false, code: 'validation_error', error: 'validation_error', message: err.message })
    }
    sendError(res, err)
  }
}

export const deleteAccount = async (req, res) => {
  try {
    const ctx = ensureTenantAndBranch(req, res)
    if (!ctx) return
    const { tenantId, branchId } = ctx
    const result = await deleteAccountService(tenantId, branchId, req.user.id, req.params.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const getAccount = async (req, res) => {
  try {
    const ctx = ensureTenantAndBranch(req, res)
    if (!ctx) return
    const { tenantId, branchId } = ctx
    const result = await getAccountService(tenantId, branchId, req.params.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const listTransactions = async (req, res) => {
  try {
    const ctx = ensureTenantAndBranch(req, res)
    if (!ctx) return
    const { tenantId, branchId } = ctx
    const result = await listTransactionsService(tenantId, branchId, req.params.id, req.query)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const getTransactionOrder = async (req, res) => {
  try {
    const ctx = ensureTenantAndBranch(req, res)
    if (!ctx) return
    const { tenantId, branchId } = ctx
    const result = await getTransactionOrderService(tenantId, branchId, req.params.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}

export const collect = async (req, res) => {
  try {
    const ctx = ensureTenantAndBranch(req, res)
    if (!ctx) return
    const { tenantId, branchId } = ctx
    const result = await collectDebtService(tenantId, branchId, req.user.id, req.params.id, req.body)
    res.json({ success: true, ...result })
  } catch (err) {
    sendError(res, err)
  }
}

export const deleteTransaction = async (req, res) => {
  try {
    const ctx = ensureTenantAndBranch(req, res)
    if (!ctx) return
    const { tenantId, branchId } = ctx
    const result = await deleteCollectionTransactionService(tenantId, branchId, req.user.id, req.params.id)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
}
