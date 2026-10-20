import { describe, expect, it } from 'vitest'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture } from 'three'
import { WaterAreaMaterialPlugin } from './WaterAreaMaterialPlugin'
import { createWaterAreaWaveFrame } from './WaterAreaWaveFrame'

function plugin() {
  return new WaterAreaMaterialPlugin({}, createWaterAreaWaveFrame(103, 31), [new Texture(), new Texture()])
}

function retainedMeshCount(material: WaterAreaMaterialPlugin): number {
  return (material.appearance as unknown as { cleanups: Map<Mesh, Set<() => void>> }).cleanups.size
}

describe('water material tile ownership', () => {
  it('releases unloaded tile hooks and references without destroying the water instance', () => {
    const material = plugin()
    for (let index = 0; index < 30; index++) {
      const scene = new Group()
      const source = new MeshBasicMaterial()
      const mesh = new Mesh(new BoxGeometry(), source)
      const previousCompile = source.onBeforeCompile
      const previousCacheKey = source.customProgramCacheKey
      const previousRender = mesh.onBeforeRender
      scene.add(mesh)
      material.processTileModel(scene)
      expect(retainedMeshCount(material)).toBe(1)
      expect(source.onBeforeCompile).not.toBe(previousCompile)
      material.disposeTile({ engineData: { scene } })
      expect(retainedMeshCount(material)).toBe(0)
      expect(source.onBeforeCompile).toBe(previousCompile)
      expect(source.customProgramCacheKey).toBe(previousCacheKey)
      expect(mesh.onBeforeRender).toBe(previousRender)
      mesh.geometry.dispose()
      source.dispose()
    }
    material.dispose()
  })

  it('preserves another loaded tile while releasing a tile that shared its original material', () => {
    const material = plugin()
    const source = new MeshBasicMaterial()
    const first = new Mesh(new BoxGeometry(), source)
    const second = new Mesh(new BoxGeometry(), source)
    const firstScene = new Group().add(first)
    const secondScene = new Group().add(second)
    const previousCompile = source.onBeforeCompile
    const firstRender = first.onBeforeRender
    const secondRender = second.onBeforeRender
    material.processTileModel(firstScene)
    material.processTileModel(secondScene)
    expect(first.material).not.toBe(second.material)
    const secondCompile = second.material.onBeforeCompile
    material.disposeTile({ engineData: { scene: firstScene } })
    expect(retainedMeshCount(material)).toBe(1)
    expect(first.material.onBeforeCompile).toBe(previousCompile)
    expect(first.onBeforeRender).toBe(firstRender)
    expect(second.material.onBeforeCompile).toBe(secondCompile)
    material.disposeTile({ engineData: { scene: secondScene } })
    expect(retainedMeshCount(material)).toBe(0)
    expect(second.material.onBeforeCompile).toBe(previousCompile)
    expect(second.onBeforeRender).toBe(secondRender)
    material.disposeTile({ engineData: { scene: secondScene } })
    material.dispose()
    first.geometry.dispose(); second.geometry.dispose()
    first.material.dispose(); second.material.dispose()
  })

  it('restores every still-loaded mesh exactly once when destroyed', () => {
    const material = plugin()
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial())
    const previousCompile = mesh.material.onBeforeCompile
    const previousRender = mesh.onBeforeRender
    material.processTileModel(new Group().add(mesh))
    material.dispose()
    material.dispose()
    expect(retainedMeshCount(material)).toBe(0)
    expect(mesh.material.onBeforeCompile).toBe(previousCompile)
    expect(mesh.onBeforeRender).toBe(previousRender)
    mesh.geometry.dispose(); mesh.material.dispose()
  })
})
