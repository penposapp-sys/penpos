import User from '../../../models/User.js'
import { error } from '../../../utils/errors.js'

export const activeUserGuard = async (req, res, next) => {
  try {
    const userId = req.user?.id || null
    if (!userId) return next(error('unauthorized', 'Unauthorized', 401))
    const user = await User.findById(userId).select('isActive').lean()
    if (!user) return next(error('unauthorized', 'Unauthorized', 401))
    if (user.isActive === false) return next(error('account_disabled', 'Account disabled', 403))
    next()
  } catch (err) {
    next(err)
  }
}
