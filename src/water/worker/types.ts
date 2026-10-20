export interface WaterAreaTileCoordinate {
  x: number
  y: number
  z: number
}

export interface WaterAreaTileImageResult {
  image?: ImageBitmap
  solid?: 'land' | 'water'
}

export type WaterAreaTileTask = Promise<WaterAreaTileImageResult> & { cancel(): void }

export interface WaterAreaWorkerResponse {
  id: number
  result?: WaterAreaTileImageResult
  error?: { name: string; message: string }
}
