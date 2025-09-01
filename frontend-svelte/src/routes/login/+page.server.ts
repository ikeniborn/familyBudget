import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, url, fetch }) => {
  // Check for session cookie (try both possible cookie names)
  const connectSid = cookies.get('connect.sid');
  const familyBudgetSid = cookies.get('familybudget.sid');
  const sessionId = connectSid || familyBudgetSid;
  
  // If session exists, verify it's valid
  if (sessionId) {
    try {
      // Build cookie header with the correct name
      const cookieName = connectSid ? 'connect.sid' : 'familybudget.sid';
      const cookieHeader = `${cookieName}=${sessionId}`;
      
      // Use backend hostname for SSR
      const backendUrl = process.env.BACKEND_URL || 'http://backend:4000';
      const response = await fetch(`${backendUrl}/api/auth/me`, {
        credentials: 'include',
        headers: {
          'Cookie': cookieHeader
        }
      });
      
      // If session is valid, redirect to dashboard or returnUrl
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          const returnUrl = url.searchParams.get('returnUrl') || '/dashboard';
          throw redirect(303, returnUrl);
        }
      }
    } catch (error) {
      // If it's a redirect, rethrow it
      if (error instanceof Response) {
        throw error;
      }
      // Otherwise, continue to login page
    }
  }
  
  // Return empty object, allow login page to render
  return {};
};