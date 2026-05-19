import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function ScrollReset() {
  const location = useLocation()

  useEffect(() => {
    const scrollAreas = document.querySelectorAll('.page-scroll-area')

    scrollAreas.forEach((area) => {
      area.scrollTo({
        top: 0,
        left: 0,
        behavior: 'auto'
      })
    })
  }, [location.pathname])

  return null
}
