import { PDFDocument } from 'pdf-lib'
import type { SlotPhotoState, TemplateDefinition } from '../../modules/collage/types'
import { buildTemplatePreviewPages } from '../../modules/collage/preview'
import type { PhotoAsset } from '../../modules/print-core/types'
import { loadHtmlImage } from '../../modules/print-core/image'
import { canvasToBlob, createCanvas, drawEditableImage, embedA4ImagePage } from './shared'

interface ExportOptions {
  template: TemplateDefinition
  bindings: Record<string, SlotPhotoState>
  photos: Record<string, PhotoAsset>
  orderedPhotos?: PhotoAsset[]
  exportScale: number
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function renderCollagePdfBlob(options: ExportOptions) {
  const orderedPhotos = options.orderedPhotos ?? Object.values(options.photos)
  const pages = buildTemplatePreviewPages(options.template, orderedPhotos, options.bindings)
    .filter((page) => page.photoCount > 0)

  if (pages.length === 0) {
    throw new Error('Add at least one photo before exporting the PDF.')
  }

  const pdf = await PDFDocument.create()

  for (const page of pages) {
    const canvas = createCanvas(
      Math.round(options.template.pageSize.width * options.exportScale),
      Math.round(options.template.pageSize.height * options.exportScale),
    )
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Unable to initialise the export canvas.')
    }

    context.fillStyle = options.template.background
    context.fillRect(0, 0, canvas.width, canvas.height)

    for (const slot of options.template.slots) {
      const binding = page.bindings[slot.id]
      const imageId = binding?.imageId

      if (!imageId) {
        continue
      }

      const photo = options.photos[imageId]

      if (!photo) {
        continue
      }

      const image = await loadHtmlImage(photo.src)
      drawEditableImage(
        context,
        image,
        {
          x: slot.x * options.exportScale,
          y: slot.y * options.exportScale,
          width: slot.width * options.exportScale,
          height: slot.height * options.exportScale,
        },
        {
          width: photo.naturalWidth,
          height: photo.naturalHeight,
        },
        {
          ...binding,
          offsetX: binding.offsetX * options.exportScale,
          offsetY: binding.offsetY * options.exportScale,
        },
      )
    }

    const blob = await canvasToBlob(canvas)
    await embedA4ImagePage(pdf, blob)
  }

  const pdfBytes = await pdf.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

export async function exportCollageToPdf(options: ExportOptions & { filename: string }) {
  const blob = await renderCollagePdfBlob(options)
  downloadBlob(blob, options.filename)
}
