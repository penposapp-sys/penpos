import { Router } from 'express'
import { getPublicMenu } from '../controllers/publicController.js'

const router = Router()

router.get('/menu', getPublicMenu)

export default router

