<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  changeOwnPassword,
  createUser,
  deleteUser,
  getCurrentUser,
  getPrintJobFileBlob,
  listPrintJobs,
  listStations,
  listUsers,
  loginDashboard,
  logoutDashboard,
  resetUserPassword,
  updatePrintJobStatus,
  type AuthUser,
  type ManagedUser,
} from '../lib/api'
import type { PrintJobSummary, StationSummary } from '../../shared/contracts'

const stations = ref<StationSummary[]>([])
const jobs = ref<PrintJobSummary[]>([])
const users = ref<ManagedUser[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const loginError = ref<string | null>(null)
const currentUser = ref<AuthUser | null>(null)
const activeTab = ref<'jobs' | 'stations' | 'users'>('jobs')
const loginForm = ref({
  username: 'nguyen',
  password: '',
})
const createUserForm = ref({
  username: '',
  password: '',
  name: '',
  stationId: '',
})
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
})
const passwordMessage = ref<string | null>(null)

const activeStations = computed(() => stations.value.filter((station) => station.status === 'active').length)
const pendingJobs = computed(
  () => jobs.value.filter((job) => job.status === 'pending' || job.status === 'processing').length,
)
const isAdmin = computed(() => currentUser.value?.role === 'super_admin')

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
  if (!currentUser.value) {
    loading.value = false
    return
  }

  try {
    error.value = null
    const requests = [listPrintJobs()]

    if (isAdmin.value) {
      requests.push(listStations(), listUsers())
    }

    const [jobsResponse, stationsResponse, usersResponse] = await Promise.all(requests)
    jobs.value = jobsResponse.jobs
    stations.value = stationsResponse?.stations ?? []
    users.value = usersResponse?.users ?? []
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.'
  } finally {
    loading.value = false
  }
}

async function handleLogin() {
  try {
    loginError.value = null
    loading.value = true
    const response = await loginDashboard(loginForm.value)
    currentUser.value = response.user
    createUserForm.value.stationId = stations.value[0]?.id ?? ''
    await loadDashboard()
  } catch (err) {
    loading.value = false
    loginError.value = err instanceof Error ? err.message : 'Unable to login.'
  }
}

async function handleLogout() {
  await logoutDashboard()
  currentUser.value = null
  jobs.value = []
  stations.value = []
  users.value = []
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
  void (async () => {
    if (!job.outputR2Key) {
      alert('No file available to print.')
      return
    }

    const blob = await getPrintJobFileBlob(job.id)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    window.setTimeout(() => URL.revokeObjectURL(url), 30000)
  })()
}

async function handleCreateUser() {
  try {
    await createUser(createUserForm.value)
    createUserForm.value = {
      username: '',
      password: '',
      name: '',
      stationId: createUserForm.value.stationId || stations.value[0]?.id || '',
    }
    await loadDashboard()
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to create user.')
  }
}

async function handleDeleteUser(userId: string) {
  try {
    await deleteUser(userId)
    await loadDashboard()
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to delete user.')
  }
}

async function handleResetUserPassword(user: ManagedUser) {
  const nextPassword = window.prompt(`Set a new password for ${user.username}`, '')

  if (nextPassword === null) {
    return
  }

  try {
    await resetUserPassword(user.id, { password: nextPassword })
    alert(`Password reset for ${user.username}.`)
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to reset password.')
  }
}

async function handleChangeOwnPassword() {
  try {
    passwordMessage.value = null
    await changeOwnPassword(passwordForm.value)
    passwordForm.value = {
      currentPassword: '',
      newPassword: '',
    }
    passwordMessage.value = 'Password updated successfully.'
  } catch (err) {
    passwordMessage.value = err instanceof Error ? err.message : 'Failed to change password.'
  }
}

onMounted(async () => {
  currentUser.value = await getCurrentUser()
  await loadDashboard()
})

</script>

<template>
  <div class="dashboard-shell">
    <section v-if="!currentUser" class="panel dashboard-panel login-panel">
      <div>
        <p class="eyebrow">Dashboard Login</p>
        <h1>Sign in to manage stations and print jobs</h1>
        <p class="dashboard-copy">Seed admin account: <strong>nguyen</strong> with an empty password.</p>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <label>
          <span>Username</span>
          <input v-model="loginForm.username" type="text" autocomplete="username" />
        </label>

        <label>
          <span>Password</span>
          <input v-model="loginForm.password" type="password" autocomplete="current-password" />
        </label>

        <button type="submit" class="refresh-button">Login</button>
      </form>

      <p v-if="loginError" class="error-copy">{{ loginError }}</p>
    </section>

    <template v-else>
    <section class="panel dashboard-panel dashboard-hero">
      <div>
        <p class="eyebrow">Operator / Admin</p>
        <h1>Print network dashboard</h1>
        <p class="dashboard-copy">
          Signed in as <strong>{{ currentUser.name }}</strong> ({{ currentUser.role }}). The dashboard is now protected by Worker sessions stored in D1.
        </p>
        <p v-if="currentUser.role === 'station_operator'" class="dashboard-copy">
          Station scope: <strong>{{ currentUser.stationName || currentUser.stationSlug }}</strong>. You only see jobs for this station.
        </p>
      </div>

      <div class="hero-actions">
        <button type="button" class="refresh-button" @click="loadDashboard">
          Refresh now
        </button>
        <button type="button" class="logout-button" @click="handleLogout">
          Logout
        </button>
      </div>
    </section>

    <section class="dashboard-metrics">
      <article v-if="isAdmin" class="panel metric-card">
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

    <section class="panel dashboard-panel password-panel">
      <div>
        <p class="panel-kicker">Security</p>
        <h2>Change your password</h2>
      </div>

      <form class="password-form" @submit.prevent="handleChangeOwnPassword">
        <label>
          <span>Current password</span>
          <input v-model="passwordForm.currentPassword" type="password" autocomplete="current-password" />
        </label>

        <label>
          <span>New password</span>
          <input v-model="passwordForm.newPassword" type="password" autocomplete="new-password" />
        </label>

        <button type="submit" class="refresh-button">Update password</button>
      </form>

      <p v-if="passwordMessage" class="info-copy">{{ passwordMessage }}</p>
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
          v-if="isAdmin"
          type="button"
          class="tab-button"
          :class="{ 'tab-button--active': activeTab === 'stations' }"
          @click="activeTab = 'stations'"
        >
          Stations
        </button>
        <button
          v-if="isAdmin"
          type="button"
          class="tab-button"
          :class="{ 'tab-button--active': activeTab === 'users' }"
          @click="activeTab = 'users'"
        >
          Users
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

      <div v-else-if="activeTab === 'stations'" class="data-grid">
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

      <div v-else class="users-layout">
        <form class="user-form" @submit.prevent="handleCreateUser">
          <h2>Add station user</h2>

          <label>
            <span>Username</span>
            <input v-model="createUserForm.username" type="text" required />
          </label>

          <label>
            <span>Name</span>
            <input v-model="createUserForm.name" type="text" required />
          </label>

          <label>
            <span>Password</span>
            <input v-model="createUserForm.password" type="text" placeholder="Can be blank" />
          </label>

          <label>
            <span>Station</span>
            <select v-model="createUserForm.stationId" required>
              <option disabled value="">Select station</option>
              <option v-for="station in stations" :key="station.id" :value="station.id">
                {{ station.name }} (/{{ station.slug }})
              </option>
            </select>
          </label>

          <button type="submit" class="refresh-button">Create user</button>
        </form>

        <div class="data-grid">
          <article v-for="user in users" :key="user.id" class="data-card">
            <div class="data-card__top">
              <div>
                <strong>{{ user.name }}</strong>
                <p>{{ user.username }}</p>
              </div>
              <span class="status-chip" :class="`status-chip--${user.role === 'super_admin' ? 'active' : 'pending'}`">
                {{ user.role }}
              </span>
            </div>

            <div class="data-card__meta">
              <span>{{ user.stationName ? `${user.stationName} (/${user.stationSlug})` : 'No station assigned' }}</span>
              <span>{{ formatDate(user.createdAt) }}</span>
            </div>

            <button
              v-if="user.role !== 'super_admin'"
              type="button"
              class="action-btn"
              @click="handleResetUserPassword(user)"
            >
              Reset password
            </button>

            <button
              v-if="user.role !== 'super_admin'"
              type="button"
              class="action-btn"
              @click="handleDeleteUser(user.id)"
            >
              Remove user
            </button>
          </article>
        </div>
      </div>
    </section>
    </template>
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

.login-panel {
  display: grid;
  gap: 18px;
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

.logout-button {
  padding: 0.85rem 1.1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  color: var(--ink-strong);
  cursor: pointer;
}

.hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.login-form,
.user-form,
.password-form {
  display: grid;
  gap: 12px;
}

.login-form label,
.user-form label,
.password-form label {
  display: grid;
  gap: 6px;
}

.login-form input,
.user-form input,
.user-form select,
.password-form input {
  padding: 0.85rem 1rem;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
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
  /* border-radius: 18px; */
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

.users-layout {
  display: grid;
  gap: 16px;
}

.empty-copy,
.error-panel span,
.error-copy,
.info-copy {
  color: var(--ink-soft);
}

.password-panel {
  display: grid;
  gap: 16px;
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

  .users-layout {
    grid-template-columns: 320px minmax(0, 1fr);
    align-items: start;
  }
}
</style>
