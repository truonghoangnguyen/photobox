<template>
  <div class="dashboard-shell">
    <section class="panel dashboard-panel">
      <p class="eyebrow">Operator / Admin</p>
      <h1>Dashboard scaffold is ready for the next step.</h1>
      <p>
        The next implementation pass will plug this page into Worker auth, station-scoped job lists, and admin station management.
      </p>
    </section>
  </div>
</template>

<style scoped>
.dashboard-shell {
  width: min(100vw - 16px, 1100px);
  margin: 0 auto;
  padding: 16px 0 28px;
}

.dashboard-panel {
  padding: 20px;
}

.dashboard-panel h1 {
  margin: 6px 0 10px;
  font-size: clamp(2rem, 8vw, 3.5rem);
  line-height: 0.96;
}

.dashboard-panel p:last-child {
  margin: 0;
  color: var(--ink-soft);
  max-width: 60ch;
}
</style>
