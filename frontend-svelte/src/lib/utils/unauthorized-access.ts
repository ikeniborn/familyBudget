import { toast } from '$lib/stores/toast.store';
import { goto } from '$app/navigation';

/**
 * Handle unauthorized access attempts by non-admin users
 * @param feature - Name of the feature being accessed
 * @param redirectTo - Where to redirect the user (default: '/dashboard')
 */
export function handleUnauthorizedAccess(
  feature: string = 'эта функция',
  redirectTo: string = '/dashboard'
): void {
  toast.error(`Доступ к ${feature} доступен только администраторам`);

  // Log the unauthorized access attempt
  console.warn(`Unauthorized access attempt to: ${feature}`);

  // Redirect to safe page
  setTimeout(() => {
    goto(redirectTo);
  }, 2000);
}