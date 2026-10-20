import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { EarthSceneGlobeControls } from '../controls/EarthSceneGlobeControls'

type ControlsWithPivotMesh = EarthSceneGlobeControls & {
  pivotMesh: THREE.Mesh & {
    onBeforeRender(renderer: Pick<THREE.WebGLRenderer, 'getSize'>): void
  }
}

describe('WebGPU globe controls compatibility', () => {
  it('does not read ShaderMaterial resolution uniforms after replacing the pivot material', () => {
    const controls = new EarthSceneGlobeControls()
    controls.useWebGPUCompatiblePivotMaterial()
    const pivotMesh = (controls as ControlsWithPivotMesh).pivotMesh

    expect(() => {
      pivotMesh.onBeforeRender({
        getSize: (target: THREE.Vector2) => target.set(800, 600)
      })
    }).not.toThrow()

    controls.dispose()
  })
})
