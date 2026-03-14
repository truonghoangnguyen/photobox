import { PDFDocument } from 'pdf-lib'
import { buildAutoGridLayout } from '../../modules/grid/layout'
import type { PrintSizeOption } from '../../modules/grid/printSizes'
import { A4_PAGE } from '../../modules/print-core/constants'
import type { PhotoTransform } from '../../modules/print-core/transform'
import { loadHtmlImage } from '../../modules/print-core/image'
import type { PhotoAsset } from '../../modules/print-core/types'
import { canvasToBlob, createCanvas, drawEditableImage, embedA4ImagePage } from './shared'

interface GridExportOptions {
  photos: PhotoAsset[]
  printSize: PrintSizeOption
  transforms?: Record<string, PhotoTransform>
  background?: string
}

export async function renderGridPdfBlob(options: GridExportOptions) {
  if (options.photos.length === 0) {
    throw new Error('Add at least one photo before generating the print sheet.')
  }

  const layout = buildAutoGridLayout(options.photos, options.printSize)
  const pdf = await PDFDocument.create()

  for (const pageLayout of layout.pages) {
    const canvas = createCanvas(A4_PAGE.width, A4_PAGE.height)

    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Unable to initialise the auto-grid export canvas.')
    }

    context.fillStyle = options.background ?? '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)

    for (const cell of pageLayout.cells) {
      const image = await loadHtmlImage(cell.photo.src)
      drawEditableImage(
        context,
        image,
        {
          x: cell.x,
          y: cell.y,
          width: cell.width,
          height: cell.height,
        },
        {
          width: cell.photo.naturalWidth,
          height: cell.photo.naturalHeight,
        },
        options.transforms?.[cell.photo.id],
      )
    }

    const pageBlob = await canvasToBlob(canvas)
    await embedA4ImagePage(pdf, pageBlob)
  }

  const pdfBytes = await pdf.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}
