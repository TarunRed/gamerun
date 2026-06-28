import gsap from 'gsap'

export function animateHeroIn() {
  const tl = gsap.timeline({ delay: 0.3 })

  tl.to('.hero-eyebrow', {
    opacity: 1,
    duration: 0.7,
    ease: 'power2.out',
  })
  .to('.hero-title', {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: 'power3.out',
  }, '-=0.3')
  .to('.hero-sub', {
    opacity: 1,
    duration: 0.8,
    ease: 'power2.out',
  }, '-=0.5')
  .to('.hero-scroll-hint', {
    opacity: 1,
    duration: 0.6,
    ease: 'power2.out',
  }, '-=0.3')
}
