<script setup lang="ts">
import type { PhotoSlot, SlotPhotoState } from '../modules/collage/types'

defineProps<{
  selectedSlot: PhotoSlot | null
  selectedBinding: SlotPhotoState | null
  selectedPhotoName: string | null
  isUnlocked: boolean
  filledSlotCount: number
  totalSlotCount: number
  missingSlots: string[]
  canExport: boolean
  isExporting: boolean
  exportError: string | null
}>()

const emit = defineEmits<{
  zoomIn: []
  zoomOut: []
  zoomReset: []
  setScale: [scale: number]
  rotateLeft: []
  rotateRight: []
  replacePhoto: []
  clearSlot: []
  toggleLock: []
  exportPdf: []
}>()

function onScaleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('setScale', Number(target.value))
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar__header">
      <div>
        <p class="section-kicker">Adjustments</p>
        <h2>Fine-tune the active frame</h2>
      </div>
      <span class="completion-badge">{{ filledSlotCount }}/{{ totalSlotCount }} ready</span>
    </div>

    <div class="selection-card">
      <template v-if="selectedSlot">
        <strong>{{ selectedSlot.placeholder }}</strong>
        <span>{{ selectedBinding?.imageId ? selectedPhotoName : 'No photo assigned yet' }}</span>
        <span v-if="selectedBinding?.imageId" class="lock-state">
          {{ isUnlocked ? 'Unlocked: can zoom / rotate / move' : 'Locked: unlock to edit this photo' }}
        </span>
      </template>
      <template v-else>
        <strong>No slot selected</strong>
        <span>Click any placeholder on the canvas to target it.</span>
      </template>
    </div>

    <div class="control-stack">
      <div class="control-group">
        <div class="control-label">
          <span>Zoom</span>
          <strong>{{ selectedBinding?.scale?.toFixed(2) ?? '1.00' }}x</strong>
        </div>

        <input
          class="zoom-range"
          :disabled="!selectedBinding?.imageId || !isUnlocked"
          type="range"
          min="1"
          max="3"
          step="0.01"
          :value="selectedBinding?.scale ?? 1"
          @input="onScaleInput"
        />

        <div class="button-row">
          <button type="button" class="ghost-button" :disabled="!selectedBinding?.imageId || !isUnlocked" @click="emit('zoomOut')">
            Zoom out
          </button>
          <button type="button" class="ghost-button" :disabled="!selectedBinding?.imageId || !isUnlocked" @click="emit('zoomIn')">
            Zoom in
          </button>
          <button type="button" class="ghost-button" :disabled="!selectedBinding?.imageId || !isUnlocked" @click="emit('zoomReset')">
            Reset
          </button>
        </div>
      </div>

      <div class="control-group">
        <div class="control-label">
          <span>Slot actions</span>
          <strong>Current frame</strong>
        </div>

        <div class="button-row">
          <button type="button" class="ghost-button" :disabled="!selectedBinding?.imageId || !isUnlocked" @click="emit('rotateLeft')">
            Rotate left
          </button>
          <button type="button" class="ghost-button" :disabled="!selectedBinding?.imageId || !isUnlocked" @click="emit('rotateRight')">
            Rotate right
          </button>
          <button type="button" class="ghost-button" :disabled="!selectedBinding?.imageId" @click="emit('toggleLock')">
            {{ isUnlocked ? 'Lock' : 'Unlock' }}
          </button>
        </div>

        <div class="button-row">
          <button type="button" class="ghost-button" :disabled="!selectedBinding?.imageId || !isUnlocked" @click="emit('replacePhoto')">
            Replace
          </button>
          <button type="button" class="ghost-button ghost-button--danger" :disabled="!selectedBinding?.imageId || !isUnlocked" @click="emit('clearSlot')">
            Clear selected slot
          </button>
        </div>

        <p v-if="selectedBinding?.imageId && !isUnlocked" class="lock-hint">
          Only the unlocked photo can be adjusted at a time.
        </p>
      </div>
    </div>

    <div class="export-card">
      <div>
        <p class="section-kicker">Export</p>
        <h3>Generate print-ready PDF</h3>
        <p v-if="missingSlots.length > 0" class="export-copy">
          Fill these slots first: {{ missingSlots.join(', ') }}
        </p>
        <p v-else class="export-copy">
          The PDF will include every generated template page using the current crop and positioning.
        </p>
        <p v-if="exportError" class="export-error">{{ exportError }}</p>
      </div>

      <button type="button" class="export-button" :disabled="!canExport || isExporting" @click="emit('exportPdf')">
        {{ isExporting ? 'Generating PDF...' : 'Print / Export PDF' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.toolbar__header {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
}

.section-kicker {
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: var(--accent-strong);
}

.toolbar__header h2,
.export-card h3 {
  margin: 0;
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

.selection-card,
.control-group,
.export-card {
  display: grid;
  gap: 10px;
  padding: 16px;
  /* border-radius: 20px; */
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.6);
}

.selection-card span,
.export-copy {
  color: var(--ink-soft);
}

.lock-state,
.lock-hint {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.84rem;
}

.control-stack {
  display: grid;
  gap: 12px;
}

.control-label {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.control-label span {
  color: var(--ink-soft);
  font-size: 0.9rem;
}

.zoom-range {
  width: 100%;
  accent-color: var(--accent-strong);
}

.button-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.ghost-button,
.export-button {
  border-radius: 14px;
  padding: 0.8rem 0.95rem;
  cursor: pointer;
  transition:
    transform 180ms ease,
    opacity 180ms ease,
    box-shadow 180ms ease;
}

.ghost-button {
  background: rgba(255, 255, 255, 0.88);
  color: var(--ink-strong);
  border: 1px solid var(--line);
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

.ghost-button:not(:disabled):hover,
.export-button:not(:disabled):hover {
  transform: translateY(-1px);
}

.export-card {
  gap: 14px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
}

.export-error {
  margin: 0;
  color: #b74d4d;
  font-size: 0.9rem;
}

@media (min-width: 1100px) {
  .toolbar {
    padding: 20px;
  }

  .toolbar__header {
    flex-direction: row;
    align-items: end;
  }
}
</style>
