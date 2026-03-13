import type { PhotoSlot, SlotPhotoState } from './types'

export interface ImageSize {
  width: number
  height: number
}

export interface SlotImageLayout {
  x: number
  y: number
  width: number
  height: number
  centeredX: number
  centeredY: number
  offsetX: number
  offsetY: number
  scale: number
  maxOffsetX: number
  maxOffsetY: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function getSlotImageLayout(
  slot: PhotoSlot,
  imageSize: ImageSize,
  binding: Pick<SlotPhotoState, 'scale' | 'offsetX' | 'offsetY'>,
): SlotImageLayout {
  const scale = clamp(binding.scale, 1, 3)
  const coverScale = Math.max(slot.width / imageSize.width, slot.height / imageSize.height)
  const width = imageSize.width * coverScale * scale
  const height = imageSize.height * coverScale * scale
  const centeredX = slot.x + (slot.width - width) / 2
  const centeredY = slot.y + (slot.height - height) / 2
  const maxOffsetX = Math.max(0, (width - slot.width) / 2)
  const maxOffsetY = Math.max(0, (height - slot.height) / 2)
  const offsetX = clamp(binding.offsetX, -maxOffsetX, maxOffsetX)
  const offsetY = clamp(binding.offsetY, -maxOffsetY, maxOffsetY)

  return {
    x: centeredX + offsetX,
    y: centeredY + offsetY,
    width,
    height,
    centeredX,
    centeredY,
    offsetX,
    offsetY,
    scale,
    maxOffsetX,
    maxOffsetY,
  }
}

export function clampBinding(
  slot: PhotoSlot,
  imageSize: ImageSize,
  binding: SlotPhotoState,
): SlotPhotoState {
  const layout = getSlotImageLayout(slot, imageSize, binding)

  return {
    ...binding,
    scale: layout.scale,
    offsetX: layout.offsetX,
    offsetY: layout.offsetY,
  }
}

export function bindingFromImagePosition(
  slot: PhotoSlot,
  imageSize: ImageSize,
  binding: SlotPhotoState,
  x: number,
  y: number,
): SlotPhotoState {
  const centered = getSlotImageLayout(slot, imageSize, {
    scale: binding.scale,
    offsetX: 0,
    offsetY: 0,
  })

  return clampBinding(slot, imageSize, {
    ...binding,
    offsetX: x - centered.centeredX,
    offsetY: y - centered.centeredY,
  })
}
