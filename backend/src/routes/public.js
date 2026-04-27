import { Router } from 'express'
import { downloadPrintAgentSetup, getPrintAgentWindowsManifest, getPublicMenu } from '../controllers/publicController.js'

const router = Router()

router.get('/menu', getPublicMenu)
router.get('/downloads/print-agent/windows/manifest', getPrintAgentWindowsManifest)
router.get('/downloads/print-agent/windows', downloadPrintAgentSetup)

export default router
