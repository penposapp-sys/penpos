import express from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'
import { rateLimit } from './middlewares/rateLimit.js'
import healthRouter from './routes/health.js'
import authRouter from './routes/auth.js'
import superadminRouter from './routes/superadmin.js'
import tenantRouter from './routes/tenant.js'
import tenantStaffRouter from './routes/tenantStaff.js'
import tenantBranchesRouter from './routes/tenantBranches.js'
import branchesRouter from './routes/branches.js'
import categoriesRouter from './routes/categories.js'
import menuItemsRouter from './routes/menuItems.js'
import posRouter from './routes/pos.js'
import publicRouter from './routes/public.js'
import kitchenRouter from './routes/kitchen.js'
import reportsRouter from './routes/reports.js'
import tablesRouter from './routes/tables.js'
import tenantAuditRouter from './routes/tenantAudit.js'
import paymentSettingsRouter from './routes/paymentSettings.js'
import platformRouter from './routes/platform.js'
import paymentsRouter from './routes/payments.js'
import accountsRouter from './routes/accounts.js'
import settingsProductsRouter from './routes/settingsProducts.js'
import settingsLogoRouter from './routes/settingsLogo.js'
import settingsMenuRouter from './routes/settingsMenu.js'
import userPreferencesRouter from './routes/userPreferences.js'
import printingRouter from './routes/printing.js'
import { requireActiveSubscription } from './middlewares/requireActiveSubscription.js'
import { requireAuth } from './middlewares/requireAuth.js'
import { tenantGuard } from './middlewares/tenantGuard.js'
import { sendError } from './utils/errors.js'
import { UPLOADS_STATIC_DIRS } from './utils/uploads.js'
import debugRouter from './routes/debug.js'
import canteenRouter from './modules/canteen/routes/canteen.js'
import { getPublicWebsiteSettings } from './controllers/websiteSettingsController.js'

export const createServer = () => {
  const app = express()
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const isProd = process.env.NODE_ENV === 'production'
  const corsOrigin = isProd ? process.env.CORS_ORIGIN : undefined
  if (!isProd) {
    app.set('etag', false)
  }
  if (isProd) {
    const opts = corsOrigin
      ? {
          origin: corsOrigin,
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'x-branch-id', 'X-Request-Id'],
          optionsSuccessStatus: 204
        }
      : {
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'x-branch-id', 'X-Request-Id'],
          optionsSuccessStatus: 204
        }
    app.use(cors(opts))
    app.options('*', cors(opts))
  } else {
    const allowlist = new Set([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://192.168.1.233:5173'
    ])
    const privateLanRegexes = [
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/,
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/,
      /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:5173$/
    ]
    const opts = {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true)
        if (allowlist.has(origin)) return cb(null, true)
        if (privateLanRegexes.some((regex) => regex.test(origin))) return cb(null, true)
        return cb(null, false)
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-branch-id', 'X-Request-Id'],
      optionsSuccessStatus: 204
    }
    app.use(cors(opts))
    app.options('*', cors(opts))
  }
  app.use(express.json())
  app.use('/public', express.static(path.join(__dirname, '..', 'public')))
  const uploadsStaticOptions = {
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}uploads${path.sep}products${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000')
      }
    }
  }
  for (const uploadsDir of UPLOADS_STATIC_DIRS) {
    app.use('/uploads', express.static(uploadsDir, uploadsStaticOptions))
    app.use('/api/uploads', express.static(uploadsDir, uploadsStaticOptions))
  }
  app.use((req, res, next) => {
    const id = randomUUID()
    req.requestId = id
    res.locals.requestId = id
    res.setHeader('X-Request-Id', id)
    next()
  })
  try {
    console.log('[BUILD_STAMP]', {
      ts: new Date().toISOString(),
      cwd: process.cwd(),
      node: process.version
    })
  } catch {}
  const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 })
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: (req) => {
      const m = String(req.method || 'GET').toUpperCase()
      if (m === 'GET' || m === 'HEAD') return 600
      return 120
    },
    retryAfterSeconds: 2
  })

  app.use('/api/health', healthRouter)
  app.use('/api/auth', loginLimiter, authRouter)
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/health')) return next()
    apiLimiter(req, res, next)
  })
  app.use('/api/superadmin', superadminRouter)
  app.use('/api/tenant', tenantRouter)
  app.use('/api/kermes', tenantRouter)
  app.use('/api/tenant/staff', requireAuth, tenantGuard, requireActiveSubscription, tenantStaffRouter)
  app.use('/api/tenant/branches', requireAuth, tenantGuard, requireActiveSubscription, tenantBranchesRouter)
  app.use('/api/branches', requireAuth, tenantGuard, requireActiveSubscription, branchesRouter)
  app.use('/api/tenant/categories', requireAuth, tenantGuard, requireActiveSubscription, categoriesRouter)
  app.use('/api/tenant/menu-items', requireAuth, tenantGuard, requireActiveSubscription, menuItemsRouter)
  app.use('/api/pos', requireAuth, tenantGuard, requireActiveSubscription, posRouter)
  app.use('/api/public', publicRouter)
  app.get('/api/website-settings/public', getPublicWebsiteSettings)
  app.use('/api/debug', debugRouter)
  try { console.log('[DEBUG_STAMP]', 'branch_fix_v5', process.cwd()) } catch {}
  try {
    const routes = (posRouter.stack || [])
      .filter(r => r.route)
      .map(r => {
        const method = Object.keys(r.route.methods || {})[0]?.toUpperCase() || 'GET'
        return `${method} /api/pos${r.route.path}`
      })
    console.log('POS ROUTES REGISTERED:', routes)
  } catch {}
  try {
    const routes = (branchesRouter.stack || [])
      .filter(r => r.route)
      .map(r => {
        const method = Object.keys(r.route.methods || {})[0]?.toUpperCase() || 'GET'
        return `${method} /api/branches${r.route.path}`
      })
    console.log('BRANCHES ROUTES REGISTERED:', routes)
  } catch {}
  app.use('/api/kitchen', requireAuth, tenantGuard, requireActiveSubscription, kitchenRouter)
  app.use('/api/accounts', requireAuth, tenantGuard, requireActiveSubscription, accountsRouter)
  app.use('/api/kermes/cari', requireAuth, tenantGuard, requireActiveSubscription, accountsRouter)
  app.use('/api/reports', (req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
      res.set('Cache-Control', 'no-store')
      res.set('Pragma', 'no-cache')
    }
    next()
  })
  app.use('/api/reports', requireAuth, tenantGuard, requireActiveSubscription, reportsRouter)
  app.use('/api/tenant/tables', requireAuth, tenantGuard, requireActiveSubscription, tablesRouter)
  app.use('/api/tenant/audit', tenantAuditRouter)
  app.use('/api/tenant/payment-settings', requireAuth, tenantGuard, requireActiveSubscription, paymentSettingsRouter)
  app.use('/api/platform', platformRouter)
  app.use('/api/payments', paymentsRouter)
  app.use('/api/printing', printingRouter)
  app.use('/api/settings/products', requireAuth, tenantGuard, requireActiveSubscription, settingsProductsRouter)
  app.use('/api/settings/menu', requireAuth, tenantGuard, requireActiveSubscription, settingsMenuRouter)
  app.use('/api/settings', requireAuth, tenantGuard, requireActiveSubscription, settingsLogoRouter)
  app.use('/api/user/preferences', userPreferencesRouter)
  app.use('/api/canteen', canteenRouter)
  try {
    const routes = (canteenRouter.stack || [])
      .filter(r => r.route)
      .map(r => {
        const method = Object.keys(r.route.methods || {})[0]?.toUpperCase() || 'GET'
        return `${method} /api/canteen${r.route.path}`
      })
    console.log('CANTEEN ROUTES REGISTERED:', routes)
  } catch {}
  try {
    const routes = (platformRouter.stack || [])
      .filter(r => r.route)
      .map(r => {
        const method = Object.keys(r.route.methods || {})[0]?.toUpperCase() || 'GET'
        return `${method} /api/platform${r.route.path}`
      })
    console.log('PLATFORM ROUTES REGISTERED:', routes)
  } catch {}
  app.get('/api', (req, res) => {
    res.json({ ok: true })
  })

  app.use((err, req, res, next) => {
    sendError(res, err)
  })

  return app
}
