<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import CollageStage from '../components/CollageStage.vue'
import GridPreview from '../components/GridPreview.vue'
import TemplatePicker from '../components/TemplatePicker.vue'
import { createPrintJob, resolveStationBySlug } from '../lib/api'
import { renderCollagePdfBlob } from '../lib/export/pdf'
import { renderGridPdfBlob } from '../lib/export/gridPdf'
import { clampBinding } from '../modules/collage/layout'
import { buildTemplatePreviewPages } from '../modules/collage/preview'
import { COLLAGE_TEMPLATES } from '../modules/collage/templates'
import { useCollageStore } from '../modules/collage/store'
import type { PhotoSlot, TemplateDefinition } from '../modules/collage/types'
import { buildAutoGridLayout } from '../modules/grid/layout'
import { DEFAULT_PRINT_SIZE, getPrintSizeById, PRINT_SIZE_OPTIONS } from '../modules/grid/printSizes'
import { clampTransform, createDefaultTransform } from '../modules/print-core/transform'
import type { StationSummary } from '../../shared/contracts'

type EditorMode = 'template' | 'grid'

const route = useRoute()
const store = useCollageStore()
const {
  selectedTemplateId,
  selectedSlotId,
  selectedGridPhotoId,
  slotBindings,
  gridPhotoTransforms,
  filledSlotCount,
  missingRequiredSlots,
  orderedPhotos,
  slotUsageMap,
} = storeToRefs(store)

const editorMode = ref<EditorMode>('grid')
const selectedPrintSizeId = ref(DEFAULT_PRINT_SIZE.id)
const exporting = ref(false)
const exportError = ref<string | null>(null)
const filePickerRef = ref<HTMLInputElement | null>(null)
const bulkFilePickerRef = ref<HTMLInputElement | null>(null)
const pendingTarget = ref<{ type: 'slot'; slotId: string } | { type: 'grid'; photoId: string } | null>(null)
const station = ref<StationSummary | null>(null)
const stationLoading = ref(false)
const stationError = ref<string | null>(null)
const lastJobCode = ref<string | null>(null)
const unlockedSlotId = ref<string | null>(null)
const unlockedGridPhotoId = ref<string | null>(null)

const stationSlug = computed(() => {
  const raw = route.params.stationSlug
  return typeof raw === 'string' && raw.length > 0 ? raw : 'tram1'
})

const template = computed(() => store.template)
const hasPhotos = computed(() => orderedPhotos.value.length > 0)
const selectedSlot = computed(() =>
  template.value.slots.find((slot: PhotoSlot) => slot.id === selectedSlotId.value) ?? null,
)
const selectedBinding = computed(() =>
  selectedSlotId.value ? slotBindings.value[selectedSlotId.value] ?? null : null,
)
const selectedGridPhoto = computed(() =>
  selectedGridPhotoId.value ? store.photos[selectedGridPhotoId.value] ?? null : null,
)
const selectedGridBinding = computed(() =>
  selectedGridPhotoId.value
    ? gridPhotoTransforms.value[selectedGridPhotoId.value] ?? createDefaultTransform()
    : null,
)
const selectedPhotoName = computed(() => {
  if (editorMode.value === 'grid') {
    return selectedGridPhoto.value?.name ?? null
  }

  const imageId = selectedBinding.value?.imageId
  return imageId ? store.photos[imageId]?.name ?? null : null
})
const isSelectedTemplateSlotUnlocked = computed(
  () => !!selectedSlotId.value && unlockedSlotId.value === selectedSlotId.value,
)
const isSelectedGridPhotoUnlocked = computed(
  () => !!selectedGridPhotoId.value && unlockedGridPhotoId.value === selectedGridPhotoId.value,
)
const selectedPrintSize = computed(() => getPrintSizeById(selectedPrintSizeId.value))
const gridLayout = computed(() => buildAutoGridLayout(orderedPhotos.value, selectedPrintSize.value))
const templatePreviewPages = computed(() =>
  buildTemplatePreviewPages(template.value, orderedPhotos.value, slotBindings.value),
)
const heroMetricValue = computed(() => {
  if (!hasPhotos.value) {
    return '0'
  }

  if (editorMode.value === 'grid') {
    return `${orderedPhotos.value.length}`
  }

  return `${filledSlotCount.value}/${template.value.slots.length}`
})
const heroMetricLabel = computed(() => {
  if (!hasPhotos.value) {
    return 'photos queued'
  }

  if (editorMode.value === 'grid') {
    return orderedPhotos.value.length === 1 ? 'photo queued' : 'photos queued'
  }

  return 'slots filled'
})
const canExport = computed(() => {
  if (station.value?.status === 'inactive') {
    return false
  }

  if (editorMode.value === 'grid') {
    return orderedPhotos.value.length > 0
  }

  return template.value.slots.length > 0 && missingRequiredSlots.value.length === 0
})
const stationLabel = computed(() => station.value?.name ?? `Station ${stationSlug.value}`)
const gridSummary = computed(() => {
  if (orderedPhotos.value.length === 0) {
    return 'Start with one or more uploads. The app will place them into an A4 grid automatically.'
  }

  return `${selectedPrintSize.value.label} · ${gridLayout.value.columns} x ${gridLayout.value.rows} per page · ${gridLayout.value.pageCount} A4 page${gridLayout.value.pageCount > 1 ? 's' : ''}`
})
const statusMessage = computed(() => {
  if (stationLoading.value) {
    return 'Loading station details...'
  }

  if (stationError.value) {
    return stationError.value
  }

  if (station.value?.status === 'inactive') {
    return 'This station is inactive and cannot accept print jobs.'
  }

  if (lastJobCode.value) {
    return `Print request ${lastJobCode.value} was sent to ${stationLabel.value}.`
  }

  if (editorMode.value === 'grid') {
    return gridSummary.value
  }

  if (missingRequiredSlots.value.length > 0) {
    return `Add ${missingRequiredSlots.value.length} more photo${missingRequiredSlots.value.length > 1 ? 's' : ''} to unlock the PDF export.`
  }

  return `Template is ready to generate ${templatePreviewPages.value.length} A4 page${templatePreviewPages.value.length > 1 ? 's' : ''}.`
})

watch(
  stationSlug,
  async (slug) => {
    stationLoading.value = true
    stationError.value = null

    try {
      const response = await resolveStationBySlug(slug)
      station.value = response.station
    } catch (error) {
      station.value = null
      stationError.value = error instanceof Error ? error.message : 'Unable to load the station.'
    } finally {
      stationLoading.value = false
    }
  },
  { immediate: true },
)

watch(editorMode, () => {
  exportError.value = null
  lastJobCode.value = null

  if (editorMode.value === 'grid' && !selectedGridPhotoId.value) {
    store.selectGridPhoto(orderedPhotos.value[0]?.id ?? null)
  }
})

watch(selectedSlotId, (slotId) => {
  if (slotId && !slotBindings.value[slotId]?.imageId && unlockedSlotId.value === slotId) {
    unlockedSlotId.value = null
  }
})

watch(selectedGridPhotoId, (photoId) => {
  if (!photoId && unlockedGridPhotoId.value) {
    unlockedGridPhotoId.value = null
  }
})

watch(orderedPhotos, (photos) => {
  if (unlockedGridPhotoId.value && !photos.some((photo) => photo.id === unlockedGridPhotoId.value)) {
    unlockedGridPhotoId.value = null
  }
})

watch(
  slotBindings,
  (bindings) => {
    if (unlockedSlotId.value && !bindings[unlockedSlotId.value]?.imageId) {
      unlockedSlotId.value = null
    }
  },
  { deep: true },
)

function fillEmptyTemplateSlots(photoIds: string[] = orderedPhotos.value.map((photo) => photo.id)) {
  const usedPhotoIds = new Set(Object.keys(slotUsageMap.value))

  photoIds.forEach((photoId) => {
    if (usedPhotoIds.has(photoId)) {
      return
    }

    const emptySlot = template.value.slots.find((slot) => !slotBindings.value[slot.id]?.imageId)

    if (!emptySlot) {
      return
    }

    store.assignPhotoToSlot(emptySlot.id, photoId)
    usedPhotoIds.add(photoId)
  })
}

function handleSelectTemplate(templateId: string) {
  store.selectTemplate(templateId)
  editorMode.value = 'template'
  fillEmptyTemplateSlots()
}

function handleSelectPrintSize(printSizeId: string) {
  selectedPrintSizeId.value = printSizeId
  editorMode.value = 'grid'
  store.selectGridPhoto(selectedGridPhotoId.value ?? orderedPhotos.value[0]?.id ?? null)
}

function getTemplateOptionSlotStyle(
  currentTemplate: TemplateDefinition,
  slot: TemplateDefinition['slots'][number],
) {
  return {
    left: `${(slot.x / currentTemplate.pageSize.width) * 100}%`,
    top: `${(slot.y / currentTemplate.pageSize.height) * 100}%`,
    width: `${(slot.width / currentTemplate.pageSize.width) * 100}%`,
    height: `${(slot.height / currentTemplate.pageSize.height) * 100}%`,
  }
}

function handleZoomDelta(delta: number) {
  if (editorMode.value === 'grid') {
    if (!isSelectedGridPhotoUnlocked.value) {
      return
    }

    const photo = selectedGridPhoto.value
    const binding = selectedGridBinding.value

    if (!photo || !binding) {
      return
    }

    const nextBinding = clampTransform(
      { x: 0, y: 0, width: gridLayout.value.cellWidth, height: gridLayout.value.cellHeight },
      { width: photo.naturalWidth, height: photo.naturalHeight },
      { ...binding, scale: binding.scale + delta },
    )

    store.updateGridPhotoTransform(photo.id, nextBinding)
    return
  }

  if (!isSelectedTemplateSlotUnlocked.value) {
    return
  }

  const slot = selectedSlot.value
  const binding = selectedBinding.value

  if (!slot || !binding?.imageId) {
    return
  }

  const photo = store.photos[binding.imageId]

  if (!photo) {
    return
  }

  const nextBinding = clampBinding(
    slot,
    { width: photo.naturalWidth, height: photo.naturalHeight },
    { ...binding, scale: binding.scale + delta },
  )

  store.updateSlotTransform(slot.id, nextBinding)
}

function handleSetScale(scale: number) {
  if (editorMode.value === 'grid') {
    if (!isSelectedGridPhotoUnlocked.value) {
      return
    }

    const photo = selectedGridPhoto.value
    const binding = selectedGridBinding.value

    if (!photo || !binding) {
      return
    }

    const nextBinding = clampTransform(
      { x: 0, y: 0, width: gridLayout.value.cellWidth, height: gridLayout.value.cellHeight },
      { width: photo.naturalWidth, height: photo.naturalHeight },
      { ...binding, scale },
    )

    store.updateGridPhotoTransform(photo.id, nextBinding)
    return
  }

  if (!isSelectedTemplateSlotUnlocked.value) {
    return
  }

  const slot = selectedSlot.value
  const binding = selectedBinding.value

  if (!slot || !binding?.imageId) {
    return
  }

  const photo = store.photos[binding.imageId]

  if (!photo) {
    return
  }

  const nextBinding = clampBinding(
    slot,
    { width: photo.naturalWidth, height: photo.naturalHeight },
    { ...binding, scale },
  )

  store.updateSlotTransform(slot.id, nextBinding)
}

function handleRotateSelected(delta: number) {
  if (editorMode.value === 'grid') {
    if (!isSelectedGridPhotoUnlocked.value) {
      return
    }

    const photo = selectedGridPhoto.value
    const binding = selectedGridBinding.value

    if (!photo || !binding) {
      return
    }

    const nextBinding = clampTransform(
      { x: 0, y: 0, width: gridLayout.value.cellWidth, height: gridLayout.value.cellHeight },
      { width: photo.naturalWidth, height: photo.naturalHeight },
      { ...binding, rotation: binding.rotation + delta },
    )

    store.updateGridPhotoTransform(photo.id, nextBinding)
    return
  }

  if (!isSelectedTemplateSlotUnlocked.value) {
    return
  }

  const slot = selectedSlot.value
  const binding = selectedBinding.value

  if (!slot || !binding?.imageId) {
    return
  }

  const photo = store.photos[binding.imageId]

  if (!photo) {
    return
  }

  const nextBinding = clampBinding(
    slot,
    { width: photo.naturalWidth, height: photo.naturalHeight },
    { ...binding, rotation: binding.rotation + delta },
  )

  store.updateSlotTransform(slot.id, nextBinding)
}

function handleResetSelectedSlot() {
  if (editorMode.value === 'grid') {
    if (selectedGridPhotoId.value && isSelectedGridPhotoUnlocked.value) {
      store.resetGridPhotoTransform(selectedGridPhotoId.value)
    }
    return
  }

  if (selectedSlotId.value && isSelectedTemplateSlotUnlocked.value) {
    store.resetSlotTransform(selectedSlotId.value)
  }
}

function handleClearSelectedSlot() {
  if (editorMode.value === 'grid') {
    if (selectedGridPhotoId.value && isSelectedGridPhotoUnlocked.value) {
      store.removePhoto(selectedGridPhotoId.value)
    }
    return
  }

  if (selectedSlotId.value && isSelectedTemplateSlotUnlocked.value) {
    store.clearSlot(selectedSlotId.value)
  }
}

function handleReplaceSelected() {
  if (editorMode.value === 'grid') {
    if (selectedGridPhotoId.value && isSelectedGridPhotoUnlocked.value) {
      pendingTarget.value = { type: 'grid', photoId: selectedGridPhotoId.value }
      filePickerRef.value?.click()
    }
    return
  }

  if (selectedSlotId.value && isSelectedTemplateSlotUnlocked.value) {
    openSlotFilePicker(selectedSlotId.value)
  }
}

function handleToggleLockSelected() {
  if (editorMode.value === 'grid') {
    const photoId = selectedGridPhotoId.value

    if (!photoId || !selectedGridPhoto.value) {
      return
    }

    if (unlockedGridPhotoId.value === photoId) {
      unlockedGridPhotoId.value = null
      return
    }

    unlockedSlotId.value = null
    unlockedGridPhotoId.value = photoId
    return
  }

  const slotId = selectedSlotId.value

  if (!slotId || !selectedBinding.value?.imageId) {
    return
  }

  if (unlockedSlotId.value === slotId) {
    unlockedSlotId.value = null
    return
  }

  unlockedGridPhotoId.value = null
  unlockedSlotId.value = slotId
}

function handleGridToggleLock(photoId: string) {
  store.selectGridPhoto(photoId)

  if (unlockedGridPhotoId.value === photoId) {
    unlockedGridPhotoId.value = null
    return
  }

  unlockedSlotId.value = null
  unlockedGridPhotoId.value = photoId
}

function handleGridRotateRight(photoId: string) {
  store.selectGridPhoto(photoId)
  if (unlockedGridPhotoId.value !== photoId) {
    unlockedSlotId.value = null
    unlockedGridPhotoId.value = photoId
  }
  handleRotateSelected(90)
}

function handleTemplateToggleLock(slotId: string) {
  store.selectSlot(slotId)

  const binding = slotBindings.value[slotId]

  if (!binding?.imageId) {
    return
  }

  if (unlockedSlotId.value === slotId) {
    unlockedSlotId.value = null
    return
  }

  unlockedGridPhotoId.value = null
  unlockedSlotId.value = slotId
}

function handleTemplateRotateRight(slotId: string) {
  store.selectSlot(slotId)

  const binding = slotBindings.value[slotId]

  if (!binding?.imageId) {
    return
  }

  if (unlockedSlotId.value !== slotId) {
    unlockedGridPhotoId.value = null
    unlockedSlotId.value = slotId
  }

  handleRotateSelected(90)
}

async function handleFilesSelected(files: File[]) {
  const target = pendingTarget.value

  if (target?.type === 'grid' && files[0]) {
    await store.replacePhoto(target.photoId, files[0])
    store.selectGridPhoto(target.photoId)
    unlockedGridPhotoId.value = target.photoId
    unlockedSlotId.value = null
    pendingTarget.value = null
    return
  }

  const addedPhotoIds = await store.addPhotos(files)

  if (target?.type === 'slot' && addedPhotoIds[0]) {
    store.assignPhotoToSlot(target.slotId, addedPhotoIds[0])
    unlockedSlotId.value = target.slotId
    unlockedGridPhotoId.value = null
  } else if (editorMode.value === 'template') {
    fillEmptyTemplateSlots(addedPhotoIds)
  } else if (addedPhotoIds[0]) {
    store.selectGridPhoto(addedPhotoIds[0])
  }

  pendingTarget.value = null
}

function openSlotFilePicker(slotId: string) {
  pendingTarget.value = { type: 'slot', slotId }
  filePickerRef.value?.click()
}

function openGridReplacePicker(photoId: string) {
  pendingTarget.value = { type: 'grid', photoId }
  filePickerRef.value?.click()
}

function openBulkFilePicker() {
  bulkFilePickerRef.value?.click()
}

function handleHiddenFileInput(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files ? Array.from(target.files) : []

  if (files.length > 0) {
    void handleFilesSelected(files)
  } else {
    pendingTarget.value = null
  }

  target.value = ''
}

function handleBulkFileInput(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files ? Array.from(target.files) : []

  if (files.length > 0) {
    void handleFilesSelected(files)
  }

  target.value = ''
}

async function handleExportPdf() {
  if (!canExport.value || exporting.value) {
    return
  }

  exporting.value = true
  exportError.value = null
  lastJobCode.value = null

  try {
    const pdfBlob =
      editorMode.value === 'grid'
        ? await renderGridPdfBlob({
            photos: orderedPhotos.value,
            printSize: selectedPrintSize.value,
            transforms: gridPhotoTransforms.value,
          })
        : await renderCollagePdfBlob({
            template: template.value,
            bindings: slotBindings.value,
            photos: store.photos,
            orderedPhotos: orderedPhotos.value,
            exportScale: store.exportSettings.scale,
          })

    const response = await createPrintJob(
      {
        stationSlug: stationSlug.value,
        templateId:
          editorMode.value === 'grid'
            ? `auto-grid-${selectedPrintSize.value.id}`
            : selectedTemplateId.value,
        slotCount:
          editorMode.value === 'grid' ? orderedPhotos.value.length : template.value.slots.length,
        totalAmount: 0,
      },
      pdfBlob,
    )

    lastJobCode.value = response.job.jobCode
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : 'Failed to generate the PDF.'
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="app-shell">
    <input
      ref="filePickerRef"
      class="sr-only-input"
      accept="image/png,image/jpeg,image/webp"
      type="file"
      @change="handleHiddenFileInput"
    />
    <input
      ref="bulkFilePickerRef"
      class="sr-only-input"
      accept="image/png,image/jpeg,image/webp"
      type="file"
      multiple
      @change="handleBulkFileInput"
    />



    <header class="hero-panel panel">
      <div>
        <p class="eyebrow">Station Route: /{{ stationSlug }}</p>
        <h1>Photo print station with instant grid-first upload flow</h1>
        <p class="hero-copy">
          Customers start from an empty screen, upload one or many photos, see them arranged as a grid by default, then switch to a print size or a collage template below.
        </p>
      </div>

      <div class="hero-meta">
        <div class="status-pill">
          <span class="status-pill__value">{{ heroMetricValue }}</span>
          <span class="status-pill__label">{{ heroMetricLabel }}</span>
        </div>

        <div class="status-copy">
          <strong>{{ stationLabel }}</strong>
          <span>{{ statusMessage }}</span>
        </div>
      </div>
    </header>

    <main class="workspace-grid">
      <section class="panel preview-panel panel--preview">
        <div class="panel-heading">
          <div class="panel-title-group">
            <p class="panel-kicker">{{ editorMode === 'template' ? 'Template preview' : 'Grid preview' }}</p>
            <h2>{{ editorMode === 'template' ? template.name : hasPhotos ? `${selectedPrintSize.label} print sheet` : 'Start with photo upload' }}</h2>
          </div>

          <div class="photo-strip-inline">
            <div class="photo-strip__scroller">
              <button type="button" class="photo-tile photo-tile--add" @click="openBulkFilePicker">
                <span class="photo-tile__plus">+</span>
                <span class="photo-tile__label">Thêm ảnh</span>
              </button>

              <article
                v-for="photo in orderedPhotos"
                :key="photo.id"
                class="photo-tile"
                :class="{ 'photo-tile--active': selectedGridPhotoId === photo.id && editorMode === 'grid' }"
                @click="store.selectGridPhoto(photo.id)"
              >
                <img :src="photo.src" :alt="photo.name" class="photo-tile__image" />
                <button
                  type="button"
                  class="photo-tile__remove"
                  aria-label="Xóa ảnh"
                  @click.stop="store.removePhoto(photo.id)"
                >
                  ×
                </button>
                <span class="photo-tile__name">{{ photo.name }}</span>
              </article>
            </div>
          </div>

          <div class="preview-panel__actions">
            <p class="panel-note">
              {{
                editorMode === 'template'
                  ? 'Page 1 stays editable. Extra photos automatically continue onto the next template pages.'
                  : 'Upload one or many images. The page stays empty first, then automatically builds a print grid.'
              }}
            </p>
            <div class="preview-panel__buttons">
              <button
                type="button"
                class="export-button"
                :disabled="!canExport || exporting"
                @click="handleExportPdf"
              >
                {{ exporting ? 'Generating PDF...' : 'Print / Export PDF' }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="editorMode === 'template'" class="template-preview-pages">
          <article
            v-for="page in templatePreviewPages"
            :key="page.index"
            class="template-preview-card"
          >
            <div class="template-preview-card__header">
              PAGE {{ page.index + 1 }}
            </div>

            <CollageStage
              :template="template"
              :photos="store.photos"
              :bindings="page.bindings"
              :selected-slot-id="page.editable ? selectedSlotId : null"
              :unlocked-slot-id="page.editable ? unlockedSlotId : null"
              :interactive="page.editable"
              @select-slot="store.selectSlot"
              @update-transform="store.updateSlotTransform"
              @add-photo="openSlotFilePicker"
              @replace-photo="openSlotFilePicker"
              @toggle-lock="handleTemplateToggleLock"
              @rotate-right="handleTemplateRotateRight"
            />
          </article>
        </div>
        <div v-else-if="!hasPhotos" class="template-preview-pages">
          <article class="template-preview-card">
            <div class="template-preview-card__header">
              PAGE 1
            </div>

            <CollageStage
              :template="COLLAGE_TEMPLATES[0]"
              :photos="{}"
              :bindings="{}"
              :selected-slot-id="null"
              :unlocked-slot-id="null"
              :interactive="true"
              @add-photo="openBulkFilePicker"
            />
          </article>
        </div>

        <GridPreview
          v-else
          :photos="orderedPhotos"
          :layout="gridLayout"
          :print-size="selectedPrintSize"
          :transforms="gridPhotoTransforms"
          :selected-photo-id="selectedGridPhotoId"
          :unlocked-photo-id="unlockedGridPhotoId"
          @select-photo="store.selectGridPhoto"
          @update-transform="store.updateGridPhotoTransform"
          @replace-photo="openGridReplacePicker"
          @toggle-lock="handleGridToggleLock"
          @rotate-right="handleGridRotateRight"
        />
      </section>

      <section class="panel panel--templates">
        <div class="selector-stack">
          <div class="selector-card">
            <div class="control-label">
              <span>Print size</span>
              <strong>{{ editorMode === 'grid' ? selectedPrintSize.label : 'Switch back to auto grid' }}</strong>
            </div>

            <div class="size-chip-row">
              <button
                v-for="option in PRINT_SIZE_OPTIONS"
                :key="option.id"
                type="button"
                class="size-chip"
                :class="{ 'size-chip--active': editorMode === 'grid' && option.id === selectedPrintSizeId }"
                @click="handleSelectPrintSize(option.id)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div class="selector-card selector-card--template">
            <TemplatePicker
              :templates="COLLAGE_TEMPLATES"
              :selected-id="selectedTemplateId"
              @select="handleSelectTemplate"
            />
          </div>
        </div>
      </section>
    </main>

    <section class="panel mobile-layout-dock">
      <div class="mobile-layout-dock__header">
        <div>
          <p class="panel-kicker">Chọn mẫu / grid</p>
          <strong>{{ editorMode === 'grid' ? selectedPrintSize.label : template.name }}</strong>
        </div>
        <span class="completion-badge">{{ orderedPhotos.length }} ảnh</span>
      </div>

      <div class="layout-chooser">
        <button
          v-for="option in PRINT_SIZE_OPTIONS"
          :key="option.id"
          type="button"
          class="layout-choice layout-choice--size"
          :class="{ 'layout-choice--active': editorMode === 'grid' && option.id === selectedPrintSizeId }"
          @click="handleSelectPrintSize(option.id)"
        >
          <span class="layout-choice__badge">Grid</span>
          <strong>{{ option.label }}</strong>
        </button>

        <button
          v-for="item in COLLAGE_TEMPLATES"
          :key="item.id"
          type="button"
          class="layout-choice layout-choice--template"
          :class="{ 'layout-choice--active': editorMode === 'template' && item.id === selectedTemplateId }"
          @click="handleSelectTemplate(item.id)"
        >
          <div class="layout-choice__preview" :style="{ background: item.background }">
            <span
              v-for="slot in item.slots"
              :key="slot.id"
              class="layout-choice__slot"
              :style="getTemplateOptionSlotStyle(item, slot)"
            />
          </div>
          <strong>{{ item.name }}</strong>
        </button>
      </div>

      <button
        type="button"
        class="export-button mobile-layout-dock__action"
        :disabled="!canExport || exporting"
        @click="handleExportPdf"
      >
        {{ exporting ? 'Generating PDF...' : 'Print / Export PDF' }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.photo-strip-inline {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.panel-title-group {
  flex: 0 0 auto;
}

.photo-strip__scroller,
.layout-chooser {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 8px;
  scrollbar-width: thin;
}

.photo-strip__scroller::-webkit-scrollbar,
.layout-chooser::-webkit-scrollbar {
  display: none;
}

.photo-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 0 0 auto;
  width: 84px;
  min-width: 84px;
  gap: 6px;
  padding: 10px 8px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.88);
  color: var(--ink-strong);
}

.photo-tile--add {
  background: linear-gradient(135deg, rgba(204, 143, 88, 0.18), rgba(255, 255, 255, 0.94));
}

.photo-tile--active {
  border-color: var(--accent-strong);
  box-shadow: 0 0 0 1px rgba(167, 100, 40, 0.22);
}

.photo-tile__plus {
  font-size: 2rem;
  line-height: 1;
  color: var(--accent-strong);
}

.photo-tile__label,
.photo-tile__name {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  text-align: center;
}

.photo-tile__image {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.photo-tile__remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.82);
  color: white;
  font-size: 1rem;
  line-height: 1;
}

.size-chip,
.ghost-button,
.export-button {
  border-radius: 16px;
  padding: 0.9rem 1rem;
  cursor: pointer;
  transition:
    transform 180ms ease,
    opacity 180ms ease,
    box-shadow 180ms ease;
}

.size-chip,
.ghost-button {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.82);
  color: var(--ink-strong);
}

.size-chip--active {
  border-color: rgba(167, 100, 40, 0.4);
  background: linear-gradient(135deg, rgba(204, 143, 88, 0.18), rgba(255, 255, 255, 0.9));
  color: var(--accent-strong);
  box-shadow: 0 12px 24px rgba(167, 100, 40, 0.12);
}

.workspace-grid {
  display: grid;
  gap: 14px;
}

.preview-panel__actions {
  display: grid;
  gap: 12px;
}

.preview-panel__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.mobile-layout-dock {
  position: sticky;
  bottom: 0;
  z-index: 12;
  display: grid;
  gap: 12px;
  padding: 14px 12px calc(14px + env(safe-area-inset-bottom));
  margin-top: 12px;
  border-color: rgba(167, 100, 40, 0.2);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(249, 245, 240, 0.98)),
    rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(18px);
}

.mobile-layout-dock__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: end;
}

.mobile-layout-dock__header strong {
  display: block;
  margin-top: 4px;
}

.mobile-layout-dock__action {
  width: 100%;
}

.layout-choice {
  display: grid;
  gap: 10px;
  width: 118px;
  min-width: 118px;
  min-height: 156px;
  padding: 12px 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.88);
  color: var(--ink-strong);
  text-align: left;
  align-content: start;
}

.layout-choice--size {
  grid-template-rows: 1fr auto;
}

.layout-choice--template {
  grid-template-rows: 1fr auto;
}

.layout-choice--active {
  border-color: rgba(167, 100, 40, 0.4);
  background: linear-gradient(135deg, rgba(204, 143, 88, 0.18), rgba(255, 255, 255, 0.94));
  box-shadow: 0 10px 22px rgba(167, 100, 40, 0.14);
}

.layout-choice__badge {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
}

.layout-choice--size .layout-choice__badge {
  align-self: start;
}

.layout-choice--size strong,
.layout-choice--template strong {
  align-self: end;
  font-size: 0.92rem;
}

.layout-choice__preview {
  position: relative;
  aspect-ratio: 210 / 297;
  border: 1px solid rgba(31, 41, 55, 0.18);
  background: white;
  overflow: hidden;
  align-self: stretch;
}

.layout-choice__slot {
  position: absolute;
  display: block;
  border: 1px solid rgba(31, 41, 55, 0.45);
  background: rgba(255, 255, 255, 0.85);
}

.panel--grid-preview,
.panel--grid-controls {
  padding: 16px;
}

.section-kicker {
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: var(--accent-strong);
}

.completion-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  background: rgba(204, 143, 88, 0.12);
  color: var(--accent-strong);
  font-size: 0.82rem;
  font-weight: 700;
}

.selector-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.6);
}

.selector-stack {
  display: grid;
  gap: 16px;
}

.selector-stack--inline {
  margin-top: 18px;
}

.template-preview-pages {
  --template-preview-page-width: clamp(320px, 38vw, 420px);
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: var(--template-preview-page-width);
  gap: 16px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
  align-items: start;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  max-width: 100%;
}

.template-preview-card {
  display: grid;
  gap: 10px;
  width: var(--template-preview-page-width);
  scroll-snap-align: start;
}

.template-preview-card__header {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--ink-soft);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.selector-card--template {
  overflow: hidden;
}

.control-label {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.control-label span,
.export-copy {
  color: var(--ink-soft);
}

.size-chip-row,
.button-row,
.button-row--stack {
  display: grid;
  gap: 10px;
}

.button-row {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.button-row--stack {
  grid-template-columns: 1fr;
}

.zoom-range {
  width: 100%;
  accent-color: var(--accent-strong);
}

.ghost-button--danger {
  color: #8d4b4b;
}

.ghost-button:disabled,
.export-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.export-button {
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  color: white;
  font-weight: 700;
  box-shadow: 0 14px 22px rgba(167, 100, 40, 0.22);
}

.size-chip:not(:disabled):hover,
.ghost-button:not(:disabled):hover,
.export-button:not(:disabled):hover {
  transform: translateY(-1px);
}

.grid-empty-state {
  display: grid;
  justify-items: start;
  gap: 12px;
  padding: 24px;
  border: 1px dashed var(--line-strong);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(247, 241, 236, 0.82)),
    rgba(255, 255, 255, 0.4);
}

.grid-empty-state strong,
.grid-photo-card__meta strong {
  font-size: 1rem;
}

.grid-empty-state p,
.grid-photo-card__meta span,
.export-error {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.9rem;
}

.grid-empty-state__button {
  min-width: 180px;
}

@media (min-width: 760px) {
  .hero-panel {
    display: grid;
  }

  .mobile-layout-dock {
    display: none;
  }

  .workspace-grid {
    grid-template-columns: 1fr;
    gap: 18px;
    align-items: start;
  }

  .size-chip-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .button-row--stack {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1100px) {
  .panel--grid-preview,
  .panel--grid-controls {
    padding: 20px;
  }

  .template-preview-pages {
    grid-auto-columns: var(--template-preview-page-width);
  }
  .size-chip-row {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 759px) {
  .app-shell {
    padding-bottom: 18px;
  }

  .hero-panel,
  .panel--templates,
  .selector-stack--inline {
    display: none;
  }

  .preview-panel,
  .panel--grid-preview {
    padding: 14px;
    min-width: 0;
  }

  .panel-heading {
    margin-bottom: 10px;
  }

  .panel-note {
    font-size: 0.86rem;
  }
}
</style>
