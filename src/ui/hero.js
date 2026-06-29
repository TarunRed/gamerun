import gsap from 'gsap'

export function animateHeroIn() {
  const tl = gsap.timeline({ delay: 0.2 })

  // Eyebrow slides in from left
  tl.from('.hero-eyebrow', {
    xPercent: -8,
    opacity: 0,
    duration: 0.7,
    ease: 'power2.out',
  })

  // Title lines: masked slide-up (Awwwards pattern — overflow:hidden + translateY)
  .from('.hero-title .line-i', {
    yPercent: 105,
    duration: 0.9,
    stagger: 0.1,
    ease: 'expo.out',
  }, '-=0.3')

  // Subtitle fade up
  .from('.hero-sub', {
    y: 18,
    opacity: 0,
    duration: 0.7,
    ease: 'power2.out',
  }, '-=0.4')

  // CTA button scales in slightly
  .from('.hero-cta', {
    y: 14,
    opacity: 0,
    duration: 0.6,
    ease: 'power2.out',
  }, '-=0.4')

  // Metrics count up slightly after CTA
  .from('.hero-metric', {
    y: 10,
    opacity: 0,
    duration: 0.5,
    stagger: 0.08,
    ease: 'power2.out',
  }, '-=0.3')

  // Scroll hint
  .from('.hero-scroll-hint', {
    opacity: 0,
    duration: 0.5,
    ease: 'power2.out',
  }, '-=0.1')

  // Make sure the parent wrapper itself is visible
  gsap.set('.hero-content', { opacity: 1 })
}
