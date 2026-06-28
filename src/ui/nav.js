import gsap from 'gsap'
import { scrollToZone } from '../scroll/driver.js'

const ZONE_IDS = [
  'zone-basketball', 'zone-hockey', 'zone-soccer',
  'zone-baseball',   'zone-fencing', 'zone-softball',
]

export function initNav() {
  const nav   = document.getElementById('sport-nav')
  const pills = document.querySelectorAll('.sport-pill')

  // Slide nav in once hero scrolls out of view
  gsap.to(nav, {
    y: 0, opacity: 1,
    duration: 0.7, ease: 'power3.out',
    scrollTrigger: {
      trigger: '#hero-section',
      start: 'bottom 80%',
      toggleActions: 'play none none reverse',
    },
  })

  // Click → scroll to that sport's zone
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const idx = parseInt(pill.dataset.sport, 10)
      scrollToZone(ZONE_IDS[idx])
    })
  })
}

export function setActiveNavItem(index) {
  document.querySelectorAll('.sport-pill').forEach((el, i) => {
    el.classList.toggle('active', i === index)
  })
}
