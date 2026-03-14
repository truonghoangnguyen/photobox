export interface PrintSizeOption {
  id: string
  label: string
  widthCm: number
  heightCm: number
}

export const PRINT_SIZE_OPTIONS: PrintSizeOption[] = [
  { id: '6x9', label: '6 x 9 cm', widthCm: 6, heightCm: 9 },
  { id: '9x12', label: '9 x 12 cm', widthCm: 9, heightCm: 12 },
  { id: '9x15', label: '9 x 15 cm', widthCm: 9, heightCm: 15 },
  { id: '10x15', label: '10 x 15 cm', widthCm: 10, heightCm: 15 },
  { id: '13x18', label: '13 x 18 cm', widthCm: 13, heightCm: 18 },
  { id: '14x20', label: '14 x 20 cm', widthCm: 14, heightCm: 20 },
]

export const DEFAULT_PRINT_SIZE = PRINT_SIZE_OPTIONS[0]

export function getPrintSizeById(id: string) {
  return PRINT_SIZE_OPTIONS.find((option) => option.id === id) ?? DEFAULT_PRINT_SIZE
}
