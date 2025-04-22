import { createApp } from 'vue';
import { createPinia } from 'pinia'; // Import Pinia
import router from './router'; // Import the router instance

import App from './App.vue';
import './style.css'; // Import Tailwind styles

// Create the Pinia instance
const pinia = createPinia();

// Create the Vue app instance
const app = createApp(App);

// Use Pinia and Vue Router
app.use(pinia);
app.use(router);

// Mount the app
app.mount('#app');
