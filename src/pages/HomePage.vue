<script setup lang="ts">
import { RouterLink } from 'vue-router'

const starterStations = ['tram1', 'tram2', 'tram3']
</script>

<template>
  <div class="home-shell">
    <section class="home-hero panel">
      <p class="eyebrow">Cloudflare-ready print network</p>
      <h1>Start from a station URL and let the app resolve the printer automatically.</h1>
      <p class="home-copy">
        This frontend now understands dynamic station routes like <code>/tram1</code> and is ready to connect to the Worker API for station lookup, uploads, and print jobs.
      </p>
    </section>

    <section class="panel home-panel">
      <div class="panel-heading">
        <div>
          <p class="panel-kicker">Sample Stations</p>
          <h2>Open a station flow</h2>
        </div>
        <p class="panel-note">These are starter routes for local development before D1 gets seeded with real stations.</p>
      </div>

      <div class="home-links">
        <RouterLink v-for="slug in starterStations" :key="slug" :to="`/${slug}`" class="home-link">
          <strong>/{{ slug }}</strong>
          <span>Open the customer printing page for {{ slug }}</span>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-shell {
  width: min(100vw - 16px, 1100px);
  margin: 0 auto;
  padding: 16px 0 28px;
  display: grid;
  gap: 14px;
}

.home-hero,
.home-panel {
  padding: 20px;
}

.home-hero h1 {
  margin: 6px 0 10px;
  font-size: clamp(2.1rem, 9vw, 4rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
}

.home-copy {
  margin: 0;
  color: var(--ink-soft);
  max-width: 60ch;
}

.home-links {
  display: grid;
  gap: 12px;
}

.home-link {
  display: grid;
  gap: 6px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.64);
}

.home-link strong {
  font-size: 1.05rem;
}

.home-link span {
  color: var(--ink-soft);
}

@media (min-width: 760px) {
  .home-shell {
    width: min(100vw - 24px, 1100px);
    padding-top: 24px;
  }

  .home-links {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
