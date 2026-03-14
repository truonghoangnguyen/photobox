export interface ImageFrame {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageSize {
  width: number
  height: number
}

export interface PhotoTransform {
  scale: number
  offsetX: number
  offsetY: number
  rotation: number
}

export interface FrameImageLayout {
  x: number
  y: number
  width: number
  height: number
  centerX: number
  centerY: number
  drawWidth: number
  drawHeight: number
  scale: number
  offsetX: number
  offsetY: number
  rotation: number
  maxOffsetX: number
  maxOffsetY: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function normalizeRotation(rotation: number) {
  const normalized = rotation % 360
  return normalized < 0 ? normalized + 360 : normalized
}

function isQuarterTurn(rotation: number) {
  const normalized = normalizeRotation(rotation)
  return normalized === 90 || normalized === 270
}

export function createDefaultTransform(): PhotoTransform {
  return {
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
  }
}

export function getFrameImageLayout(
  frame: ImageFrame,
  imageSize: ImageSize,
  transform: PhotoTransform,
): FrameImageLayout {
  const rotation = normalizeRotation(transform.rotation)
  const scale = clamp(transform.scale, 1, 3)
  const rotated = isQuarterTurn(rotation)
  const rotatedWidth = rotated ? imageSize.height : imageSize.width
  const rotatedHeight = rotated ? imageSize.width : imageSize.height
  const coverScale = Math.max(frame.width / rotatedWidth, frame.height / rotatedHeight)
  const drawWidth = imageSize.width * coverScale * scale
  const drawHeight = imageSize.height * coverScale * scale
  const width = rotated ? drawHeight : drawWidth
  const height = rotated ? drawWidth : drawHeight
  const maxOffsetX = Math.max(0, (width - frame.width) / 2)
  const maxOffsetY = Math.max(0, (height - frame.height) / 2)
  const offsetX = clamp(transform.offsetX, -maxOffsetX, maxOffsetX)
  const offsetY = clamp(transform.offsetY, -maxOffsetY, maxOffsetY)
  const centerX = frame.x + frame.width / 2 + offsetX
  const centerY = frame.y + frame.height / 2 + offsetY

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
    centerX,
    centerY,
    drawWidth,
    drawHeight,
    scale,
    offsetX,
    offsetY,
    rotation,
    maxOffsetX,
    maxOffsetY,
  }
}

export function clampTransform(
  frame: ImageFrame,
  imageSize: ImageSize,
  transform: PhotoTransform,
): PhotoTransform {
  const layout = getFrameImageLayout(frame, imageSize, transform)

  return {
    ...transform,
    scale: layout.scale,
    offsetX: layout.offsetX,
    offsetY: layout.offsetY,
    rotation: layout.rotation,
  }
}

export function transformFromImageCenter(
  frame: ImageFrame,
  imageSize: ImageSize,
  transform: PhotoTransform,
  centerX: number,
  centerY: number,
): PhotoTransform {
  return clampTransform(frame, imageSize, {
    ...transform,
    offsetX: centerX - (frame.x + frame.width / 2),
    offsetY: centerY - (frame.y + frame.height / 2),
  })
}
