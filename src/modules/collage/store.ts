import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getTemplateById, COLLAGE_TEMPLATES } from './templates'
import { createEmptyBinding, type PhotoAsset, type PhotoSlot, type SlotPhotoState } from './types'

const DEFAULT_EXPORT_FILENAME = 'photobox-collage.pdf'
const DEFAULT_TEMPLATE = COLLAGE_TEMPLATES[0]

if (!DEFAULT_TEMPLATE) {
  throw new Error('At least one collage template is required.')
}

async function readImageMetadata(src: string) {
  return await new Promise<{ naturalWidth: number; naturalHeight: number }>((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      resolve({
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      })
    }

    image.onerror = () => reject(new Error('Unable to load the selected image.'))
    image.src = src
  })
}

function createPhotoId(file: File) {
  return `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 9)}`
}

function reconcileBindings(
  currentBindings: Record<string, SlotPhotoState>,
  nextSlots: PhotoSlot[],
) {
  return nextSlots.reduce<Record<string, SlotPhotoState>>((accumulator, slot) => {
    accumulator[slot.id] = currentBindings[slot.id] ?? createEmptyBinding(slot.id)
    return accumulator
  }, {})
}

export const useCollageStore = defineStore('collage', () => {
  const selectedTemplateId = ref(DEFAULT_TEMPLATE.id)
  const selectedSlotId = ref<string | null>(DEFAULT_TEMPLATE.slots[0]?.id ?? null)
  const photos = ref<Record<string, PhotoAsset>>({})
  const photoOrder = ref<string[]>([])
  const slotBindings = ref<Record<string, SlotPhotoState>>(
    reconcileBindings({}, DEFAULT_TEMPLATE.slots),
  )
  const exportSettings = ref({
    filename: DEFAULT_EXPORT_FILENAME,
    scale: 2,
  })

  const template = computed(
    () => getTemplateById(selectedTemplateId.value) ?? DEFAULT_TEMPLATE,
  )
  const orderedPhotos = computed(() =>
    photoOrder.value.map((photoId) => photos.value[photoId]).filter(Boolean),
  )
  const slotUsageMap = computed<Record<string, string[]>>(() => {
    return template.value.slots.reduce<Record<string, string[]>>((usage, slot) => {
      const imageId = slotBindings.value[slot.id]?.imageId

      if (imageId) {
        usage[imageId] = [...(usage[imageId] ?? []), slot.id]
      }

      return usage
    }, {})
  })
  const filledSlotCount = computed(
    () => template.value.slots.filter((slot) => slotBindings.value[slot.id]?.imageId).length,
  )
  const missingRequiredSlots = computed(() =>
    template.value.slots.filter((slot) => !slotBindings.value[slot.id]?.imageId),
  )

  function selectTemplate(templateId: string) {
    const nextTemplate = getTemplateById(templateId)

    if (!nextTemplate) {
      return
    }

    selectedTemplateId.value = nextTemplate.id
    slotBindings.value = reconcileBindings(slotBindings.value, nextTemplate.slots)

    if (!selectedSlotId.value || !nextTemplate.slots.some((slot) => slot.id === selectedSlotId.value)) {
      selectedSlotId.value = nextTemplate.slots[0]?.id ?? null
    }
  }

  function selectSlot(slotId: string) {
    if (template.value.slots.some((slot) => slot.id === slotId)) {
      selectedSlotId.value = slotId
    }
  }

  async function addPhotos(fileList: File[] | FileList) {
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'))
    const addedPhotoIds: string[] = []

    for (const file of files) {
      const id = createPhotoId(file)
      const src = URL.createObjectURL(file)
      const metadata = await readImageMetadata(src)

      photos.value[id] = {
        id,
        name: file.name,
        src,
        naturalWidth: metadata.naturalWidth,
        naturalHeight: metadata.naturalHeight,
      }
      photoOrder.value.unshift(id)
      addedPhotoIds.push(id)
    }

    return addedPhotoIds
  }

  function assignPhotoToSlot(slotId: string, photoId: string) {
    if (!photos.value[photoId]) {
      return
    }

    slotBindings.value[slotId] = {
      slotId,
      imageId: photoId,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    }
    selectedSlotId.value = slotId
  }

  function assignPhotoToFirstEmpty(photoId: string) {
    const firstEmptySlot = template.value.slots.find((slot) => !slotBindings.value[slot.id]?.imageId)
    const targetSlotId = selectedSlotId.value ?? firstEmptySlot?.id ?? template.value.slots[0]?.id

    if (targetSlotId) {
      assignPhotoToSlot(targetSlotId, photoId)
    }
  }

  function updateSlotTransform(slotId: string, patch: Partial<SlotPhotoState>) {
    const current = slotBindings.value[slotId] ?? createEmptyBinding(slotId)
    slotBindings.value[slotId] = { ...current, ...patch, slotId }
  }

  function resetSlotTransform(slotId: string) {
    const binding = slotBindings.value[slotId]

    if (!binding) {
      return
    }

    slotBindings.value[slotId] = {
      ...binding,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    }
  }

  function clearSlot(slotId: string) {
    slotBindings.value[slotId] = createEmptyBinding(slotId)
  }

  function removePhoto(photoId: string) {
    const photo = photos.value[photoId]

    if (photo) {
      URL.revokeObjectURL(photo.src)
    }

    delete photos.value[photoId]
    photoOrder.value = photoOrder.value.filter((id) => id !== photoId)

    Object.values(slotBindings.value).forEach((binding) => {
      if (binding.imageId === photoId) {
        slotBindings.value[binding.slotId] = createEmptyBinding(binding.slotId)
      }
    })
  }

  return {
    selectedTemplateId,
    selectedSlotId,
    photos,
    photoOrder,
    slotBindings,
    exportSettings,
    template,
    orderedPhotos,
    slotUsageMap,
    filledSlotCount,
    missingRequiredSlots,
    selectTemplate,
    selectSlot,
    addPhotos,
    assignPhotoToSlot,
    assignPhotoToFirstEmpty,
    updateSlotTransform,
    resetSlotTransform,
    clearSlot,
    removePhoto,
  }
})
