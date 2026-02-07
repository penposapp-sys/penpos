import jwt from 'jsonwebtoken'

const getSecret = () => {
  const isProd = process.env.NODE_ENV === 'production'
  const secret = process.env.JWT_SECRET || (isProd ? '' : 'dev_secret')
  if (isProd) {
    if (!secret || secret.length < 64) {
      throw new Error('JWT_SECRET is invalid for production')
    }
  }
  return secret
}

export const signToken = (payload) => {
  const secret = getSecret()
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d'
  return jwt.sign(payload, secret, { expiresIn })
}

export const verifyToken = (token) => {
  const secret = getSecret()
  return jwt.verify(token, secret)
}
