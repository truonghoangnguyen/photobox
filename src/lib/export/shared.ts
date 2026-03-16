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

export function removeVietnameseTones(str: string): string {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a')
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e')
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, 'i')
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o')
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u')
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y')
  str = str.replace(/đ/g, 'd')
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A')
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E')
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I')
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O')
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U')
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y')
  str = str.replace(/Đ/g, 'D')
  // Some system encode characters combining accent as individual characters
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, '') // huyen, sac, nga, hoi, nang
  str = str.replace(/\u02C6|\u0306|\u031B/g, '') // ^ , v , +
  return str
}

export async function addRecipientTextToPdf(pdfBlob: Blob, text: string): Promise<Blob> {
  const bytes = await pdfBlob.arrayBuffer()
  const pdfDoc = await PDFDocument.load(bytes)
  const pages = pdfDoc.getPages()
  
  // Normalize text to remove Vietnamese tones (WinAnsi encoding limitation)
  const normalizedText = removeVietnameseTones(text)
  
  for (const page of pages) {
    // Draw text at bottom left
    page.drawText(normalizedText, {
      x: 20,
      y: 20,
      size: 10,
    })
  }

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes as any], { type: 'application/pdf' })
}
