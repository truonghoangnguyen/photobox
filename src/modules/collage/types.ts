import type { PageSize, PhotoAsset } from '../print-core/types'
import { createDefaultTransform, type PhotoTransform } from '../print-core/transform'

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

export interface SlotPhotoState extends PhotoTransform {
  slotId: string
  imageId: string | null
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
    ...createDefaultTransform(),
  }
}
