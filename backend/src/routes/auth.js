import { Router } from 'express'
import { forgotPassword, login, me, resetPassword } from '../services/authService.js'
import { requireAuth } from '../middlewares/requireAuth.js'
import { sendError } from '../utils/errors.js'
import { error as logError } from '../utils/logger.js'

const router = Router()

router.post('/login', async (req, res) => {
  try {
    const { identifier, email, password, portal } = req.body || {}
    const result = await login(identifier ?? email, password, portal, { requestId: req.requestId })
    res.json(result)
  } catch (err) {
    try {
      const { identifier, email, portal } = req.body || {}
      const ident = String(identifier ?? email ?? '').trim()
      const p = String(portal ?? '').trim()
      if (process.env.DEBUG_LOGIN === '1') {
        logError('[AUTH_LOGIN_ROUTE_ERROR]', { requestId: req.requestId || null, identifier: ident, portal: p }, err?.stack || err)
      } else {
        logError('[AUTH_LOGIN_ROUTE_ERROR]', { requestId: req.requestId || null, identifier: ident, portal: p, msg: String(err?.message || 'Internal error') })
      }
    } catch {
    }
    sendError(res, err)
  }
})

router.post('/forgot-password', async (req, res) => {
  try {
    const { email, portal } = req.body || {}
    const result = await forgotPassword(email, portal)
    res.json(result)
  } catch (err) {
    try {
      const { email, portal } = req.body || {}
      logError('[AUTH_FORGOT_PASSWORD_ROUTE_ERROR]', {
        requestId: req.requestId || null,
        email: String(email || '').trim().toLowerCase(),
        portal: String(portal || '').trim().toLowerCase(),
        code: String(err?.code || err?.payload?.error || ''),
        msg: String(err?.message || 'Internal error')
      }, err?.stack || err)
    } catch {}
    sendError(res, err)
  }
})

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {}
    const result = await resetPassword(token, newPassword)
    res.json(result)
  } catch (err) {
    sendError(res, err)
  }
})

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await me(req.user.id)
    res.json({ user })
  } catch (err) {
    sendError(res, err)
  }
})

export default router
