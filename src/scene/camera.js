import * as THREE from 'three'
import { ZONE_GAP } from './world.js'
import { SPORTS } from '../sports/index.js'

// Camera follows a smooth CatmullRom spline across all 6 zones
// scrollProgress (0→1) maps to t along the spline

const CAMERA_HEIGHT = 1.0   // eye-level — player stands tall against arena backdrop
const CAMERA_Z = 4.5        // player fills ~45% of frame height, arena visible above
const LOOK_HEIGHT = 1.4     // aim at player chest; slight upward tilt = cinematic angle

export function buildCameraPath() {
  // One control point per zone, plus entry/exit padding points
  const count = SPORTS.length
  const positions = []
  const lookAts = []

  // Pre-hero point (off-screen left)
  positions.push(new THREE.Vector3(-ZONE_GAP * 0.8, CAMERA_HEIGHT + 2, CAMERA_Z))
  lookAts.push(new THREE.Vector3(-ZONE_GAP * 0.8, LOOK_HEIGHT, 0))

  for (let i = 0; i < count; i++) {
    const x = i * ZONE_GAP
    // Slight Z oscillation for cinematic feel
    const zOffset = Math.sin((i / (count - 1)) * Math.PI) * 2
    positions.push(new THREE.Vector3(x, CAMERA_HEIGHT, CAMERA_Z + zOffset))
    lookAts.push(new THREE.Vector3(x, LOOK_HEIGHT, 0))
  }

  // Post-CTA point
  const lastX = (count - 1) * ZONE_GAP
  positions.push(new THREE.Vector3(lastX + ZONE_GAP * 0.8, CAMERA_HEIGHT, CAMERA_Z))
  lookAts.push(new THREE.Vector3(lastX, LOOK_HEIGHT, 0))

  const posSpline = new THREE.CatmullRomCurve3(positions, false, 'catmullrom', 0.5)
  const lookSpline = new THREE.CatmullRomCurve3(lookAts,  false, 'catmullrom', 0.5)

  return { posSpline, lookSpline }
}

// Call every frame: t = scroll progress 0→1
export function updateCamera(camera, posSpline, lookSpline, t) {
  const pos = posSpline.getPoint(t)
  const look = lookSpline.getPoint(t)

  camera.position.copy(pos)
  camera.lookAt(look)
}

// Map scroll progress to active zone index (0-5)
export function progressToZoneIndex(t) {
  const frac = t * SPORTS.length
  return Math.min(Math.floor(frac), SPORTS.length - 1)
}

// Return t value for the center of a given zone index
export function zoneIndexToProgress(index) {
  return (index + 0.5) / SPORTS.length
}
