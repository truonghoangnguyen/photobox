<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import CollageStage from '../components/CollageStage.vue'
import TemplatePicker from '../components/TemplatePicker.vue'
import ToolbarPanel from '../components/ToolbarPanel.vue'
import { resolveStationBySlug } from '../lib/api'
import { exportCollageToPdf } from '../lib/export/pdf'
import { clampBinding } from '../modules/collage/layout'
import { COLLAGE_TEMPLATES } from '../modules/collage/templates'
import { useCollageStore } from '../modules/collage/store'
import type { PhotoSlot } from '../modules/collage/types'
import type { StationSummary } from '../../shared/contracts'

const route = useRoute()
const store = useCollageStore()
const { selectedTemplateId, selectedSlotId, slotBindings, filledSlotCount, missingRequiredSlots } =
  storeToRefs(store)

const exporting = ref(false)
const exportError = ref<string | null>(null)
const filePickerRef = ref<HTMLInputElement | null>(null)
const pendingSlotId = ref<string | null>(null)
const station = ref<StationSummary | null>(null)
const stationLoading = ref(false)
const stationError = ref<string | null>(null)

const stationSlug = computed(() => {
  const raw = route.params.stationSlug
  return typeof raw === 'string' && raw.length > 0 ? raw : 'tram1'
})

const template = computed(() => store.template)
const selectedSlot = computed(() =>
  template.value.slots.find((slot: PhotoSlot) => slot.id === selectedSlotId.value) ?? null,
)
const selectedBinding = computed(() =>
  selectedSlotId.value ? slotBindings.value[selectedSlotId.value] ?? null : null,
)
const selectedPhotoName = computed(() => {
  const imageId = selectedBinding.value?.imageId
  return imageId ? store.photos[imageId]?.name ?? null : null
})
const canExport = computed(
  () =>
    template.value.slots.length > 0 &&
    missingRequiredSlots.value.length === 0 &&
    station.value?.status !== 'inactive',
)
const stationLabel = computed(() => station.value?.name ?? `Station ${stationSlug.value}`)
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

  if (missingRequiredSlots.value.length > 0) {
    return `Add ${missingRequiredSlots.value.length} more photo${missingRequiredSlots.value.length > 1 ? 's' : ''} to unlock the PDF export.`
  }

  return 'Ready to generate a one-page A4 PDF.'
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

function handleZoomDelta(delta: number) {
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

function handleResetSelectedSlot() {
  if (selectedSlotId.value) {
    store.resetSlotTransform(selectedSlotId.value)
  }
}

function handleClearSelectedSlot() {
  if (selectedSlotId.value) {
    store.clearSlot(selectedSlotId.value)
  }
}

async function handleFilesSelected(files: File[]) {
  const addedPhotoIds = await store.addPhotos(files)

  if (pendingSlotId.value && addedPhotoIds[0]) {
    store.assignPhotoToSlot(pendingSlotId.value, addedPhotoIds[0])
  }

  pendingSlotId.value = null
}

function openSlotFilePicker(slotId: string) {
  pendingSlotId.value = slotId
  filePickerRef.value?.click()
}

function handleHiddenFileInput(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files ? Array.from(target.files) : []

  if (files.length > 0) {
    void handleFilesSelected(files)
  } else {
    pendingSlotId.value = null
  }

  target.value = ''
}

async function handleExportPdf() {
  if (!canExport.value || exporting.value) {
    return
  }

  exporting.value = true
  exportError.value = null

  try {
    await exportCollageToPdf({
      template: template.value,
      bindings: slotBindings.value,
      photos: store.photos,
      filename: `print-${stationSlug.value}.pdf`,
      exportScale: store.exportSettings.scale,
    })
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

    <header class="hero-panel panel">
      <div>
        <p class="eyebrow">Station Route: /{{ stationSlug }}</p>
        <h1>Photo collage editor for fast A4 PDF output</h1>
        <p class="hero-copy">
          This station-aware page resolves the printer from the URL, so the same frontend can serve <code>/tram1</code>, <code>/tram2</code>, and every other station slug.
        </p>
      </div>

      <div class="hero-meta">
        <div class="status-pill">
          <span class="status-pill__value">{{ filledSlotCount }}/{{ template.slots.length }}</span>
          <span class="status-pill__label">slots filled</span>
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
          <div>
            <p class="panel-kicker">Canvas preview</p>
            <h2>A4 portrait layout</h2>
          </div>
          <p class="panel-note">
            Tap a slot to select it. Drag the photo to reposition, then use the zoom slider below for mobile-friendly crop control.
          </p>
        </div>

        <CollageStage
          :template="template"
          :photos="store.photos"
          :bindings="slotBindings"
          :selected-slot-id="selectedSlotId"
          @select-slot="store.selectSlot"
          @update-transform="store.updateSlotTransform"
          @add-photo="openSlotFilePicker"
        />
      </section>

      <section class="panel panel--toolbar">
        <ToolbarPanel
          :selected-slot="selectedSlot"
          :selected-binding="selectedBinding"
          :selected-photo-name="selectedPhotoName"
          :filled-slot-count="filledSlotCount"
          :total-slot-count="template.slots.length"
          :missing-slots="missingRequiredSlots.map((slot: PhotoSlot) => slot.placeholder)"
          :can-export="canExport"
          :is-exporting="exporting"
          :export-error="exportError"
          @zoom-in="handleZoomDelta(0.12)"
          @zoom-out="handleZoomDelta(-0.12)"
          @zoom-reset="handleResetSelectedSlot"
          @set-scale="handleSetScale"
          @clear-slot="handleClearSelectedSlot"
          @export-pdf="handleExportPdf"
        />
      </section>

      <section class="panel panel--templates">
        <TemplatePicker
          :templates="COLLAGE_TEMPLATES"
          :selected-id="selectedTemplateId"
          @select="store.selectTemplate"
        />
      </section>
    </main>
  </div>
</template>
