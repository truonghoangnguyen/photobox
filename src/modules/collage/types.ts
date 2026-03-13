export interface PageSize {
  width: number
  height: number
}

export interface PhotoSlot {
  id: string
  x: number
  y: number
  width: number
  height: number
  placeholder: string
  borderRadius?: number
  rotation?: number
}

export interface TemplateDefinition {
  id: string
  name: string
  description: string
  accent: string
  background: string
  pageSize: PageSize
  slots: PhotoSlot[]
}

export interface PhotoAsset {
  id: string
  name: string
  src: string
  naturalWidth: number
  naturalHeight: number
}

export interface SlotPhotoState {
  slotId: string
  imageId: string | null
  scale: number
  offsetX: number
  offsetY: number
}

export interface ExportSettings {
  filename: string
  scale: number
}

export interface ProjectState {
  selectedTemplateId: string
  photos: Record<string, PhotoAsset>
  slotBindings: Record<string, SlotPhotoState>
  exportSettings: ExportSettings
}

export function createEmptyBinding(slotId: string): SlotPhotoState {
  return {
    slotId,
    imageId: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  }
}
