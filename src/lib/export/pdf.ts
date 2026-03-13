import { PDFDocument } from 'pdf-lib'
import { clampBinding, getSlotImageLayout } from '../../modules/collage/layout'
import type { PhotoAsset, SlotPhotoState, TemplateDefinition } from '../../modules/collage/types'

interface ExportOptions {
  template: TemplateDefinition
  bindings: Record<string, SlotPhotoState>
  photos: Record<string, PhotoAsset>
  filename: string
  exportScale: number
}

const A4_POINTS = {
  width: 595.28,
  height: 841.89,
}

async function loadHtmlImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Unable to decode one of the selected images.'))
    image.src = src
  })
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to render the final collage canvas.'))
        return
      }

      resolve(blob)
    }, 'image/jpeg', 0.88)
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function exportCollageToPdf(options: ExportOptions) {
  const missingSlots = options.template.slots.filter(
    (slot) => !options.bindings[slot.id]?.imageId,
  )

  if (missingSlots.length > 0) {
    throw new Error('Fill every slot before exporting the PDF.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(options.template.pageSize.width * options.exportScale)
  canvas.height = Math.round(options.template.pageSize.height * options.exportScale)
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Unable to initialise the export canvas.')
  }

  context.fillStyle = options.template.background
  context.fillRect(0, 0, canvas.width, canvas.height)

  for (const slot of options.template.slots) {
    const binding = options.bindings[slot.id]
    const imageId = binding?.imageId

    if (!imageId) {
      continue
    }

    const photo = options.photos[imageId]

    if (!photo) {
      continue
    }

    const image = await loadHtmlImage(photo.src)
    const nextBinding = clampBinding(
      slot,
      { width: photo.naturalWidth, height: photo.naturalHeight },
      binding,
    )
    const layout = getSlotImageLayout(
      slot,
      { width: photo.naturalWidth, height: photo.naturalHeight },
      nextBinding,
    )

    context.save()
    context.beginPath()
    context.rect(
      slot.x * options.exportScale,
      slot.y * options.exportScale,
      slot.width * options.exportScale,
      slot.height * options.exportScale,
    )
    context.clip()
    context.drawImage(
      image,
      layout.x * options.exportScale,
      layout.y * options.exportScale,
      layout.width * options.exportScale,
      layout.height * options.exportScale,
    )
    context.restore()
  }

  const blob = await canvasToBlob(canvas)
  const bytes = await blob.arrayBuffer()
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([A4_POINTS.width, A4_POINTS.height])
  const embeddedImage = await pdf.embedJpg(bytes)

  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: A4_POINTS.width,
    height: A4_POINTS.height,
  })

  const pdfBytes = await pdf.save()
  downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), options.filename)
}
