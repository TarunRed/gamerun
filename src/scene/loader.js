import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { SPORTS } from '../sports/index.js'

const gltfLoader = new GLTFLoader()

// Load all 6 GLBs in parallel; calls onProgress(0–1) as they finish
export async function loadAllModels(onProgress) {
  let loaded = 0
  const total = SPORTS.length

  const results = await Promise.all(
    SPORTS.map(sport =>
      new Promise((resolve, reject) => {
        gltfLoader.load(
          sport.modelPath,
          gltf => {
            loaded++
            onProgress(loaded / total)
            resolve(gltf)
          },
          undefined,
          reject
        )
      })
    )
  )

  return results
}

// Scale model so its tallest dimension = targetHeight, seat on Y=0
export function normalizeModel(gltfScene, targetHeight = 2.2) {
  const box = new THREE.Box3().setFromObject(gltfScene)
  if (box.isEmpty()) return gltfScene

  const size = box.getSize(new THREE.Vector3())

  // Use largest axis so models exported upright OR sideways both scale correctly
  const tallest = Math.max(size.x, size.y, size.z) || 1
  const scale = targetHeight / tallest
  gltfScene.scale.setScalar(scale)

  // Re-derive bounds after scaling
  const box2 = new THREE.Box3().setFromObject(gltfScene)
  const centre = box2.getCenter(new THREE.Vector3())

  // Centre X and Z so the player mesh is at group origin
  gltfScene.position.x -= centre.x
  gltfScene.position.z -= centre.z
  gltfScene.position.y -= box2.min.y

  return gltfScene
}

// Traverse model and recolour any mesh whose name contains "ball"
export function recolourBall(root, hexColor) {
  const col = new THREE.Color(hexColor)
  root.traverse(child => {
    if (!child.isMesh) return
    const name = (child.name || '').toLowerCase()
    if (!name.includes('ball') && !name.includes('sphere') && !name.includes('puck')) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    mats.forEach(m => {
      if (m && m.color) {
        m.color.copy(col)
        m.emissive?.set(col)
        m.emissiveIntensity = 0.15
      }
    })
  })
}

// Return joint positions in model-local space (origin = model root = group origin).
// Uses normalised anatomical ratios for a 2.2-unit-tall character; tries to
// improve each joint from actual skeleton bones when names match.
export function extractJoints(root) {
  const joints = {
    head:  new THREE.Vector3(0,    2.0, 0),
    hand:  new THREE.Vector3(0.55, 1.3, 0),
    hip:   new THREE.Vector3(0,    1.0, 0),
    knee:  new THREE.Vector3(0.20, 0.6, 0),
    foot:  new THREE.Vector3(0.20, 0.1, 0),
  }

  const boneMap = {
    head:  ['head', 'Head', 'HEAD', 'mixamorig:Head'],
    hand:  ['hand_r', 'Hand_R', 'RightHand', 'hand.R', 'wrist_r', 'mixamorig:RightHand'],
    hip:   ['hips', 'Hips', 'pelvis', 'Pelvis', 'mixamorig:Hips'],
    knee:  ['shin_r', 'Shin_R', 'RightLeg', 'knee_r', 'mixamorig:RightLeg'],
    foot:  ['foot_r', 'Foot_R', 'RightFoot', 'mixamorig:RightFoot'],
  }

  // Ensure world matrices are current before sampling
  root.updateWorldMatrix(true, true)

  root.traverse(obj => {
    if (!obj.isBone && obj.type !== 'Bone') return
    const n = obj.name
    for (const [key, names] of Object.entries(boneMap)) {
      if (names.some(bn => n.includes(bn))) {
        const worldPos = new THREE.Vector3()
        obj.getWorldPosition(worldPos)
        // Convert world → model-root local so labels work as group children
        root.worldToLocal(worldPos)
        joints[key].copy(worldPos)
        break
      }
    }
  })

  return joints
}
