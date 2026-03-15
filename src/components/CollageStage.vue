<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { clampBinding, getSlotImageLayout } from '../modules/collage/layout'
import { createEmptyBinding, type PhotoSlot, type SlotPhotoState, type TemplateDefinition } from '../modules/collage/types'
import type { PhotoAsset } from '../modules/print-core/types'
import { transformFromImageCenter } from '../modules/print-core/transform'

const props = defineProps<{
  template: TemplateDefinition
  photos: Record<string, PhotoAsset>
  bindings: Record<string, SlotPhotoState>
  selectedSlotId: string | null
  unlockedSlotId?: string | null
  interactive?: boolean
}>()

const emit = defineEmits<{
  selectSlot: [slotId: string]
  updateTransform: [slotId: string, patch: Partial<SlotPhotoState>]
  addPhoto: [slotId: string]
  replacePhoto: [slotId: string]
  toggleLock: [slotId: string]
  rotateRight: [slotId: string]
}>()

const shellRef = ref<HTMLElement | null>(null)
const shellWidth = ref(860)
const loadedImages = ref<Record<string, HTMLImageElement>>({})
const activePinch = ref<{
  slotId: string
  startDistance: number
  originScale: number
} | null>(null)
let resizeObserver: ResizeObserver | null = null

const previewScale = computed(() => {
  if (!shellWidth.value) {
    return 0.5
  }

  return Math.min(1, Math.max(0.28, shellWidth.value / props.template.pageSize.width))
})

const stageWidth = computed(() => props.template.pageSize.width * previewScale.value)
const stageHeight = computed(() => props.template.pageSize.height * previewScale.value)
const isInteractive = computed(() => props.interactive ?? true)

watch(
  () => props.photos,
  (photos) => {
    Object.values(photos).forEach((photo) => {
      if (loadedImages.value[photo.id]) {
        return
      }

      const image = new Image()
      image.onload = () => {
        loadedImages.value = {
          ...loadedImages.value,
          [photo.id]: image,
        }
      }
      image.src = photo.src
    })

    const activeIds = new Set(Object.keys(photos))
    loadedImages.value = Object.fromEntries(
      Object.entries(loadedImages.value).filter(([photoId]) => activeIds.has(photoId)),
    )
  },
  { immediate: true, deep: true },
)

onMounted(() => {
  if (!shellRef.value) {
    return
  }

  shellWidth.value = shellRef.value.clientWidth - 32
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      shellWidth.value = entry.contentRect.width
    }
  })
  resizeObserver.observe(shellRef.value)
  shellRef.value.addEventListener('touchstart', handleTouchStart, { passive: true })
  shellRef.value.addEventListener('touchmove', handleTouchMove, { passive: false })
  shellRef.value.addEventListener('touchend', handleTouchEnd, { passive: true })
  shellRef.value.addEventListener('touchcancel', handleTouchEnd, { passive: true })
})

onBeforeUnmount(() => {
  if (shellRef.value) {
    shellRef.value.removeEventListener('touchstart', handleTouchStart)
    shellRef.value.removeEventListener('touchmove', handleTouchMove)
    shellRef.value.removeEventListener('touchend', handleTouchEnd)
    shellRef.value.removeEventListener('touchcancel', handleTouchEnd)
  }
  resizeObserver?.disconnect()
})

function getBinding(slotId: string) {
  return props.bindings[slotId] ?? createEmptyBinding(slotId)
}

function getPhotoForSlot(slotId: string) {
  const binding = getBinding(slotId)
  return binding.imageId ? props.photos[binding.imageId] ?? null : null
}

function getImageSize(photo: PhotoAsset) {
  return {
    width: photo.naturalWidth,
    height: photo.naturalHeight,
  }
}

function getImageElement(photoId: string) {
  return loadedImages.value[photoId]
}

function getLayout(slot: PhotoSlot, binding: SlotPhotoState, photo: PhotoAsset) {
  return getSlotImageLayout(slot, getImageSize(photo), binding)
}

function getPhotoConfig(slot: PhotoSlot) {
  const binding = getBinding(slot.id)
  const photo = getPhotoForSlot(slot.id)

  if (!binding.imageId || !photo) {
    return null
  }

  const image = getImageElement(binding.imageId)

  if (!image) {
    return null
  }

  const layout = getLayout(slot, binding, photo)

  return {
    image,
    x: layout.centerX,
    y: layout.centerY,
    offsetX: layout.drawWidth / 2,
    offsetY: layout.drawHeight / 2,
    width: layout.drawWidth,
    height: layout.drawHeight,
    rotation: layout.rotation,
    draggable: isInteractive.value && props.unlockedSlotId === slot.id,
  }
}

function emitSlotSelection(slotId: string) {
  if (!isInteractive.value) {
    return
  }

  emit('selectSlot', slotId)
}

function handleEmptySlotPress(slotId: string) {
  if (!isInteractive.value) {
    return
  }

  emitSlotSelection(slotId)
  emit('addPhoto', slotId)
}

function handleReplacePhoto(event: { cancelBubble: boolean }, slotId: string) {
  event.cancelBubble = true

  if (!isInteractive.value) {
    return
  }

  emitSlotSelection(slotId)
  emit('replacePhoto', slotId)
}

function handleToggleLock(event: { cancelBubble: boolean }, slotId: string) {
  event.cancelBubble = true

  if (!isInteractive.value) {
    return
  }

  emitSlotSelection(slotId)
  emit('toggleLock', slotId)
}

function handleRotateRight(event: { cancelBubble: boolean }, slotId: string) {
  event.cancelBubble = true

  if (!isInteractive.value) {
    return
  }

  emitSlotSelection(slotId)
  emit('rotateRight', slotId)
}

function syncDraggedPosition(
  slot: PhotoSlot,
  binding: SlotPhotoState,
  photo: PhotoAsset,
  target: { x: () => number; y: () => number; position: (coords: { x: number; y: number }) => void },
) {
  const nextBinding = transformFromImageCenter(
    slot,
    getImageSize(photo),
    binding,
    target.x(),
    target.y(),
  )
  const nextLayout = getSlotImageLayout(slot, getImageSize(photo), nextBinding)
  target.position({ x: nextLayout.centerX, y: nextLayout.centerY })
  emit('updateTransform', slot.id, nextBinding)
}

function handleDrag(slot: PhotoSlot, target: { x: () => number; y: () => number; position: (coords: { x: number; y: number }) => void }) {
  if (!isInteractive.value || props.unlockedSlotId !== slot.id) {
    return
  }

  const binding = getBinding(slot.id)
  const photo = getPhotoForSlot(slot.id)

  if (!photo) {
    return
  }

  emitSlotSelection(slot.id)
  syncDraggedPosition(slot, binding, photo, target)
}

function handleWheel(event: { evt: WheelEvent }, slot: PhotoSlot, binding: SlotPhotoState, photo: PhotoAsset) {
  if (!isInteractive.value || props.unlockedSlotId !== slot.id) {
    return
  }

  event.evt.preventDefault()
  emitSlotSelection(slot.id)

  const delta = event.evt.deltaY > 0 ? -0.08 : 0.08
  const nextBinding = clampBinding(slot, getImageSize(photo), {
    ...binding,
    scale: binding.scale + delta,
  })

  emit('updateTransform', slot.id, nextBinding)
}

function handleSlotWheel(event: { evt: WheelEvent }, slot: PhotoSlot) {
  if (!isInteractive.value) {
    return
  }

  const photo = getPhotoForSlot(slot.id)

  if (!photo) {
    return
  }

  handleWheel(event, slot, getBinding(slot.id), photo)
}

function getTouchDistance(touches: TouchList) {
  if (touches.length < 2) {
    return 0
  }

  return Math.hypot(
    touches[1].clientX - touches[0].clientX,
    touches[1].clientY - touches[0].clientY,
  )
}

function handleTouchStart(event: TouchEvent) {
  if (!isInteractive.value || !props.selectedSlotId || props.unlockedSlotId !== props.selectedSlotId) {
    return
  }

  if (event.touches.length !== 2) {
    return
  }

  const binding = getBinding(props.selectedSlotId)

  if (!binding.imageId) {
    return
  }

  activePinch.value = {
    slotId: props.selectedSlotId,
    startDistance: getTouchDistance(event.touches),
    originScale: binding.scale,
  }
}

function handleTouchMove(event: TouchEvent) {
  if (!activePinch.value || event.touches.length !== 2) {
    return
  }

  const slot = props.template.slots.find((item) => item.id === activePinch.value?.slotId)

  if (!slot || props.unlockedSlotId !== activePinch.value.slotId) {
    activePinch.value = null
    return
  }

  const binding = getBinding(slot.id)

  if (!binding.imageId) {
    activePinch.value = null
    return
  }

  const photo = props.photos[binding.imageId]

  if (!photo) {
    activePinch.value = null
    return
  }

  event.preventDefault()

  const nextBinding = clampBinding(slot, getImageSize(photo), {
    ...binding,
    scale: activePinch.value.originScale * (getTouchDistance(event.touches) / activePinch.value.startDistance),
  })

  emit('updateTransform', slot.id, nextBinding)
}

function handleTouchEnd(event: TouchEvent) {
  if (event.touches.length < 2) {
    activePinch.value = null
  }
}

function getLockButtonConfig(slot: PhotoSlot) {
  return {
    x: slot.x + 18,
    y: slot.y + 18,
    width: 112,
    height: 42,
  }
}

function getActionButtonConfig(slot: PhotoSlot, index: number) {
  const width = index === 0 ? 148 : 118

  return {
    x: slot.x + slot.width - width - 18,
    y: slot.y + 18 + index * 54,
    width,
    height: 42,
  }
}
</script>

<template>
  <div
    ref="shellRef"
    class="stage-shell"
    :class="{
      'stage-shell--interactive': isInteractive,
      'stage-shell--static': !isInteractive,
    }"
  >
    <v-stage :config="{ width: stageWidth, height: stageHeight }">
      <v-layer :config="{ scaleX: previewScale, scaleY: previewScale }">
        <v-rect
          :config="{
            x: 0,
            y: 0,
            width: template.pageSize.width,
            height: template.pageSize.height,
            fill: template.background,
            cornerRadius: 0,
            shadowColor: 'rgba(17, 24, 39, 0.16)',
            shadowBlur: 40,
            shadowOffsetY: 18,
          }"
        />

        <template v-for="slot in template.slots" :key="slot.id">
          <v-group
            v-if="getPhotoForSlot(slot.id) && getBinding(slot.id).imageId"
            :config="{
              clipX: slot.x,
              clipY: slot.y,
              clipWidth: slot.width,
              clipHeight: slot.height,
            }"
            @click="emitSlotSelection(slot.id)"
            @tap="emitSlotSelection(slot.id)"
          >
            <v-image
              v-if="getPhotoConfig(slot)"
              :config="getPhotoConfig(slot)"
              @dragmove="handleDrag(slot, $event.target)"
              @dragend="handleDrag(slot, $event.target)"
              @wheel="handleSlotWheel($event, slot)"
            />
          </v-group>

          <v-rect
            :config="{
              x: slot.x,
              y: slot.y,
              width: slot.width,
              height: slot.height,
              stroke:
                isInteractive && selectedSlotId === slot.id
                  ? props.unlockedSlotId === slot.id
                    ? template.accent
                    : 'rgba(245, 158, 11, 0.95)'
                  : 'rgba(107, 114, 128, 0.35)',
              strokeWidth: isInteractive && selectedSlotId === slot.id ? 10 : 4,
              dash: getBinding(slot.id).imageId ? [] : [18, 12],
              cornerRadius: 0, //slot.borderRadius ?? 18,
              listening: isInteractive,
            }"
            @click="getBinding(slot.id).imageId ? emitSlotSelection(slot.id) : handleEmptySlotPress(slot.id)"
            @tap="getBinding(slot.id).imageId ? emitSlotSelection(slot.id) : handleEmptySlotPress(slot.id)"
            @wheel="handleSlotWheel($event, slot)"
          />

          <v-text
            v-if="!getBinding(slot.id).imageId"
            :config="{
              x: slot.x,
              y: slot.y + slot.height / 2 - 42,
              width: slot.width,
              align: 'center',
              text: '+',
              fontSize: 92,
              fontStyle: '700',
              fill: template.accent,
              listening: false,
            }"
          />

          <v-text
            v-if="!getBinding(slot.id).imageId"
            :config="{
              x: slot.x + 32,
              y: slot.y + slot.height / 2 + 28,
              width: slot.width - 64,
              align: 'center',
              text: slot.placeholder,
              fontSize: 30,
              fill: 'rgba(71, 85, 105, 0.82)',
              listening: false,
            }"
          />

          <v-text
            :config="{
              x: slot.x + 18,
              y: slot.y + 18,
              text: slot.id.toUpperCase(),
              fontSize: 22,
              fontStyle: '700',
              fill:
                isInteractive && selectedSlotId === slot.id && props.unlockedSlotId === slot.id
                  ? template.accent
                  : 'rgba(71, 85, 105, 0.75)',
              listening: false,
            }"
          />

          <v-group
            v-if="getBinding(slot.id).imageId"
            @click="handleToggleLock($event, slot.id)"
            @tap="handleToggleLock($event, slot.id)"
          >
            <v-rect
              :config="{
                x: getLockButtonConfig(slot).x,
                y: getLockButtonConfig(slot).y,
                width: getLockButtonConfig(slot).width,
                height: getLockButtonConfig(slot).height,
                fill:
                  props.unlockedSlotId === slot.id
                    ? 'rgba(22, 163, 74, 0.92)'
                    : 'rgba(220, 38, 38, 0.92)',
                cornerRadius: 999,
                shadowColor: 'rgba(17, 24, 39, 0.18)',
                shadowBlur: 16,
                shadowOffsetY: 6,
              }"
            />
            <v-text
              :config="{
                x: getLockButtonConfig(slot).x,
                y: getLockButtonConfig(slot).y + 11,
                width: getLockButtonConfig(slot).width,
                align: 'center',
                text: props.unlockedSlotId === slot.id ? 'EDIT' : 'LOCK',
                fontSize: 18,
                fontStyle: '700',
                fill: 'white',
              }"
            />
          </v-group>

          <v-group
            v-if="isInteractive && getBinding(slot.id).imageId && props.unlockedSlotId === slot.id"
            :config="{ listening: false }"
          >
            <v-rect
              :config="{
                x: slot.x + 18,
                y: slot.y + slot.height - 60,
                width: Math.min(slot.width - 36, 320),
                height: 40,
                fill: 'rgba(255, 255, 255, 0.88)',
                cornerRadius: 14,
              }"
            />
            <v-text
              :config="{
                x: slot.x + 18,
                y: slot.y + slot.height - 48,
                width: Math.min(slot.width - 36, 320),
                text: '1 ngon de di chuyen · 2 ngon de zoom',
                align: 'center',
                fontSize: 16,
                fontStyle: '700',
                fill: 'rgba(17, 24, 39, 0.92)',
              }"
            />
          </v-group>

          <v-group
            v-if="isInteractive && getBinding(slot.id).imageId && props.unlockedSlotId === slot.id"
            @click="handleRotateRight($event, slot.id)"
            @tap="handleRotateRight($event, slot.id)"
          >
            <v-rect
              :config="{
                x: getActionButtonConfig(slot, 0).x,
                y: getActionButtonConfig(slot, 0).y,
                width: getActionButtonConfig(slot, 0).width,
                height: getActionButtonConfig(slot, 0).height,
                fill: 'rgba(17, 24, 39, 0.78)',
                cornerRadius: 16,
                shadowColor: 'rgba(17, 24, 39, 0.18)',
                shadowBlur: 18,
                shadowOffsetY: 8,
              }"
            />
            <v-text
              :config="{
                x: getActionButtonConfig(slot, 0).x,
                y: getActionButtonConfig(slot, 0).y + 10,
                width: getActionButtonConfig(slot, 0).width,
                align: 'center',
                text: 'Xoay phải',
                fontSize: 18,
                fontStyle: '700',
                fill: 'white',
              }"
            />
          </v-group>

          <v-group
            v-if="isInteractive && getBinding(slot.id).imageId && props.unlockedSlotId === slot.id"
            @click="handleReplacePhoto($event, slot.id)"
            @tap="handleReplacePhoto($event, slot.id)"
          >
            <v-rect
              :config="{
                x: getActionButtonConfig(slot, 1).x,
                y: getActionButtonConfig(slot, 1).y,
                width: getActionButtonConfig(slot, 1).width,
                height: getActionButtonConfig(slot, 1).height,
                fill: 'rgba(17, 24, 39, 0.78)',
                cornerRadius: 16,
                shadowColor: 'rgba(17, 24, 39, 0.18)',
                shadowBlur: 18,
                shadowOffsetY: 8,
              }"
            />
            <v-text
              :config="{
                x: getActionButtonConfig(slot, 1).x,
                y: getActionButtonConfig(slot, 1).y + 10,
                width: getActionButtonConfig(slot, 1).width,
                align: 'center',
                text: 'Replace',
                fontSize: 18,
                fontStyle: '700',
                fill: 'white',
              }"
            />
          </v-group>
        </template>
      </v-layer>
    </v-stage>
  </div>
</template>

<style scoped>
.stage-shell {
  position: relative;
  padding: 16px;
  overflow: hidden;
  border: 1px solid var(--line);
  background: white;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.4);
}


@media (pointer: fine) {
  .stage-shell--interactive {
    touch-action: none;
  }
}

.stage-shell--static :deep(.konvajs-content),
.stage-shell--static :deep(canvas) {
  pointer-events: none;
}
</style>
