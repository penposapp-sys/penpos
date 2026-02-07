import { Router } from 'express'

const router = Router()

router.get('/stamp', (req, res) => {
  res.json({
    stamp: 'branch_fix_v5',
    cwd: process.cwd(),
    ts: new Date().toISOString()
  })
})

export default router
