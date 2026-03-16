import { createRouter, createWebHistory } from 'vue-router'
import DashboardPage from './pages/DashboardPage.vue'
import HomePage from './pages/HomePage.vue'
import StationPage from './pages/StationPage.vue'
import InvoicePage from './pages/InvoicePage.vue'
import CartPage from './pages/CartPage.vue'

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
      path: '/cart',
      name: 'cart',
      component: CartPage,
    },
    {
      path: '/:stationSlug',
      name: 'station',
      component: StationPage,
      props: true,
    },
    {
      path: '/invoice',
      name: 'invoice',
      component: InvoicePage,
    },
  ],
})

export default router
