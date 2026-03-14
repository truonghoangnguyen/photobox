<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { listPrintJobs, listStations, updatePrintJobStatus, getPrintJobFileUrl } from '../lib/api'
import type { PrintJobSummary, StationSummary } from '../../shared/contracts'

const stations = ref<StationSummary[]>([])
const jobs = ref<PrintJobSummary[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const activeTab = ref<'jobs' | 'stations'>('jobs')

const activeStations = computed(() => stations.value.filter((station) => station.status === 'active').length)
const pendingJobs = computed(
  () => jobs.value.filter((job) => job.status === 'pending' || job.status === 'processing').length,
)

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

async function loadDashboard() {
  try {
    error.value = null
    const [stationsResponse, jobsResponse] = await Promise.all([listStations(), listPrintJobs()])
    stations.value = stationsResponse.stations
    jobs.value = jobsResponse.jobs
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.'
  } finally {
    loading.value = false
  }
}

async function cancelJob(job: PrintJobSummary) {
  if (job.status === 'cancelled') return
  try {
    await updatePrintJobStatus(job.id, 'cancelled')
    job.status = 'cancelled'
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to cancel job')
  }
}

async function resetJob(job: PrintJobSummary) {
  try {
    await updatePrintJobStatus(job.id, 'pending')
    job.status = 'pending'
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to reset job')
  }
}

function printJob(job: PrintJobSummary) {
  if (!job.outputR2Key) {
    alert('No file available to print.')
    return
  }
  const url = getPrintJobFileUrl(job.id)
  window.open(url, '_blank')
}

onMounted(async () => {
  await loadDashboard()
})

</script>

<template>
  <div class="dashboard-shell">
    <section class="panel dashboard-panel dashboard-hero">
      <div>
        <p class="eyebrow">Operator / Admin</p>
        <h1>Print network dashboard</h1>
        <p class="dashboard-copy">
          This screen reads station and print-job data from the Worker API so you can monitor the network while we continue building auth and workflows.
        </p>
      </div>

      <button type="button" class="refresh-button" @click="loadDashboard">
        Refresh now
      </button>
    </section>

    <section class="dashboard-metrics">
      <article class="panel metric-card">
        <span>Total stations</span>
        <strong>{{ stations.length }}</strong>
        <small>{{ activeStations }} active</small>
      </article>

      <article class="panel metric-card">
        <span>Print jobs</span>
        <strong>{{ jobs.length }}</strong>
        <small>{{ pendingJobs }} need attention</small>
      </article>
    </section>

    <section v-if="error" class="panel dashboard-panel error-panel">
      <strong>Dashboard error</strong>
      <span>{{ error }}</span>
    </section>

    <section class="panel dashboard-panel">
      <div class="dashboard-tabs">
        <button
          type="button"
          class="tab-button"
          :class="{ 'tab-button--active': activeTab === 'jobs' }"
          @click="activeTab = 'jobs'"
        >
          Print jobs
        </button>
        <button
          type="button"
          class="tab-button"
          :class="{ 'tab-button--active': activeTab === 'stations' }"
          @click="activeTab = 'stations'"
        >
          Stations
        </button>
      </div>

      <div v-if="loading" class="empty-copy">Loading dashboard data...</div>

      <div v-else-if="activeTab === 'jobs'" class="list-container">
        <div class="list-header">
          <div class="col-job">Job & Station</div>
          <div class="col-details">Details</div>
          <div class="col-amount">Amount</div>
          <div class="col-status">Status</div>
          <div class="col-date">Date</div>
          <div class="col-actions">Actions</div>
        </div>

        <div class="list-body">
          <article v-for="job in jobs" :key="job.id" class="list-row">
            <div class="col-job">
              <strong>{{ job.jobCode }}</strong>
              <p>{{ job.stationSlug }}</p>
            </div>

            <div class="col-details">
              <span>Tpl: {{ job.templateId ?? 'n/a' }}</span>
              <span>Slots: {{ job.slotCount ?? 0 }}</span>
            </div>

            <div class="col-amount">
              {{ formatMoney(job.totalAmount) }}
            </div>

            <div class="col-status">
              <span class="status-chip" :class="`status-chip--${job.status}`">{{ job.status }}</span>
            </div>

            <div class="col-date">
              {{ formatDate(job.createdAt) }}
            </div>

            <div class="col-actions">
              <button
                v-if="job.status === 'failed' || job.status === 'cancelled'"
                type="button"
                class="action-btn btn-reset"
                @click="resetJob(job)"
              >
                Reset
              </button>
              <button
                type="button"
                class="action-btn"
                :disabled="job.status === 'cancelled'"
                @click="cancelJob(job)"
              >
                Hủy
              </button>
              <button
                type="button"
                class="action-btn btn-print"
                :disabled="!job.outputR2Key"
                @click="printJob(job)"
              >
                In
              </button>
            </div>
          </article>
        </div>

        <div v-if="jobs.length === 0" class="empty-copy">No print jobs yet. Submit one from a station page like `/tram1`.</div>
      </div>

      <div v-else class="data-grid">
        <article v-for="station in stations" :key="station.id" class="data-card">
          <div class="data-card__top">
            <div>
              <strong>{{ station.name }}</strong>
              <p>/{{ station.slug }}</p>
            </div>
            <span class="status-chip" :class="`status-chip--${station.status}`">{{ station.status }}</span>
          </div>

          <div class="data-card__meta">
            <span>{{ station.location || 'No location yet' }}</span>
          </div>

          <RouterLink class="ghost-link" :to="`/${station.slug}`">
            Open station page
          </RouterLink>
        </article>

        <div v-if="stations.length === 0" class="empty-copy">No stations found in D1 yet.</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard-shell {
  width: min(100vw - 16px, 1180px);
  margin: 0 auto;
  padding: 16px 0 28px;
  display: grid;
  gap: 14px;
}

.dashboard-panel {
  padding: 20px;
}

.dashboard-hero {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.dashboard-hero h1 {
  margin: 6px 0 10px;
  font-size: clamp(2rem, 8vw, 3.5rem);
  line-height: 0.96;
}

.dashboard-copy {
  margin: 0;
  color: var(--ink-soft);
  max-width: 60ch;
}

.refresh-button {
  align-self: start;
  padding: 0.85rem 1.1rem;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
  color: white;
  cursor: pointer;
  font-weight: 700;
}

.dashboard-metrics {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.metric-card {
  padding: 18px;
  display: grid;
  gap: 6px;
}

.metric-card span,
.metric-card small {
  color: var(--ink-soft);
}

.metric-card strong {
  font-size: clamp(1.8rem, 7vw, 2.4rem);
}

.dashboard-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.tab-button {
  padding: 0.75rem 1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  color: var(--ink-strong);
  cursor: pointer;
}

.tab-button--active {
  background: var(--ink-strong);
  color: white;
}

.data-grid {
  display: grid;
  gap: 12px;
}

.data-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.64);
}

.data-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
}

.data-card__top strong {
  display: block;
  font-size: 1.05rem;
}

.data-card__top p {
  margin: 4px 0 0;
  color: var(--ink-soft);
}

.data-card__meta {
  display: grid;
  gap: 6px;
  color: var(--ink-soft);
  font-size: 0.94rem;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.38rem 0.7rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-chip--draft {
  background: rgba(100, 116, 139, 0.12);
  color: #475569;
}

.status-chip--active,
.status-chip--completed,
.status-chip--printed {
  background: rgba(57, 161, 105, 0.12);
  color: #2f7e54;
}

.status-chip--pending,
.status-chip--processing {
  background: rgba(204, 143, 88, 0.14);
  color: var(--accent-strong);
}

.status-chip--inactive,
.status-chip--failed,
.status-chip--cancelled {
  background: rgba(177, 84, 84, 0.12);
  color: #9c4b4b;
}

.ghost-link {
  color: var(--accent-strong);
  word-break: break-word;
}

.empty-copy,
.error-panel span {
  color: var(--ink-soft);
}

.error-panel {
  display: grid;
  gap: 6px;
}

.list-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-x: auto;
}

.list-header {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr 1fr;
  gap: 16px;
  padding: 12px 16px;
  font-weight: 600;
  color: var(--ink-soft);
  border-bottom: 2px solid var(--line);
  min-width: 800px;
}

.list-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 800px;
}

.list-row {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1fr 1fr 1fr 1fr;
  gap: 16px;
  align-items: center;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.64);
  border: 1px solid var(--line);
}

.list-row:hover {
  background: rgba(255, 255, 255, 0.9);
}

.col-job strong {
  display: block;
  font-size: 1.05rem;
}

.col-job p {
  margin: 4px 0 0;
  color: var(--ink-soft);
  font-size: 0.9rem;
}

.col-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--ink-soft);
  font-size: 0.9rem;
}

.col-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  background: var(--line);
  color: var(--ink-strong);
  border: none;
  transition: all 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: #e2e8f0;
}

.btn-print {
  background: var(--accent);
  color: white;
}

.btn-print:hover:not(:disabled) {
  background: var(--accent-strong);
}

.btn-reset {
  background: var(--ink-soft);
  color: white;
}

.btn-reset:hover:not(:disabled) {
  background: var(--ink-strong);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (min-width: 860px) {
  .dashboard-shell {
    width: min(100vw - 24px, 1180px);
    padding-top: 24px;
  }

  .dashboard-hero {
    flex-direction: row;
    justify-content: space-between;
    align-items: start;
  }

  .data-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
