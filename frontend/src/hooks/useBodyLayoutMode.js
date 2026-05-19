import { useEffect } from 'react'

const BODY_LAYOUT_CLASSES = ['pos-app-layout', 'public-site-layout']

export function useBodyLayoutMode(mode) {
  useEffect(() => {
    if (!mode || typeof document === 'undefined') return undefined

    const { body } = document
    if (!body) return undefined

    BODY_LAYOUT_CLASSES.forEach((className) => {
      body.classList.remove(className)
    })
    body.classList.add(mode)

    return () => {
      body.classList.remove(mode)
    }
  }, [mode])
}
