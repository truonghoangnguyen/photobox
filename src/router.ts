import { createRouter, createWebHistory } from 'vue-router'
import DashboardPage from './pages/DashboardPage.vue'
import HomePage from './pages/HomePage.vue'
import StationPage from './pages/StationPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardPage,
    },
    {
      path: '/:stationSlug',
      name: 'station',
      component: StationPage,
      props: true,
    },
  ],
})

export default router
