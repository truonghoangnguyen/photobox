<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { GridLayoutCell, GridLayoutResult } from '../modules/grid/layout'
import type { PrintSizeOption } from '../modules/grid/printSizes'
import { A4_PAGE } from '../modules/print-core/constants'
import {
  clampTransform,
  createDefaultTransform,
  getFrameImageLayout,
  type PhotoTransform,
} from '../modules/print-core/transform'
import type { PhotoAsset } from '../modules/print-core/types'

const props = defineProps<{
  photos: PhotoAsset[]
  layout: GridLayoutResult
  printSize: PrintSizeOption
  transforms: Record<string, PhotoTransform>
  selectedPhotoId: string | null
  unlockedPhotoId: string | null
}>()

const emit = defineEmits<{
  selectPhoto: [photoId: string]
  updateTransform: [photoId: string, patch: PhotoTransform]
  replacePhoto: [photoId: string]
  toggleLock: [photoId: string]
  rotateRight: [photoId: string]
}>()

const hasPhotos = computed(() => props.photos.length > 0)
const activeInteraction = ref<{
  photoId: string
  origin: PhotoTransform
  frameWidth: number
  frameHeight: number
  scaleX: number
  scaleY: number
  imageWidth: number
  imageHeight: number
  pointers: Map<number, { x: number; y: number }>
  dragPointerId: number | null
  dragStartX: number
  dragStartY: number
  pinchStartDistance: number | null
} | null>(null)

function getTransform(photoId: string) {
  return props.transforms[photoId] ?? createDefaultTransform()
}

function getCellImageStyle(cell: GridLayoutCell) {
  const layout = getFrameImageLayout(
    { x: 0, y: 0, width: cell.width, height: cell.height },
    { width: cell.photo.naturalWidth, height: cell.photo.naturalHeight },
    getTransform(cell.photo.id),
  )

  return {
    width: `${(layout.drawWidth / cell.width) * 100}%`,
    height: `${(layout.drawHeight / cell.height) * 100}%`,
    left: `${50 + (layout.offsetX / cell.width) * 100}%`,
    top: `${50 + (layout.offsetY / cell.height) * 100}%`,
    transform: `translate(-50%, -50%) rotate(${layout.rotation}deg)`,
  }
}

function handleWheel(event: WheelEvent, cell: GridLayoutCell) {
  if (props.unlockedPhotoId !== cell.photo.id) {
    return
  }

  event.preventDefault()
  emit('selectPhoto', cell.photo.id)

  const nextTransform = clampTransform(
    { x: 0, y: 0, width: cell.width, height: cell.height },
    { width: cell.photo.naturalWidth, height: cell.photo.naturalHeight },
    {
      ...getTransform(cell.photo.id),
      scale: getTransform(cell.photo.id).scale + (event.deltaY > 0 ? -0.08 : 0.08),
    },
  )

  emit('updateTransform', cell.photo.id, nextTransform)
}

function handlePointerDown(event: PointerEvent, cell: GridLayoutCell) {
  const target = event.currentTarget as HTMLElement | null

  if (!target) {
    return
  }

  emit('selectPhoto', cell.photo.id)

  if (props.unlockedPhotoId !== cell.photo.id) {
    return
  }

  target.setPointerCapture(event.pointerId)

  const rect = target.getBoundingClientRect()
  const current = activeInteraction.value

  if (!current || current.photoId !== cell.photo.id) {
    activeInteraction.value = {
      photoId: cell.photo.id,
      origin: getTransform(cell.photo.id),
      frameWidth: cell.width,
      frameHeight: cell.height,
      scaleX: cell.width / rect.width,
      scaleY: cell.height / rect.height,
      imageWidth: cell.photo.naturalWidth,
      imageHeight: cell.photo.naturalHeight,
      pointers: new Map([[event.pointerId, { x: event.clientX, y: event.clientY }]]),
      dragPointerId: event.pointerId,
      dragStartX: event.clientX,
      dragStartY: event.clientY,
      pinchStartDistance: null,
    }
    return
  }

  current.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  current.origin = getTransform(cell.photo.id)

  if (current.pointers.size >= 2) {
    const [first, second] = Array.from(current.pointers.values())
    current.pinchStartDistance = Math.hypot(second.x - first.x, second.y - first.y)
    current.dragPointerId = null
  }
}

function handlePointerMove(event: PointerEvent) {
  if (!activeInteraction.value) {
    return
  }

  const interaction = activeInteraction.value

  if (!interaction.pointers.has(event.pointerId)) {
    return
  }

  interaction.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

  const frame = {
    x: 0,
    y: 0,
    width: interaction.frameWidth,
    height: interaction.frameHeight,
  }
  const imageSize = {
    width: interaction.imageWidth,
    height: interaction.imageHeight,
  }

  if (interaction.pointers.size >= 2 && interaction.pinchStartDistance) {
    const [first, second] = Array.from(interaction.pointers.values())
    const nextDistance = Math.hypot(second.x - first.x, second.y - first.y)
    const nextTransform = clampTransform(frame, imageSize, {
      ...interaction.origin,
      scale: interaction.origin.scale * (nextDistance / interaction.pinchStartDistance),
    })

    emit('updateTransform', interaction.photoId, nextTransform)
    return
  }

  if (interaction.dragPointerId !== event.pointerId) {
    return
  }

  const nextTransform = clampTransform(frame, imageSize, {
    ...interaction.origin,
    offsetX: interaction.origin.offsetX + (event.clientX - interaction.dragStartX) * interaction.scaleX,
    offsetY: interaction.origin.offsetY + (event.clientY - interaction.dragStartY) * interaction.scaleY,
  })

  emit('updateTransform', interaction.photoId, nextTransform)
}

function refreshSinglePointerDrag(interaction: NonNullable<typeof activeInteraction.value>) {
  const remainingPointer = Array.from(interaction.pointers.entries())[0]

  if (!remainingPointer) {
    activeInteraction.value = null
    return
  }

  interaction.origin = getTransform(interaction.photoId)
  interaction.dragPointerId = remainingPointer[0]
  interaction.dragStartX = remainingPointer[1].x
  interaction.dragStartY = remainingPointer[1].y
  interaction.pinchStartDistance = null
}

function stopPointer(event: PointerEvent) {
  if (!activeInteraction.value) {
    return
  }

  const interaction = activeInteraction.value
  interaction.pointers.delete(event.pointerId)

  if (interaction.pointers.size === 0) {
    activeInteraction.value = null
    return
  }

  if (interaction.pointers.size === 1) {
    refreshSinglePointerDrag(interaction)
    return
  }

  interaction.origin = getTransform(interaction.photoId)
  const [first, second] = Array.from(interaction.pointers.values())
  interaction.pinchStartDistance = Math.hypot(second.x - first.x, second.y - first.y)
}

onMounted(() => {
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', stopPointer)
  window.addEventListener('pointercancel', stopPointer)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', stopPointer)
  window.removeEventListener('pointercancel', stopPointer)
})
</script>

<template>
  <div class="grid-preview">
    <div class="grid-preview__header">
      <div>
        <p class="section-kicker">Auto grid</p>
        <h3>{{ printSize.label }} on A4</h3>
      </div>
      <p v-if="hasPhotos" class="grid-preview__meta">
        {{ layout.columns }} x {{ layout.rows }} per page · {{ layout.pageCount }} page{{ layout.pageCount > 1 ? 's' : '' }}
      </p>
    </div>

    <div v-if="!hasPhotos" class="grid-preview__empty">
      <strong>No photos queued yet</strong>
      <span>Upload 5, 10, 20, or more images and the sheet will auto-fill into an A4 print grid.</span>
    </div>

    <div v-else class="grid-preview__pages">
      <article v-for="page in layout.pages" :key="page.index" class="grid-preview__page-card">
        <div class="grid-preview__page-label">Page {{ page.index + 1 }}</div>

        <div
          class="grid-preview__page"
          :style="{ aspectRatio: `${A4_PAGE.width} / ${A4_PAGE.height}` }"
        >
          <div
            v-for="(cell, cellIndex) in page.cells"
            :key="`${page.index}-${cellIndex}-${cell.photo.id}`"
            class="grid-preview__cell"
            :class="{
              'grid-preview__cell--selected': selectedPhotoId === cell.photo.id,
              'grid-preview__cell--unlocked': unlockedPhotoId === cell.photo.id,
            }"
            :style="{
              left: `${(cell.x / A4_PAGE.width) * 100}%`,
              top: `${(cell.y / A4_PAGE.height) * 100}%`,
              width: `${(cell.width / A4_PAGE.width) * 100}%`,
              height: `${(cell.height / A4_PAGE.height) * 100}%`,
            }"
            @click="emit('selectPhoto', cell.photo.id)"
          >
            <div
              class="grid-preview__viewport"
              :class="{ 'grid-preview__viewport--locked': unlockedPhotoId !== cell.photo.id }"
              @pointerdown="handlePointerDown($event, cell)"
              @wheel="handleWheel($event, cell)"
            >
              <img
                :src="cell.photo.src"
                :alt="cell.photo.name"
                class="grid-preview__image"
                :style="getCellImageStyle(cell)"
                draggable="false"
              />
            </div>

            <button
              type="button"
              class="grid-preview__lock-toggle"
              :class="{
                'grid-preview__lock-toggle--active': unlockedPhotoId === cell.photo.id,
                'grid-preview__lock-toggle--locked': unlockedPhotoId !== cell.photo.id,
              }"
              @click.stop="emit('selectPhoto', cell.photo.id); emit('toggleLock', cell.photo.id)"
            >
              <span class="grid-preview__lock-icon" aria-hidden="true">
                <span class="grid-preview__lock-shackle" />
                <span class="grid-preview__lock-body" />
              </span>
              <span>{{ unlockedPhotoId === cell.photo.id ? 'Edit' : 'Lock' }}</span>
            </button>

            <div
              v-if="selectedPhotoId === cell.photo.id && unlockedPhotoId === cell.photo.id"
              class="grid-preview__actions"
            >
              <button
                type="button"
                class="grid-preview__action-button"
                @click.stop="emit('rotateRight', cell.photo.id)"
              >
                Xoay phai
              </button>
              <button
                type="button"
                class="grid-preview__action-button"
                @click.stop="emit('replacePhoto', cell.photo.id)"
              >
                Replace
              </button>
            </div>

            <div
              v-if="selectedPhotoId === cell.photo.id && unlockedPhotoId === cell.photo.id"
              class="grid-preview__gesture-hint"
            >
              1 ngon de di chuyen · 2 ngon de zoom
            </div>

            <div
              v-else-if="selectedPhotoId === cell.photo.id"
              class="grid-preview__lock-hint"
            >
              Nhan vao o khoa de vao edit mode
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.grid-preview {
  --preview-page-width: clamp(320px, 38vw, 420px);
  display: grid;
  gap: 16px;
}

.grid-preview__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-kicker {
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: var(--accent-strong);
}

.grid-preview__header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.grid-preview__meta {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.92rem;
}

.grid-preview__empty {
  display: grid;
  gap: 8px;
  padding: 20px;
  border: 1px dashed var(--line-strong);
  color: var(--ink-soft);
  background: rgba(255, 255, 255, 0.48);
}

.grid-preview__pages {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: var(--preview-page-width);
  gap: 14px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
  scroll-snap-type: x proximity;
  align-items: start;
}

.grid-preview__page-card {
  display: grid;
  gap: 10px;
  width: var(--preview-page-width);
  scroll-snap-align: start;
}

.grid-preview__page-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--ink-soft);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.grid-preview__page {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  background: white;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
}

.grid-preview__cell {
  position: absolute;
  overflow: hidden;
  background: #edf1f4;
  box-shadow: 0 0 0 1px rgba(89, 101, 121, 0.12);
  isolation: isolate;
}

.grid-preview__cell--selected {
  box-shadow:
    0 0 0 2px var(--accent-strong),
    0 0 0 1px rgba(89, 101, 121, 0.12);
}

.grid-preview__cell--unlocked {
  box-shadow:
    0 0 0 3px rgba(204, 143, 88, 0.95),
    0 0 0 1px rgba(89, 101, 121, 0.12);
}

.grid-preview__viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}

.grid-preview__viewport--locked {
  cursor: default;
}

.grid-preview__viewport:active {
  cursor: grabbing;
}

.grid-preview__viewport--locked:active {
  cursor: default;
}

.grid-preview__image {
  position: absolute;
  top: 50%;
  left: 50%;
  display: block;
  max-width: none;
  user-select: none;
  pointer-events: none;
}

.grid-preview__actions {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  display: flex;
  gap: 6px;
}

.grid-preview__action-button {
  border-radius: 999px;
  padding: 0.35rem 0.6rem;
  background: rgba(17, 24, 39, 0.82);
  color: white;
  font-size: 0.72rem;
}

.grid-preview__lock-toggle {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 0.35rem 0.7rem;
  color: white;
  font-size: 0.72rem;
  font-weight: 700;
}

.grid-preview__lock-toggle--locked {
  background: rgba(220, 38, 38, 0.9);
}

.grid-preview__lock-toggle--active {
  background: rgba(22, 163, 74, 0.9);
}

.grid-preview__lock-icon {
  position: relative;
  display: inline-flex;
  width: 12px;
  height: 12px;
}

.grid-preview__lock-shackle {
  position: absolute;
  top: -3px;
  left: 2px;
  width: 8px;
  height: 6px;
  border: 2px solid currentColor;
  border-bottom: 0;
  border-radius: 999px 999px 0 0;
}

.grid-preview__lock-body {
  position: absolute;
  left: 1px;
  bottom: 0;
  width: 10px;
  height: 8px;
  border-radius: 3px;
  background: currentColor;
}

.grid-preview__gesture-hint,
.grid-preview__lock-hint {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 1;
  border-radius: 12px;
  padding: 0.3rem 0.5rem;
  background: rgba(255, 255, 255, 0.88);
  color: #111827;
  font-size: 0.68rem;
  font-weight: 700;
}

@media (min-width: 900px) {
  .grid-preview__pages {
    grid-auto-columns: var(--preview-page-width);
  }

  .grid-preview__header {
    flex-direction: row;
    justify-content: space-between;
    align-items: end;
  }
}
</style>
