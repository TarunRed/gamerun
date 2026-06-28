import './style.css'
import * as THREE from 'three'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollToPlugin } from 'gsap/ScrollToPlugin'

import { SPORTS } from './sports/index.js'
import { createLighting } from './scene/lighting.js'
import { buildWorld } from './scene/world.js'
import { buildCameraPath, updateCamera, progressToZoneIndex } from './scene/camera.js'
import { loadAllModels } from './scene/loader.js'
import { createScrollDriver } from './scroll/driver.js'
import { initNav, setActiveNavItem } from './ui/nav.js'
import { animateHeroIn } from './ui/hero.js'
import { updateSportOverlay, hideSportOverlay } from './ui/overlay.js'

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)

// ─── Renderer ────────────────────────────────────────────────────────────────

const canvas = document.getElementById('webgl')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 2.2  // brighter scene so characters and court read clearly

const labelRenderer = new CSS2DRenderer({ element: document.getElementById('labels-root') })
labelRenderer.setSize(window.innerWidth, window.innerHeight)

// ─── Scene ────────────────────────────────────────────────────────────────────

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x06070a)
scene.fog = new THREE.FogExp2(0x06070a, 0.014)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500)

// ─── Camera path (built once, doesn't need models) ───────────────────────────

const { posSpline, lookSpline } = buildCameraPath()

// ─── Loader UI ───────────────────────────────────────────────────────────────

const fill      = document.querySelector('.loader-fill')
const loaderTxt = document.querySelector('.loader-text')

function setLoadProgress(pct) {
  fill.style.width = Math.round(pct * 100) + '%'
  loaderTxt.textContent = pct < 1
    ? `Loading athletes... ${Math.round(pct * 100)}%`
    : 'Ready'
}

// ─── Bootstrap: load all models, then build world ────────────────────────────

async function init() {
  createLighting(scene)

  // Load all 6 GLBs; loader bar reflects real progress
  const models = await loadAllModels(setLoadProgress)

  const zones = buildWorld(scene, models)

  // One tick so bone world matrices are populated before joint extraction
  zones.forEach(z => z.mixer?.update(0.016))

  // ─── Stat labels & connectors ───────────────────────────────────────────
  const allLabels     = zones.map(z => createStatLabels(z))
  const allConnectors = zones.map((z, i) => createConnectors(z, allLabels[i]))

  // ─── Scroll driver ───────────────────────────────────────────────────────
  const scrollState = createScrollDriver()

  // ─── Nav ─────────────────────────────────────────────────────────────────
  initNav()

  // ─── Dismiss loader & start hero ─────────────────────────────────────────
  // Dismiss loader immediately — no extra delay
  gsap.to('#loader', {
    opacity: 0, duration: 0.5, ease: 'power2.inOut',
    onComplete: () => { document.getElementById('loader').style.display = 'none' },
  })
  animateHeroIn()

  // ─── Zone state ──────────────────────────────────────────────────────────
  let activeZoneIndex = -1

  function showZoneLabels(idx) {
    allLabels[idx].forEach(({ el }, i) => {
      gsap.to(el, { opacity: 1, duration: 0.4, delay: i * 0.08, ease: 'power2.out' })
    })
    allConnectors[idx].forEach(({ mat }, i) => {
      gsap.to(mat, { opacity: 0.5, duration: 0.4, delay: i * 0.08 })
    })
  }

  function hideZoneLabels(idx) {
    // Instant kill — no fade so dead-zone labels never bleed into the next sport
    allLabels[idx].forEach(({ el }) => gsap.set(el, { opacity: 0 }))
    allConnectors[idx].forEach(({ mat }) => { mat.opacity = 0 })
  }

  // ─── Fog interpolation ───────────────────────────────────────────────────
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

  // ─── Particle drift ──────────────────────────────────────────────────────
  function animateParticles(zone, t) {
    const pos = zone.particles.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, pos.getY(i) + Math.sin(t * 0.4 + i * 0.3) * 0.001)
    }
    pos.needsUpdate = true
  }

  // ─── Render loop ─────────────────────────────────────────────────────────
  const clock = new THREE.Clock()

  function tick() {
    requestAnimationFrame(tick)

    const delta   = clock.getDelta()
    const elapsed = clock.elapsedTime
    const t       = scrollState.progress

    // Advance all animation mixers
    zones.forEach(z => z.mixer?.update(delta))

    // Drift particles
    zones.forEach(z => animateParticles(z, elapsed))

    // Camera along spline
    updateCamera(camera, posSpline, lookSpline, t)

    // Zone activation
    const zoneProgress = t * SPORTS.length
    const inZone       = zoneProgress > 0.15 && zoneProgress < SPORTS.length - 0.15
    const currentZone  = progressToZoneIndex(t)

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

    // Cross-fade backdrop opacity: full at zone center, fades between zones
    // Zone k center lands at scroll progress (k+1)/7, so in t*7 space it is at k+1
    const zt = t * 7
    zones.forEach((zone, i) => {
      const dist = Math.abs(zt - (i + 1))  // 0 at center, 1 = one full zone away
      const opacity = Math.max(0, 1 - Math.max(0, dist - 0.45) / 0.55)
      zone.backdrop.material.opacity = opacity
    })

    renderer.render(scene, camera)
    labelRenderer.render(scene, camera)
  }

  tick()
}

init().catch(err => {
  console.error('GameRun init failed:', err)
  loaderTxt.textContent = 'Failed to load — check console'
})

// ─── Stat labels ─────────────────────────────────────────────────────────────

function createStatLabels(zone) {
  // Fixed spread offsets so labels don't randomise on reload
  const spreads = [
    { x: -2.4, z: -1.2 },
    { x:  2.6, z:  0.8 },
    { x: -2.0, z:  1.4 },
    { x:  1.8, z: -1.5 },
    { x: -1.2, z:  0.4 },
  ]

  return zone.sport.stats.map((stat, i) => {
    const el = document.createElement('div')
    el.className = 'stat-label'
    el.innerHTML = `
      <div class="stat-card">
        <div class="stat-card-name">${stat.name}</div>
        <div class="stat-card-value">${stat.value}<span class="stat-card-unit">${stat.unit}</span></div>
      </div>`

    const obj = new CSS2DObject(el)
    const joint = zone.joints[stat.joint] || new THREE.Vector3(0, 1, 0)
    const sp    = spreads[i] || { x: 0, z: 0 }

    // Position in world space (zone group is at centerX, so joint is already world-space)
    obj.position.set(
      joint.x + sp.x,
      joint.y + 0.1,
      joint.z + sp.z
    )
    zone.group.add(obj)

    return { obj, el, stat }
  })
}

function createConnectors(zone, labels) {
  return zone.sport.stats.map((stat, i) => {
    const joint = zone.joints[stat.joint] || new THREE.Vector3(0, 1, 0)
    const label = labels[i].obj

    // Start and end in group-local space
    const start = joint.clone()
    const end   = label.position.clone()

    const geo = new THREE.BufferGeometry().setFromPoints([start, end])
    const mat = new THREE.LineBasicMaterial({
      color: zone.sport.color,
      transparent: true,
      opacity: 0,
    })
    const mesh = new THREE.Line(geo, mat)
    zone.group.add(mesh)

    return { mesh, mat, geo, start, end }
  })
}

// ─── Resize ───────────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  ScrollTrigger.refresh()
})
