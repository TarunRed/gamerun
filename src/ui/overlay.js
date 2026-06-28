import gsap from 'gsap'
import { SPORTS } from '../sports/index.js'

let currentIndex = -1

export function updateSportOverlay(newIndex) {
  if (newIndex === currentIndex) return
  currentIndex = newIndex

  const overlay = document.getElementById('sport-overlay')
  const nameEl = overlay.querySelector('.sport-overlay-name')
  const taglineEl = overlay.querySelector('.sport-overlay-tagline')
  const sport = SPORTS[newIndex]

  // Slam out → swap text → slam in
  const tl = gsap.timeline()
  tl.to(overlay, { opacity: 0, y: 10, duration: 0.2, ease: 'power2.in' })
    .call(() => {
      nameEl.textContent = sport.name.toUpperCase()
      taglineEl.textContent = sport.tagline
      overlay.style.setProperty('--sport-color', sport.accentHex)
      nameEl.style.color = '#fff'
      taglineEl.style.color = sport.accentHex
    })
    .to(overlay, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' })
}

export function hideSportOverlay() {
  gsap.to(document.getElementById('sport-overlay'), {
    opacity: 0,
    duration: 0.3,
    ease: 'power2.in',
  })
  currentIndex = -1
}
