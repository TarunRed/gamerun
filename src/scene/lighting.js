import * as THREE from 'three'

export function createLighting(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 1.4)
  scene.add(ambient)

  const hemi = new THREE.HemisphereLight(0x8899bb, 0x334422, 1.2)
  scene.add(hemi)

  // Key light angled toward player positions from camera side
  const fill = new THREE.DirectionalLight(0xffffff, 1.5)
  fill.position.set(5, 8, 12)
  fill.castShadow = false
  scene.add(fill)

  return { ambient, hemi, fill }
}

// Per-zone accent point light — dropped into each sport arena
export function createZoneLight(color, position) {
  const light = new THREE.PointLight(color, 2, 30, 2)
  light.position.copy(position)
  return light
}
