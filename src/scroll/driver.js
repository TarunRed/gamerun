import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)

// Returns a reactive object { progress } that updates 0→1 as user scrolls
// through #scroll-container. The caller reads .progress each frame.
export function createScrollDriver() {
  const state = { progress: 0 }

  ScrollTrigger.create({
    trigger: '#scroll-container',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
    onUpdate: (self) => {
      state.progress = self.progress
    },
  })

  return state
}

// Smooth-scroll the page to a specific sport zone
// sectionId is like 'zone-basketball'
export function scrollToZone(sectionId) {
  gsap.to(window, {
    duration: 1.4,
    scrollTo: { y: `#${sectionId}`, offsetY: 0 },
    ease: 'power2.inOut',
  })
}
