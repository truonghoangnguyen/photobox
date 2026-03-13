<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { bindingFromImagePosition, clampBinding, getSlotImageLayout } from '../modules/collage/layout'
import { createEmptyBinding, type PhotoAsset, type PhotoSlot, type SlotPhotoState, type TemplateDefinition } from '../modules/collage/types'

const props = defineProps<{
  template: TemplateDefinition
  photos: Record<string, PhotoAsset>
  bindings: Record<string, SlotPhotoState>
  selectedSlotId: string | null
}>()

const emit = defineEmits<{
  selectSlot: [slotId: string]
  updateTransform: [slotId: string, patch: Partial<SlotPhotoState>]
  addPhoto: [slotId: string]
}>()

const shellRef = ref<HTMLElement | null>(null)
const shellWidth = ref(860)
const loadedImages = ref<Record<string, HTMLImageElement>>({})
let resizeObserver: ResizeObserver | null = null

const previewScale = computed(() => {
  if (!shellWidth.value) {
    return 0.5
  }

  return Math.min(1, Math.max(0.28, shellWidth.value / props.template.pageSize.width))
})

const stageWidth = computed(() => props.template.pageSize.width * previewScale.value)
const stageHeight = computed(() => props.template.pageSize.height * previewScale.value)

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

  shellWidth.value = shellRef.value.clientWidth - 16
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      shellWidth.value = entry.contentRect.width - 16
    }
  })
  resizeObserver.observe(shellRef.value)
})

onBeforeUnmount(() => {
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
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
    draggable: true,
  }
}

function emitSlotSelection(slotId: string) {
  emit('selectSlot', slotId)
}

function handleEmptySlotPress(slotId: string) {
  emitSlotSelection(slotId)
  emit('addPhoto', slotId)
}

function getReplaceButtonConfig(slot: PhotoSlot) {
  const width = Math.min(148, Math.max(112, slot.width * 0.3))

  return {
    x: slot.x + slot.width - width - 18,
    y: slot.y + 18,
    width,
    height: 46,
  }
}

function handleReplacePhoto(event: { cancelBubble: boolean }, slotId: string) {
  event.cancelBubble = true
  emitSlotSelection(slotId)
  emit('addPhoto', slotId)
}

function syncDraggedPosition(
  slot: PhotoSlot,
  binding: SlotPhotoState,
  photo: PhotoAsset,
  target: { x: () => number; y: () => number; position: (coords: { x: number; y: number }) => void },
) {
  const nextBinding = bindingFromImagePosition(
    slot,
    getImageSize(photo),
    binding,
    target.x(),
    target.y(),
  )
  const nextLayout = getSlotImageLayout(slot, getImageSize(photo), nextBinding)
  target.position({ x: nextLayout.x, y: nextLayout.y })
  emit('updateTransform', slot.id, nextBinding)
}

function handleDrag(slot: PhotoSlot, target: { x: () => number; y: () => number; position: (coords: { x: number; y: number }) => void }) {
  const binding = getBinding(slot.id)
  const photo = getPhotoForSlot(slot.id)

  if (!photo) {
    return
  }

  emitSlotSelection(slot.id)
  syncDraggedPosition(slot, binding, photo, target)
}

function handleWheel(event: { evt: WheelEvent }, slot: PhotoSlot, binding: SlotPhotoState, photo: PhotoAsset) {
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
  const photo = getPhotoForSlot(slot.id)

  if (!photo) {
    return
  }

  handleWheel(event, slot, getBinding(slot.id), photo)
}
</script>

<template>
  <div ref="shellRef" class="stage-shell">
    <v-stage :config="{ width: stageWidth, height: stageHeight }">
      <v-layer :config="{ scaleX: previewScale, scaleY: previewScale }">
        <v-rect
          :config="{
            x: 0,
            y: 0,
            width: template.pageSize.width,
            height: template.pageSize.height,
            fill: template.background,
            cornerRadius: 30,
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
              stroke: selectedSlotId === slot.id ? template.accent : 'rgba(107, 114, 128, 0.35)',
              strokeWidth: selectedSlotId === slot.id ? 10 : 4,
              dash: getBinding(slot.id).imageId ? [] : [18, 12],
              cornerRadius: slot.borderRadius ?? 18,
              listening: true,
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
              fill: selectedSlotId === slot.id ? template.accent : 'rgba(71, 85, 105, 0.75)',
              listening: false,
            }"
          />

          <v-group
            v-if="getBinding(slot.id).imageId"
            @click="handleReplacePhoto($event, slot.id)"
            @tap="handleReplacePhoto($event, slot.id)"
          >
            <v-rect
              :config="{
                x: getReplaceButtonConfig(slot).x,
                y: getReplaceButtonConfig(slot).y,
                width: getReplaceButtonConfig(slot).width,
                height: getReplaceButtonConfig(slot).height,
                fill: 'rgba(17, 24, 39, 0.78)',
                cornerRadius: 16,
                shadowColor: 'rgba(17, 24, 39, 0.18)',
                shadowBlur: 18,
                shadowOffsetY: 8,
              }"
            />
            <v-text
              :config="{
                x: getReplaceButtonConfig(slot).x,
                y: getReplaceButtonConfig(slot).y + 12,
                width: getReplaceButtonConfig(slot).width,
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
  display: flex;
  justify-content: center;
  width: 100%;
  padding: 10px;
  border-radius: 20px;
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0) 48%),
    rgba(206, 210, 213, 0.72);
  overflow: auto;
  touch-action: none;
}

@media (min-width: 1100px) {
  .stage-shell {
    padding: 16px;
    border-radius: 28px;
  }
}
</style>
