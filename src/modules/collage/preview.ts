import { createEmptyBinding, type SlotPhotoState, type TemplateDefinition } from './types'
import type { PhotoAsset } from '../print-core/types'

export interface TemplatePreviewPage {
  index: number
  bindings: Record<string, SlotPhotoState>
  photoCount: number
  editable: boolean
}

function createPageBindings(
  template: TemplateDefinition,
  photoIds: Array<string | null>,
) {
  return template.slots.reduce<Record<string, SlotPhotoState>>((bindings, slot, slotIndex) => {
    bindings[slot.id] = {
      ...createEmptyBinding(slot.id),
      imageId: photoIds[slotIndex] ?? null,
    }
    return bindings
  }, {})
}

export function buildTemplatePreviewPages(
  template: TemplateDefinition,
  orderedPhotos: PhotoAsset[],
  slotBindings: Record<string, SlotPhotoState>,
): TemplatePreviewPage[] {
  const firstPageBindings = template.slots.reduce<Record<string, SlotPhotoState>>((bindings, slot) => {
    bindings[slot.id] = slotBindings[slot.id] ?? createEmptyBinding(slot.id)
    return bindings
  }, {})

  const assignedPhotoIds = template.slots
    .map((slot) => firstPageBindings[slot.id]?.imageId ?? null)
    .filter((photoId): photoId is string => Boolean(photoId))
  const assignedPhotoIdSet = new Set(assignedPhotoIds)
  const remainingPhotoIds = orderedPhotos
    .map((photo) => photo.id)
    .filter((photoId) => !assignedPhotoIdSet.has(photoId))

  const pages: TemplatePreviewPage[] = [
    {
      index: 0,
      bindings: firstPageBindings,
      photoCount: assignedPhotoIds.length,
      editable: true,
    },
  ]

  for (let start = 0; start < remainingPhotoIds.length; start += template.slots.length) {
    const pagePhotoIds = remainingPhotoIds.slice(start, start + template.slots.length)
    pages.push({
      index: pages.length,
      bindings: createPageBindings(template, pagePhotoIds),
      photoCount: pagePhotoIds.length,
      editable: false,
    })
  }

  return pages
}
