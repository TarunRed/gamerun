import * as THREE from 'three'
import { SPORTS } from '../sports/index.js'
import { createZoneLight } from './lighting.js'
import { normalizeModel, recolourBall, extractJoints } from './loader.js'

export const ZONE_GAP = 60

// Backdrop sits behind the action; camera is at Z≈6.5–8.5 looking at Z=0
const BG_Z  = -13
const BG_W  = 44   // calibrated to exact camera view width — no adjacent zone bleed
const BG_H  = 28

const texLoader = new THREE.TextureLoader()

export function buildWorld(scene, gltfModels) {
  const zones = []

  SPORTS.forEach((sport, i) => {
    const centerX = i * ZONE_GAP
    const group = new THREE.Group()
    group.position.x = centerX
    scene.add(group)

    const floor     = buildFloor(sport)
    const markings  = buildMarkings(sport, i)
    const backdrop  = buildBackdrop(sport)
    const particles = buildParticles(sport)
    const dividers  = buildZoneDividers()  // black wings blocking adjacent zones

    group.add(floor, markings, backdrop, dividers, particles)

    // Accent point light above the player
    const light = createZoneLight(sport.color, new THREE.Vector3(0, 5, 1))
    group.add(light)

    // Warm front-fill at camera position — contrasts against cold ice/dark arenas
    // and makes players visible regardless of jersey color
    const fill = new THREE.PointLight(0xffcc66, 5, 20, 1.5)
    fill.position.set(0, 2.0, 4.2)
    group.add(fill)

    // Swap in real GLB model
    const gltf = gltfModels[i]
    const modelRoot = gltf.scene
    normalizeModel(modelRoot)

    // Recolour ball on softball
    if (sport.ballColor) recolourBall(modelRoot, sport.ballColor)

    modelRoot.traverse(child => {
      if (!child.isMesh) return
      child.castShadow = true
      child.receiveShadow = false

      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach(m => {
        if (!m) return
        m.side = THREE.DoubleSide  // visible even if model faces away from camera
        // Add a faint self-illumination so dark-textured models are always readable
        if (m.emissive !== undefined) {
          m.emissiveIntensity = Math.max(m.emissiveIntensity || 0, 0.25)
          if (m.color) m.emissive.copy(m.color).multiplyScalar(0.3)
        }
        m.needsUpdate = true
      })
    })

    group.add(modelRoot)

    // Start the first available animation
    let mixer = null
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(modelRoot)
      const clip = gltf.animations[0]
      const action = mixer.clipAction(clip)
      action.play()
    }

    // Extract joint positions for stat label placement
    // Run after first mixer update so bone world transforms are current
    const joints = extractJoints(modelRoot)

    zones.push({
      sport,
      group,
      player: modelRoot,
      particles,
      mixer,
      joints,
      centerX,
      index: i,
      backdrop,  // exposed so main.js can cross-fade opacity
    })
  })

  return zones
}

// ─── Environment pieces ───────────────────────────────────────────────────────

function buildFloor(sport) {
  const geo = new THREE.PlaneGeometry(38, 22)
  const mat = new THREE.MeshStandardMaterial({
    color: sport.floorColor,
    roughness: 0.5,
    metalness: 0.2,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  return mesh
}

function buildBackdrop(sport) {
  const geo = new THREE.PlaneGeometry(BG_W, BG_H)

  const mat = new THREE.MeshBasicMaterial({
    color: 0x333333,
    toneMapped: false,
    transparent: true,
    opacity: 1,
  })
  const mesh = new THREE.Mesh(geo, mat)
  // Moved 1.5 units lower so arena background fills more of the frame above the player
  mesh.position.set(0, BG_H / 2 - 1.5, BG_Z)

  texLoader.load(sport.bgPath, tex => {
    tex.colorSpace  = THREE.SRGBColorSpace
    tex.minFilter   = THREE.LinearFilter
    tex.magFilter   = THREE.LinearFilter
    tex.generateMipmaps = false
    mat.map   = tex
    mat.color.set(0xffffff)

    // Edge vignette alphaMap: white center (opaque) → black edges (transparent)
    // Three.js reads RED channel of alphaMap: 0=transparent, 255=opaque
    const vigCanvas = document.createElement('canvas')
    vigCanvas.width  = 512
    vigCanvas.height = 4
    const ctx = vigCanvas.getContext('2d')
    // Fill white first (fully opaque base)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 512, 4)
    // Paint black gradient at left edge
    const leftGrad = ctx.createLinearGradient(0, 0, 76, 0)   // 15% of 512
    leftGrad.addColorStop(0, 'rgba(0,0,0,1)')
    leftGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = leftGrad
    ctx.fillRect(0, 0, 76, 4)
    // Paint black gradient at right edge
    const rightGrad = ctx.createLinearGradient(436, 0, 512, 0)  // last 15%
    rightGrad.addColorStop(0, 'rgba(0,0,0,0)')
    rightGrad.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.fillStyle = rightGrad
    ctx.fillRect(436, 0, 76, 4)

    const vigTex    = new THREE.CanvasTexture(vigCanvas)
    mat.alphaMap    = vigTex
    mat.needsUpdate = true
  })

  return mesh
}

// Opaque black planes at ±ZONE_GAP/2 — act as stage wings blocking adjacent zones
function buildZoneDividers() {
  const mat = new THREE.MeshBasicMaterial({
    color: 0x06070a,   // matches scene background
    toneMapped: false,
    side: THREE.DoubleSide,
  })

  // Each wall is tall and deep enough to cover backdrop-to-camera range
  const geo = new THREE.PlaneGeometry(22, 50)  // depth(22) × height(50); Z range = -18 to +4
  const group = new THREE.Group()

  const half = ZONE_GAP / 2

  const left = new THREE.Mesh(geo, mat)
  left.rotation.y  = Math.PI / 2
  left.position.set(-half, 10, -7)
  group.add(left)

  const right = left.clone()
  right.position.set(half, 10, -7)
  group.add(right)

  return group
}

function buildMarkings(sport, index) {
  const group = new THREE.Group()
  const mat = new THREE.LineBasicMaterial({
    color: sport.color,
    transparent: true,
    opacity: 0.3,
  })

  switch (index) {
    case 0: addBasketballMarkings(group, mat); break
    case 1: addHockeyMarkings(group, mat);     break
    case 2: addSoccerMarkings(group, mat);     break
    case 3: addBaseballMarkings(group, mat);   break
    case 4: addFencingMarkings(group, mat);    break
    case 5: addSoftballMarkings(group, mat);   break
  }

  return group
}

function buildParticles(sport) {
  const count = 100
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 36
    pos[i * 3 + 1] = Math.random() * 10 + 0.5
    pos[i * 3 + 2] = (Math.random() - 0.5) * 18
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    color: sport.color, size: 0.07, transparent: true, opacity: 0.55, sizeAttenuation: true,
  })
  return new THREE.Points(geo, mat)
}

// ─── Court line helpers ────────────────────────────────────────────────────────

function line(group, mat, pts) {
  const geo = new THREE.BufferGeometry().setFromPoints(
    pts.map(p => new THREE.Vector3(p[0], 0.01, p[1]))
  )
  group.add(new THREE.Line(geo, mat))
}

function circle(group, mat, cx, cz, r, seg = 48) {
  const pts = []
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r])
  }
  line(group, mat, pts)
}

function addBasketballMarkings(g, m) {
  line(g, m, [[-19, 0], [19, 0]])
  circle(g, m, 0, 0, 1.8); circle(g, m, 0, 0, 3.6)
  line(g, m, [[-19, -3], [-11, -3], [-11, 3], [-19, 3]])
  line(g, m, [[19, -3], [11, -3], [11, 3], [19, 3]])
  circle(g, m, -15, 0, 4); circle(g, m, 15, 0, 4)
}

function addHockeyMarkings(g, m) {
  line(g, m, [[0, -11], [0, 11]])
  circle(g, m, 0, 0, 4.5)
  circle(g, m, -12, 4, 3); circle(g, m, -12, -4, 3)
  circle(g, m, 12, 4, 3);  circle(g, m, 12, -4, 3)
  circle(g, m, -17, 0, 2); circle(g, m, 17, 0, 2)
}

function addSoccerMarkings(g, m) {
  line(g, m, [[0, -11], [0, 11]])
  circle(g, m, 0, 0, 4)
  line(g, m, [[-19, -5], [-11, -5], [-11, 5], [-19, 5]])
  line(g, m, [[19, -5], [11, -5], [11, 5], [19, 5]])
  line(g, m, [[-19, -8], [-6, -8], [-6, 8], [-19, 8]])
  line(g, m, [[19, -8], [6, -8], [6, 8], [19, 8]])
}

function addBaseballMarkings(g, m) {
  line(g, m, [[0, 0], [4, 4], [0, 8], [-4, 4], [0, 0]])
  line(g, m, [[0, 0], [19, 0]]); line(g, m, [[0, 0], [0, 11]])
  circle(g, m, 0, 4, 0.6)
}

function addFencingMarkings(g, m) {
  line(g, m, [[-14, -1], [14, -1], [14, 1], [-14, 1], [-14, -1]])
  line(g, m, [[0, -1], [0, 1]])
  line(g, m, [[-7, -1], [-7, 1]]); line(g, m, [[7, -1], [7, 1]])
  line(g, m, [[-12, -1], [-12, 1]]); line(g, m, [[12, -1], [12, 1]])
}

function addSoftballMarkings(g, m) {
  // Same diamond as baseball, slightly smaller
  line(g, m, [[0, 0], [3.5, 3.5], [0, 7], [-3.5, 3.5], [0, 0]])
  line(g, m, [[0, 0], [19, 0]]); line(g, m, [[0, 0], [0, 11]])
  circle(g, m, 0, 3.5, 0.5)
}
