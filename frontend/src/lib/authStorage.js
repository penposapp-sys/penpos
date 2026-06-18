const getLocalStorage = () => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const getSessionStorage = () => {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export const AUTH_TOKEN_KEYS = ['token_restaurant', 'token_canteen', 'token_platform']

export const getAuthToken = (tokenKey) => {
  const sessionValue = getSessionStorage()?.getItem(tokenKey)
  if (sessionValue) return sessionValue
  return getLocalStorage()?.getItem(tokenKey) || ''
}

export const hasAuthToken = (tokenKey) => !!String(getAuthToken(tokenKey) || '').trim()

export const setAuthToken = (tokenKey, token, remember = true) => {
  removeAuthToken(tokenKey)
  const storage = remember ? getLocalStorage() : getSessionStorage()
  storage?.setItem(tokenKey, String(token || ''))
}

export const removeAuthToken = (tokenKey) => {
  getLocalStorage()?.removeItem(tokenKey)
  getSessionStorage()?.removeItem(tokenKey)
}

export const clearAllAuthTokens = () => {
  AUTH_TOKEN_KEYS.forEach(removeAuthToken)
}
