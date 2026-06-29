import './style.css'
import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'
import Lenis from 'lenis'

import { SPORTS } from './sports/index.js'
import { createLighting } from './scene/lighting.js'
import { buildZone } from './scene/world.js'
import { buildCameraPath, updateCamera, progressToZoneIndex } from './scene/camera.js'
import { loadModel } from './scene/loader.js'
import { createScrollDriver } from './scroll/driver.js'
import { initNav, setActiveNavItem } from './ui/nav.js'
import { animateHeroIn } from './ui/hero.js'
import { updateSportOverlay, hideSportOverlay } from './ui/overlay.js'

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)

// ─── Lenis smooth scroll ──────────────────────────────────────────────────────
const lenis = new Lenis({ lerp: 0.1, syncTouch: true })
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((time) => lenis.raf(time * 1000))
gsap.ticker.lagSmoothing(0)

// ─── Renderer ────────────────────────────────────────────────────────────────

const canvas = document.getElementById('webgl')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))  // cap at 1.5 — saves ~44% GPU pixels vs 2x
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 2.2

const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels-root') })
labelRenderer.setSize(window.innerWidth, window.innerHeight)

// ─── Scene ────────────────────────────────────────────────────────────────────

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x06070a)
scene.fog = new THREE.FogExp2(0x06070a, 0.014)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500)

const { posSpline, lookSpline } = buildCameraPath()

// ─── Loader ───────────────────────────────────────────────────────────────────

const loaderFill  = document.querySelector('.loader-fill')
const loaderTxt   = document.querySelector('.loader-text')
const loaderCount = document.querySelector('.loader-count')

function setLoadProgress(pct) {
  const n = Math.round(pct * 100)
  loaderFill.style.width = n + '%'
  if (loaderCount) loaderCount.textContent = n
  loaderTxt.textContent = pct < 1 ? 'Preparing arenas' : 'Ready'
}

// ─── Zone registry — sparse array, zones arrive progressively ─────────────────

const zones       = new Array(SPORTS.length).fill(null)
const allLabels   = new Array(SPORTS.length).fill(null)
const allConnectors = new Array(SPORTS.length).fill(null)

function registerZone(gltf, index) {
  const zone = buildZone(scene, SPORTS[index], gltf, index)
  zone.mixer?.update(0.016)   // prime bone world matrices for joint extraction
  zones[index]        = zone
  allLabels[index]    = createStatLabels(zone)
  allConnectors[index] = createConnectors(zone, allLabels[index])
}

// ─── Progressive init ─────────────────────────────────────────────────────────

async function init() {
  createLighting(scene)

  // ── Phase 1: load basketball only — get user into the scene fast ──────────
  setLoadProgress(0.05)
  const firstModel = await loadModel(SPORTS[0])
  registerZone(firstModel, 0)
  setLoadProgress(1 / SPORTS.length)

  // Dismiss loader: count to 100, then curtain wipes UP off screen (Awwwards pattern)
  const loader = document.getElementById('loader')
  document.body.classList.add('app-ready')

  gsap.timeline()
    .to(loaderCount, {
      textContent: 100,
      snap: { textContent: 1 },
      duration: 0.5,
      ease: 'power2.in',
    })
    .to(loader, {
      clipPath: 'polygon(0 0, 100% 0, 100% 0, 0 0)',
      duration: 0.85,
      ease: 'expo.inOut',
      onComplete: () => { loader.style.display = 'none' },
    }, '+=0.15')
    .call(() => animateHeroIn(), null, '-=0.3')

  const scrollState = createScrollDriver()
  initNav()
  tick(scrollState)

  // Fade canvas out when user scrolls past the 3D experience into marketing content
  ScrollTrigger.create({
    trigger: '#marketing-wrapper',
    start: 'top 85%',
    onEnter:     () => { gsap.to('#webgl', { opacity: 0, duration: 0.7 }); hideSportOverlay() },
    onLeaveBack: () =>   gsap.to('#webgl', { opacity: 1, duration: 0.5 }),
  })

  // ── Phase 2: load remaining 5 in parallel, silently in background ─────────
  let loaded = 1
  await Promise.all(
    SPORTS.slice(1).map((sport, idx) =>
      loadModel(sport).then(gltf => {
        loaded++
        registerZone(gltf, idx + 1)
      })
    )
  )
}

// ─── Render loop ──────────────────────────────────────────────────────────────

function tick(scrollState) {
  requestAnimationFrame(() => tick(scrollState))

  const delta   = clock.getDelta()
  const elapsed = clock.getElapsedTime()
  const t       = scrollState.progress

  // Camera along spline
  updateCamera(camera, posSpline, lookSpline, t)

  // Zone-centered coordinate: zone k center lands at zt = k+1
  // Bounds 0.5–6.5 match exactly the first/last zone half-width so labels
  // disappear the moment the camera exits the first or last arena
  const zt          = t * 7
  const inZone      = zt > 0.5 && zt < 6.5
  const currentZone = progressToZoneIndex(t)

  zones.forEach((zone, i) => {
    if (!zone) return

    const dist = Math.abs(zt - (i + 1))

    // Only animate mixers within 1.5 zones of camera (skip 3-4 distant zones)
    if (dist < 1.5) zone.mixer?.update(delta)

    // Particle drift only for the active zone
    if (dist < 0.8) animateParticles(zone, elapsed)

    // Cross-fade backdrop: full at center, gone by the time adjacent zone center is reached
    zone.backdrop.material.opacity = Math.max(0, 1 - Math.max(0, dist - 0.45) / 0.55)
  })

  // Zone label activation
  if (inZone && currentZone !== activeZoneIndex) {
    if (activeZoneIndex >= 0) hideZoneLabels(activeZoneIndex)
    activeZoneIndex = currentZone
    showZoneLabels(currentZone)
    updateSportOverlay(currentZone)
    setActiveNavItem(currentZone)
  } else if (!inZone && activeZoneIndex >= 0) {
    hideZoneLabels(activeZoneIndex)
    hideSportOverlay()
    activeZoneIndex = -1
  }

  if (inZone) updateFog(t)

  renderer.render(scene, camera)
  labelRenderer.render(scene, camera)
}

// ─── State ────────────────────────────────────────────────────────────────────

const clock = new THREE.Clock()
let activeZoneIndex = -1

// ─── Label helpers ────────────────────────────────────────────────────────────

function showZoneLabels(idx) {
  if (!allLabels[idx]) return
  allLabels[idx].forEach(({ el, dotEl }, i) => {
    gsap.to(el,    { opacity: 1, duration: 0.4, delay: i * 0.09, ease: 'power2.out' })
    gsap.to(dotEl, { opacity: 1, duration: 0.3, delay: i * 0.07, ease: 'power2.out' })
  })
  allConnectors[idx]?.forEach(({ mat }, i) => {
    gsap.to(mat, { opacity: 0.55, duration: 0.4, delay: i * 0.09 })
  })
}

function hideZoneLabels(idx) {
  if (!allLabels[idx]) return
  allLabels[idx].forEach(({ el, dotEl }) => {
    gsap.set(el,    { opacity: 0 })
    gsap.set(dotEl, { opacity: 0 })
  })
  allConnectors[idx]?.forEach(({ mat }) => { mat.opacity = 0 })
}

// ─── Fog interpolation ────────────────────────────────────────────────────────

const _fogA = new THREE.Color()
const _fogB = new THREE.Color()

function updateFog(t) {
  const frac = t * SPORTS.length
  const a = Math.min(Math.floor(frac), SPORTS.length - 1)
  const b = Math.min(a + 1, SPORTS.length - 1)
  _fogA.set(SPORTS[a].fogColor)
  _fogB.set(SPORTS[b].fogColor)
  scene.fog.color.lerpColors(_fogA, _fogB, frac - a)
  renderer.setClearColor(scene.fog.color)
}

// ─── Particle drift ───────────────────────────────────────────────────────────

function animateParticles(zone, t) {
  const pos = zone.particles.geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) + Math.sin(t * 0.4 + i * 0.3) * 0.001)
  }
  pos.needsUpdate = true
}

// ─── Stat labels ──────────────────────────────────────────────────────────────

const SPREADS = [
  { x: -2.4, z: -1.2 }, { x: 2.6, z: 0.8 },
  { x: -2.0, z:  1.4 }, { x: 1.8, z: -1.5 },
  { x: -1.2, z:  0.4 },
]

function createStatLabels(zone) {
  const accent = zone.sport.accentHex

  return zone.sport.stats.map((stat, i) => {
    const joint = zone.joints[stat.joint] || new THREE.Vector3(0, 1, 0)
    const sp    = SPREADS[i] || { x: 0, z: 0 }

    // ── Stat card label ──────────────────────────────────────────────────────
    const el = document.createElement('div')
    el.className = 'stat-label'
    el.innerHTML = `
      <div class="stat-card">
        <div class="stat-card-name">${stat.name}</div>
        <div class="stat-card-value">${stat.value}<span class="stat-card-unit">${stat.unit}</span></div>
      </div>`

    const obj = new CSS2DObject(el)
    obj.position.set(joint.x + sp.x, joint.y + 0.1, joint.z + sp.z)
    zone.group.add(obj)

    // ── Joint dot — glowing indicator at the body part (ai.io style) ────────
    const dotEl = document.createElement('div')
    dotEl.className = 'joint-dot'
    dotEl.style.setProperty('--dot-color', accent)
    const dotObj = new CSS2DObject(dotEl)
    dotObj.position.copy(joint)
    zone.group.add(dotObj)

    return { obj, el, stat, dotObj, dotEl }
  })
}

function createConnectors(zone, labels) {
  return zone.sport.stats.map((stat, i) => {
    const joint = zone.joints[stat.joint] || new THREE.Vector3(0, 1, 0)
    const label = labels[i].obj
    const geo   = new THREE.BufferGeometry().setFromPoints([joint.clone(), label.position.clone()])
    const mat   = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
    zone.group.add(new THREE.Line(geo, mat))
    return { mat }
  })
}

// ─── Resize ───────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  ScrollTrigger.refresh()
})

// ─── Marketing section scroll-reveal via IntersectionObserver ─────────────────

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view')
      revealObserver.unobserve(entry.target)
    }
  })
}, { threshold: 0.12 })

document.querySelectorAll('.mkt-section').forEach(el => revealObserver.observe(el))

// ─── Boot ─────────────────────────────────────────────────────────────────────

init().catch(err => {
  console.error('GameRun init failed:', err)
  loaderTxt.textContent = 'Failed to load — check console'
})
