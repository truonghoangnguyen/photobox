import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getTemplateById, COLLAGE_TEMPLATES } from './templates'
import { createEmptyBinding, type PhotoSlot, type SlotPhotoState } from './types'
import type { PhotoAsset } from '../print-core/types'
import { createDefaultTransform, type PhotoTransform } from '../print-core/transform'

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
  const selectedGridPhotoId = ref<string | null>(null)
  const photos = ref<Record<string, PhotoAsset>>({})
  const photoOrder = ref<string[]>([])
  const gridPhotoTransforms = ref<Record<string, PhotoTransform>>({})
  const slotBindings = ref<Record<string, SlotPhotoState>>(
    reconcileBindings({}, DEFAULT_TEMPLATE.slots),
  )
  const exportSettings = ref({
    filename: DEFAULT_EXPORT_FILENAME,
    scale: 2,
  })

  const pendingPrint = ref<{
    blob: Blob
    pageCount: number
    templateId: string
    slotCount: number
    stationSlug: string
  } | null>(null)

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
      gridPhotoTransforms.value[id] = createDefaultTransform()
      photoOrder.value.unshift(id)
      addedPhotoIds.push(id)
    }

    if (!selectedGridPhotoId.value && addedPhotoIds[0]) {
      selectedGridPhotoId.value = addedPhotoIds[0]
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
      ...createDefaultTransform(),
    }
    selectedSlotId.value = slotId
  }

  async function replacePhoto(photoId: string, file: File) {
    const current = photos.value[photoId]

    if (!current || !file.type.startsWith('image/')) {
      return false
    }

    const src = URL.createObjectURL(file)

    try {
      const metadata = await readImageMetadata(src)
      URL.revokeObjectURL(current.src)
      photos.value[photoId] = {
        id: photoId,
        name: file.name,
        src,
        naturalWidth: metadata.naturalWidth,
        naturalHeight: metadata.naturalHeight,
      }
      gridPhotoTransforms.value[photoId] = createDefaultTransform()
      return true
    } catch (error) {
      URL.revokeObjectURL(src)
      throw error
    }
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

  function selectGridPhoto(photoId: string | null) {
    if (!photoId || photos.value[photoId]) {
      selectedGridPhotoId.value = photoId
    }
  }

  function updateGridPhotoTransform(photoId: string, patch: Partial<PhotoTransform>) {
    if (!photos.value[photoId]) {
      return
    }

    const current = gridPhotoTransforms.value[photoId] ?? createDefaultTransform()
    gridPhotoTransforms.value[photoId] = { ...current, ...patch }
  }

  function resetGridPhotoTransform(photoId: string) {
    if (!photos.value[photoId]) {
      return
    }

    gridPhotoTransforms.value[photoId] = createDefaultTransform()
  }

  function resetSlotTransform(slotId: string) {
    const binding = slotBindings.value[slotId]

    if (!binding) {
      return
    }

    slotBindings.value[slotId] = {
      ...binding,
      ...createDefaultTransform(),
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
    delete gridPhotoTransforms.value[photoId]
    photoOrder.value = photoOrder.value.filter((id) => id !== photoId)

    if (selectedGridPhotoId.value === photoId) {
      selectedGridPhotoId.value = photoOrder.value[0] ?? null
    }

    Object.values(slotBindings.value).forEach((binding) => {
      if (binding.imageId === photoId) {
        slotBindings.value[binding.slotId] = createEmptyBinding(binding.slotId)
      }
    })
  }

  function clearAllPhotos() {
    for (const photoId of photoOrder.value) {
      const photo = photos.value[photoId]

      if (photo) {
        URL.revokeObjectURL(photo.src)
      }
    }

    photos.value = {}
    photoOrder.value = []
    gridPhotoTransforms.value = {}
    selectedGridPhotoId.value = null

    Object.keys(slotBindings.value).forEach((slotId) => {
      slotBindings.value[slotId] = createEmptyBinding(slotId)
    })
  }

  function setPendingPrint(data: typeof pendingPrint.value) {
    pendingPrint.value = data
  }

  function clearPendingPrint() {
    pendingPrint.value = null
  }

  return {
    selectedTemplateId,
    selectedSlotId,
    selectedGridPhotoId,
    photos,
    photoOrder,
    gridPhotoTransforms,
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
    replacePhoto,
    assignPhotoToSlot,
    assignPhotoToFirstEmpty,
    selectGridPhoto,
    updateGridPhotoTransform,
    resetGridPhotoTransform,
    updateSlotTransform,
    resetSlotTransform,
    clearSlot,
    removePhoto,
    clearAllPhotos,
    pendingPrint,
    setPendingPrint,
    clearPendingPrint,
  }
})
