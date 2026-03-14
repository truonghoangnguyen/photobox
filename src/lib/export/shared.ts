import { PDFDocument } from 'pdf-lib'
import {
  clampTransform,
  createDefaultTransform,
  getFrameImageLayout,
  type ImageFrame,
  type ImageSize,
  type PhotoTransform,
} from '../../modules/print-core/transform'

export const A4_POINTS = {
  width: 595.28,
  height: 841.89,
}

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/jpeg',
  quality = 0.88,
) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to render the export canvas.'))
          return
        }

        resolve(blob)
      },
      type,
      quality,
    )
  })
}

export async function embedA4ImagePage(pdf: PDFDocument, blob: Blob) {
  const bytes = await blob.arrayBuffer()
  const page = pdf.addPage([A4_POINTS.width, A4_POINTS.height])
  const embeddedImage = await pdf.embedJpg(bytes)

  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: A4_POINTS.width,
    height: A4_POINTS.height,
  })
}

export function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  const drawX = x + (width - drawWidth) / 2
  const drawY = y + (height - drawHeight) / 2

  context.save()
  context.beginPath()
  context.rect(x, y, width, height)
  context.clip()
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight)
  context.restore()
}

export function drawEditableImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frame: ImageFrame,
  imageSize: ImageSize,
  transform: PhotoTransform = createDefaultTransform(),
) {
  const nextTransform = clampTransform(frame, imageSize, transform)
  const layout = getFrameImageLayout(frame, imageSize, nextTransform)

  context.save()
  context.beginPath()
  context.rect(frame.x, frame.y, frame.width, frame.height)
  context.clip()
  context.translate(layout.centerX, layout.centerY)
  context.rotate((layout.rotation * Math.PI) / 180)
  context.drawImage(
    image,
    -layout.drawWidth / 2,
    -layout.drawHeight / 2,
    layout.drawWidth,
    layout.drawHeight,
  )
  context.restore()
}
