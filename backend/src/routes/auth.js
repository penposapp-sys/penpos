import { Router } from 'express'
import { login, me } from '../services/authService.js'
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

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await me(req.user.id)
    res.json({ user })
  } catch (err) {
    sendError(res, err)
  }
})

export default router
