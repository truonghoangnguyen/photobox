import type { TemplateDefinition } from './types'

export const A4_PAGE = {
  width: 1240,
  height: 1754,
}

const top = 72
const side = 72
const gap = 28
const halfWidth = (A4_PAGE.width - side * 2 - gap) / 2
const largeWidth = A4_PAGE.width - side * 2

export const COLLAGE_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'hero',
    name: 'Hero Portrait',
    description: 'Single large image for a bold cover sheet.',
    accent: '#d38b5d',
    background: '#f7f3ec',
    pageSize: A4_PAGE,
    slots: [
      { id: 'slot-1', x: 72, y: 72, width: 1096, height: 1610, placeholder: 'Drop the hero photo' },
    ],
  },
  {
    id: 'duo-split',
    name: 'Split Duo',
    description: 'Two balanced frames stacked for portrait + detail.',
    accent: '#7293bf',
    background: '#eff3f6',
    pageSize: A4_PAGE,
    slots: [
      { id: 'slot-1', x: 72, y: 72, width: 1096, height: 930, placeholder: 'Top story photo' },
      { id: 'slot-2', x: 72, y: 1030, width: 1096, height: 652, placeholder: 'Bottom detail photo' },
    ],
  },
  {
    id: 'story-triptych',
    name: 'Story Triptych',
    description: 'A large lead image with two supporting frames.',
    accent: '#4eaeb2',
    background: '#f3f6f4',
    pageSize: A4_PAGE,
    slots: [
      { id: 'slot-1', x: 72, y: 72, width: 1096, height: 940, placeholder: 'Main hero photo' },
      { id: 'slot-2', x: 72, y: 1040, width: 534, height: 642, placeholder: 'Secondary left photo' },
      { id: 'slot-3', x: 634, y: 1040, width: 534, height: 642, placeholder: 'Secondary right photo' },
    ],
  },
  {
    id: 'gallery-column',
    name: 'Gallery Column',
    description: 'Vertical emphasis with a pair of landscape accents.',
    accent: '#b86d7f',
    background: '#f8f1f4',
    pageSize: A4_PAGE,
    slots: [
      { id: 'slot-1', x: 72, y: 72, width: 706, height: 1610, placeholder: 'Tall left photo' },
      { id: 'slot-2', x: 806, y: 72, width: 362, height: 790, placeholder: 'Top right photo' },
      { id: 'slot-3', x: 806, y: 892, width: 362, height: 790, placeholder: 'Bottom right photo' },
    ],
  },
  {
    id: 'mosaic-four',
    name: 'Mosaic Four',
    description: 'A four-frame collage with asymmetrical energy.',
    accent: '#63895d',
    background: '#f1f5ee',
    pageSize: A4_PAGE,
    slots: [
      { id: 'slot-1', x: 72, y: 72, width: 720, height: 790, placeholder: 'Upper left photo' },
      { id: 'slot-2', x: 820, y: 72, width: 348, height: 790, placeholder: 'Upper right photo' },
      { id: 'slot-3', x: 72, y: 892, width: 520, height: 790, placeholder: 'Lower left photo' },
      { id: 'slot-4', x: 620, y: 892, width: 548, height: 790, placeholder: 'Lower right photo' },
    ],
  },
  {
    id: 'film-strip',
    name: 'Film Strip',
    description: 'Three evenly spaced frames for event recaps.',
    accent: '#705fce',
    background: '#f3f2fb',
    pageSize: A4_PAGE,
    slots: [
      { id: 'slot-1', x: 72, y: 72, width: 1096, height: 500, placeholder: 'Opening scene' },
      { id: 'slot-2', x: 72, y: 600, width: 1096, height: 500, placeholder: 'Middle scene' },
      { id: 'slot-3', x: 72, y: 1128, width: 1096, height: 554, placeholder: 'Closing scene' },
    ],
  },
  {
    id: 'grid-four',
    name: 'Grid Four',
    description: 'Clean equal grid for product or portrait sets.',
    accent: '#3c8c7b',
    background: '#eef6f5',
    pageSize: A4_PAGE,
    slots: [
      { id: 'slot-1', x: side, y: top, width: halfWidth, height: 790, placeholder: 'Top left photo' },
      { id: 'slot-2', x: side + halfWidth + gap, y: top, width: halfWidth, height: 790, placeholder: 'Top right photo' },
      { id: 'slot-3', x: side, y: top + 790 + gap, width: halfWidth, height: 790, placeholder: 'Bottom left photo' },
      { id: 'slot-4', x: side + halfWidth + gap, y: top + 790 + gap, width: halfWidth, height: 790, placeholder: 'Bottom right photo' },
    ],
  },
  {
    id: 'editorial-mix',
    name: 'Editorial Mix',
    description: 'A large horizontal opener with three compact details.',
    accent: '#c37448',
    background: '#f8f4ef',
    pageSize: A4_PAGE,
    slots: [
      { id: 'slot-1', x: 72, y: 72, width: largeWidth, height: 720, placeholder: 'Lead photo' },
      { id: 'slot-2', x: 72, y: 820, width: 348, height: 862, placeholder: 'Left detail photo' },
      { id: 'slot-3', x: 448, y: 820, width: 348, height: 862, placeholder: 'Middle detail photo' },
      { id: 'slot-4', x: 824, y: 820, width: 344, height: 862, placeholder: 'Right detail photo' },
    ],
  },
]

export function getTemplateById(id: string) {
  return COLLAGE_TEMPLATES.find((template) => template.id === id)
}
