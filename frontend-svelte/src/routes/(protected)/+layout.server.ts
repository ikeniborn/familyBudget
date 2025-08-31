import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies, url, fetch }) => {
  // Check for session cookie (try both possible cookie names)
  const connectSid = cookies.get('connect.sid');
  const familyBudgetSid = cookies.get('familybudget.sid');
  const sessionId = connectSid || familyBudgetSid;
  
  // If no session cookie exists, redirect to login with returnUrl
  if (!sessionId) {
    throw redirect(303, `/login?returnUrl=${encodeURIComponent(url.pathname + url.search)}`);
  }
  
  // Verify session is valid on the server
  try {
    // Determine correct backend URL for SSR context
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.BACKEND_URL || 'http://backend:4000')
      : 'http://localhost:4000'; // В development режиме обращаемся напрямую
    
    // Build cookie header with the correct name and format
    const cookieName = connectSid ? 'connect.sid' : 'familybudget.sid';
    const cookieHeader = `${cookieName}=${sessionId}`;
    
    const response = await fetch(`${backendUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      // Don't use credentials: 'include' in SSR, use explicit Cookie header
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw redirect(303, `/login?returnUrl=${encodeURIComponent(url.pathname + url.search)}`);
      } else {
        // For other errors, also redirect but log the issue
        console.error('Unexpected auth response status:', response.status);
        throw redirect(303, `/login?returnUrl=${encodeURIComponent(url.pathname + url.search)}`);
      }
    }
    
    const data = await response.json();
    
    // Check if user data exists in the expected format
    if (!data || !data.user) {
      throw redirect(303, `/login?returnUrl=${encodeURIComponent(url.pathname + url.search)}`);
    }
    
    // Return user data for client-side use
    return {
      authenticated: true,
      user: data.user
    };
  } catch (error) {
    // If any error occurs (including redirects), rethrow if it's a redirect
    if (error instanceof Response && [301, 302, 303, 307, 308].includes(error.status)) {
      throw error;
    }
    
    // For fetch errors and other issues, log and redirect to login
    console.error('SSR Auth error:', error);
    throw redirect(303, `/login?returnUrl=${encodeURIComponent(url.pathname + url.search)}`);
  }
};