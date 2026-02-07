import mongoose from 'mongoose'
import { error } from '../utils/errors.js'

export const validateObjectIdParam = (paramName = 'id') => {
  return (req, _res, next) => {
    const raw = req?.params?.[paramName]
    const id = String(raw || '')
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const label = paramName === 'id' ? 'orderId' : paramName
      return next(error('invalid_request', `Invalid ${label}`, 400))
    }
    return next()
  }
}
