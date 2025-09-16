import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  // Check if user is authenticated
  if (!locals.user) {
    throw error(401, 'Authentication required');
  }

  // Check if user has admin role
  if (locals.user.role !== 'admin') {
    throw error(403, 'Доступ запрещен. Требуются права администратора.');
  }

  return {
    user: locals.user
  };
};