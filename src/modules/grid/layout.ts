import { A4_PAGE } from '../print-core/constants'
import type { PhotoAsset } from '../print-core/types'
import type { PrintSizeOption } from './printSizes'

const A4_CM = {
  width: 21,
  height: 29.7,
}

const DEFAULT_MARGIN_CM = 0.5
const DEFAULT_GAP_CM = 0.35

export interface GridLayoutCell {
  x: number
  y: number
  width: number
  height: number
  photo: PhotoAsset
}

export interface GridLayoutPage {
  index: number
  cells: GridLayoutCell[]
}

export interface GridLayoutResult {
  rotated: boolean
  columns: number
  rows: number
  capacityPerPage: number
  pageCount: number
  cellWidth: number
  cellHeight: number
  gap: number
  marginX: number
  marginY: number
  pages: GridLayoutPage[]
}

function cmToPagePixels(valueCm: number, axis: 'x' | 'y') {
  if (axis === 'x') {
    return (valueCm / A4_CM.width) * A4_PAGE.width
  }

  return (valueCm / A4_CM.height) * A4_PAGE.height
}

function calculateCandidate(
  photos: PhotoAsset[],
  option: PrintSizeOption,
  rotated: boolean,
): GridLayoutResult | null {
  const photoWidthCm = rotated ? option.heightCm : option.widthCm
  const photoHeightCm = rotated ? option.widthCm : option.heightCm
  const marginX = cmToPagePixels(DEFAULT_MARGIN_CM, 'x')
  const marginY = cmToPagePixels(DEFAULT_MARGIN_CM, 'y')
  const gap = Math.round(
    Math.min(cmToPagePixels(DEFAULT_GAP_CM, 'x'), cmToPagePixels(DEFAULT_GAP_CM, 'y')),
  )
  const cellWidth = cmToPagePixels(photoWidthCm, 'x')
  const cellHeight = cmToPagePixels(photoHeightCm, 'y')
  const columns = Math.floor((A4_PAGE.width - marginX * 2 + gap) / (cellWidth + gap))
  const rows = Math.floor((A4_PAGE.height - marginY * 2 + gap) / (cellHeight + gap))

  if (columns < 1 || rows < 1) {
    return null
  }

  const capacityPerPage = columns * rows
  const usedWidth = columns * cellWidth + (columns - 1) * gap
  const usedHeight = rows * cellHeight + (rows - 1) * gap
  const offsetX = (A4_PAGE.width - usedWidth) / 2
  const offsetY = (A4_PAGE.height - usedHeight) / 2
  const pages: GridLayoutPage[] = []

  photos.forEach((photo, index) => {
    const pageIndex = Math.floor(index / capacityPerPage)
    const indexInPage = index % capacityPerPage
    const row = Math.floor(indexInPage / columns)
    const column = indexInPage % columns

    if (!pages[pageIndex]) {
      pages[pageIndex] = {
        index: pageIndex,
        cells: [],
      }
    }

    pages[pageIndex].cells.push({
      x: offsetX + column * (cellWidth + gap),
      y: offsetY + row * (cellHeight + gap),
      width: cellWidth,
      height: cellHeight,
      photo,
    })
  })

  return {
    rotated,
    columns,
    rows,
    capacityPerPage,
    pageCount: Math.max(pages.length, photos.length > 0 ? 1 : 0),
    cellWidth,
    cellHeight,
    gap,
    marginX: offsetX,
    marginY: offsetY,
    pages,
  }
}

export function buildAutoGridLayout(photos: PhotoAsset[], option: PrintSizeOption): GridLayoutResult {
  const portrait = calculateCandidate(photos, option, false)
  const rotated = calculateCandidate(photos, option, true)
  const result =
    [portrait, rotated]
      .filter((candidate): candidate is GridLayoutResult => candidate !== null)
      .sort((left, right) => {
        if (right.capacityPerPage !== left.capacityPerPage) {
          return right.capacityPerPage - left.capacityPerPage
        }

        const leftArea = left.columns * left.rows * left.cellWidth * left.cellHeight
        const rightArea = right.columns * right.rows * right.cellWidth * right.cellHeight
        return rightArea - leftArea
      })[0] ?? portrait

  if (!result) {
    throw new Error(`Selected print size ${option.label} does not fit on A4.`)
  }

  return result
}
