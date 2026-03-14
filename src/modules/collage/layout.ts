import {
  clampTransform,
  getFrameImageLayout,
  transformFromImageCenter,
  type FrameImageLayout as SlotImageLayout,
  type ImageSize,
} from '../print-core/transform'
import type { PhotoSlot, SlotPhotoState } from './types'

export function getSlotImageLayout(
  slot: PhotoSlot,
  imageSize: ImageSize,
  binding: Pick<SlotPhotoState, 'scale' | 'offsetX' | 'offsetY' | 'rotation'>,
): SlotImageLayout {
  return getFrameImageLayout(slot, imageSize, binding)
}

export function clampBinding(
  slot: PhotoSlot,
  imageSize: ImageSize,
  binding: SlotPhotoState,
): SlotPhotoState {
  return clampTransform(slot, imageSize, binding)
}

export function bindingFromImagePosition(
  slot: PhotoSlot,
  imageSize: ImageSize,
  binding: SlotPhotoState,
  x: number,
  y: number,
): SlotPhotoState {
  const layout = getSlotImageLayout(slot, imageSize, binding)
  return transformFromImageCenter(slot, imageSize, binding, x + layout.width / 2, y + layout.height / 2)
}
