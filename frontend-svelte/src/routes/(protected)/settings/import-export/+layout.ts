import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent }) => {
  // Wait for parent layout data
  const data = await parent();
  
  // Check if user is authenticated and is admin (id === 1)
  if (!data?.authenticated || !data?.user || data.user.id !== 1) {
    throw redirect(302, '/settings?error=access_denied&message=' + encodeURIComponent('Доступ запрещен. Требуются права администратора.'));
  }
  
  return {};
};

export const ssr = true;
export const prerender = false;