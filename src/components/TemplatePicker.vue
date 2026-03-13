<script setup lang="ts">
import type { TemplateDefinition } from '../modules/collage/types'

const props = defineProps<{
  templates: TemplateDefinition[]
  selectedId: string
}>()

defineEmits<{
  select: [templateId: string]
}>()

function getSlotStyle(template: TemplateDefinition, slot: TemplateDefinition['slots'][number]) {
  return {
    left: `${(slot.x / template.pageSize.width) * 100}%`,
    top: `${(slot.y / template.pageSize.height) * 100}%`,
    width: `${(slot.width / template.pageSize.width) * 100}%`,
    height: `${(slot.height / template.pageSize.height) * 100}%`,
  }
}
</script>

<template>
  <div class="template-picker">
    <div class="section-header">
      <div>
        <p class="section-kicker">Templates</p>
        <h2>Choose a layout</h2>
      </div>
      <span class="section-counter">{{ props.templates.length }} presets</span>
    </div>

    <div class="template-list">
      <button
        v-for="template in props.templates"
        :key="template.id"
        type="button"
        class="template-card"
        :class="{ 'template-card--active': template.id === props.selectedId }"
        :style="{ '--template-accent': template.accent }"
        @click="$emit('select', template.id)"
      >
        <div class="template-card__preview" :style="{ background: template.background }">
          <span
            v-for="slot in template.slots"
            :key="slot.id"
            class="template-card__slot"
            :style="getSlotStyle(template, slot)"
          />
        </div>

        <div class="template-card__copy">
          <div>
            <strong>{{ template.name }}</strong>
            <p>{{ template.description }}</p>
          </div>
          <span>{{ template.slots.length }} slot{{ template.slots.length > 1 ? 's' : '' }}</span>
        </div>
      </button>
    </div>
  </div>
</template>

<style scoped>
.template-picker {
  display: grid;
  gap: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: end;
}

.section-kicker {
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
  color: var(--accent-strong);
}

.section-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.section-counter {
  font-size: 0.84rem;
  color: var(--ink-soft);
}

.template-list {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(272px, 86vw);
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
  scroll-snap-type: x proximity;
}

.template-card {
  display: grid;
  gap: 14px;
  width: 100%;
  padding: 14px;
  text-align: left;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.7);
  scroll-snap-align: start;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
  cursor: pointer;
}

.template-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--template-accent) 55%, white);
  box-shadow: 0 12px 24px rgba(31, 41, 55, 0.08);
}

.template-card--active {
  border-color: var(--template-accent);
  box-shadow:
    0 14px 30px rgba(31, 41, 55, 0.08),
    inset 0 0 0 1px color-mix(in srgb, var(--template-accent) 65%, white);
}

.template-card__preview {
  position: relative;
  aspect-ratio: 210 / 297;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.75);
}

.template-card__slot {
  position: absolute;
  display: block;
  border-radius: 10px;
  border: 2px dashed color-mix(in srgb, var(--template-accent) 70%, white);
  background: rgba(255, 255, 255, 0.78);
}

.template-card__copy {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
}

.template-card strong {
  display: block;
  margin-bottom: 4px;
  font-size: 0.98rem;
}

.template-card p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.86rem;
  line-height: 1.4;
}

.template-card span {
  font-size: 0.78rem;
  color: var(--ink-soft);
  white-space: nowrap;
}

@media (min-width: 1100px) {
  .template-list {
    grid-auto-flow: row;
    grid-auto-columns: initial;
    max-height: 720px;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 4px;
    padding-bottom: 0;
  }
}
</style>
