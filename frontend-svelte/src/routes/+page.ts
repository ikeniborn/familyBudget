import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { browser } from '$app/environment';
import { authService } from '$lib/services/auth.service';

export const load: PageLoad = async () => {
  // В браузере проверяем авторизацию
  if (browser) {
    const isAuthenticated = authService.isAuthenticated();
    
    if (isAuthenticated) {
      throw redirect(302, '/dashboard');
    } else {
      throw redirect(302, '/login');
    }
  }
  
  // На сервере всегда редиректим на login
  throw redirect(302, '/login');
};