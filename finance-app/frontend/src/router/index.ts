import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

// Import components for routes (we will create these later)
// Example: import HomeView from '../views/HomeView.vue';
// Example: import LoginView from '../views/LoginView.vue';

const routes: Array<RouteRecordRaw> = [
  // Define routes here later based on the plan:
  // { path: '/', name: 'Dashboard', component: DashboardView },
  // { path: '/login', name: 'Login', component: LoginView },
  // { path: '/register', name: 'Register', component: RegisterView },
  // { path: '/budgets', name: 'Budgets', component: BudgetView },
  // { path: '/transactions', name: 'Transactions', component: TransactionView },
  // { path: '/reports', name: 'Reports', component: ReportView },
  // { path: '/settings', name: 'Settings', component: SettingsView },
  // { path: '/telegram-auth', name: 'TelegramAuth', component: TelegramAuthCallbackView },

  // Placeholder route for now
  {
    path: '/',
    name: 'Home',
    // Example using a simple inline component for now
    component: { template: '<div class="p-4"><h1>Welcome Home</h1><router-link to="/about">About</router-link></div>' }
  },
  {
    path: '/about',
    name: 'About',
    // Example using lazy loading
    component: () => import('../views/AboutView.vue') // We'll create this view later
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL), // Use history mode
  routes,
});

// Navigation Guards (Placeholder - implement auth checks later)
router.beforeEach((to, from, next) => {
  // const isAuthenticated = /* Check auth status from Pinia store */;
  // if (to.meta.requiresAuth && !isAuthenticated) {
  //   next({ name: 'Login' });
  // } else {
  //   next();
  // }
  console.log(`Navigating from ${from.fullPath} to ${to.fullPath}`);
  next(); // Allow navigation for now
});

export default router;