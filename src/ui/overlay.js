import gsap from 'gsap'
import { SPORTS } from '../sports/index.js'

let currentIndex = -1

export function updateSportOverlay(newIndex) {
  if (newIndex === currentIndex) return
  currentIndex = newIndex

  const overlay = document.getElementById('sport-overlay')
  const nameEl    = overlay.querySelector('.sport-overlay-name')
  const taglineEl = overlay.querySelector('.sport-overlay-tagline')
  const sport     = SPORTS[newIndex]

  const tl = gsap.timeline()

  // Wipe out to the right, swap, wipe in from the left
  tl.to(overlay, {
      clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)',
      opacity: 1,
      duration: 0.25,
      ease: 'expo.in',
    })
    .call(() => {
      nameEl.textContent  = sport.name.toUpperCase()
      taglineEl.textContent = sport.tagline
      taglineEl.style.color = sport.accentHex
    })
    .fromTo(overlay,
      { clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)' },
      { clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', duration: 0.55, ease: 'expo.out' }
    )
}

export function hideSportOverlay() {
  gsap.to(document.getElementById('sport-overlay'), {
    clipPath: 'polygon(0 0, 0 0, 0 100%, 0 100%)',
    duration: 0.3,
    ease: 'expo.in',
    onComplete: () => {
      gsap.set(document.getElementById('sport-overlay'), { opacity: 0 })
    },
  })
  currentIndex = -1
}
