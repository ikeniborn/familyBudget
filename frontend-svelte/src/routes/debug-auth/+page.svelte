<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore, isAdmin, currentUser } from '$lib/stores/auth.store';
  import { browser } from '$app/environment';

  let debugInfo: any = {};
  let storageContent: any = null;

  onMount(() => {
    updateDebugInfo();
    
    // Auto-refresh every 2 seconds to show real-time changes
    const interval = setInterval(updateDebugInfo, 2000);
    return () => clearInterval(interval);
  });

  function updateDebugInfo() {
    if (browser) {
      // Get current auth state
      const state = authStore.getDebugState();
      
      // Get localStorage content
      const stored = localStorage.getItem('auth-storage');
      storageContent = stored ? JSON.parse(stored) : null;
      
      debugInfo = {
        authState: state,
        storageContent: storageContent,
        timestamp: new Date().toISOString()
      };
    }
  }

  async function clearAndRefresh() {
    await authStore.debugRefreshAuth();
    updateDebugInfo();
  }

  function forceCorruptRole() {
    if (browser && storageContent) {
      const corrupted = { ...storageContent };
      if (corrupted.state?.user) {
        delete corrupted.state.user.role;
        localStorage.setItem('auth-storage', JSON.stringify(corrupted));
        console.log('🧪 Role corrupted in localStorage');
        updateDebugInfo();
      }
    }
  }
</script>

<div class="p-6 max-w-4xl mx-auto">
  <h1 class="text-2xl font-bold mb-6">Auth Store Debug Page</h1>
  
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Current Auth State -->
    <div class="bg-white p-4 rounded-lg shadow">
      <h2 class="text-lg font-semibold mb-3">Current Auth State</h2>
      <div class="space-y-2 text-sm">
        <div><strong>Is Authenticated:</strong> {$currentUser ? 'Yes' : 'No'}</div>
        <div><strong>Is Admin:</strong> {$isAdmin ? 'Yes' : 'No'}</div>
        <div><strong>User ID:</strong> {$currentUser?.id || 'None'}</div>
        <div><strong>User Name:</strong> {$currentUser?.user_name || 'None'}</div>
        <div><strong>Role:</strong> {$currentUser?.role || 'None'}</div>
        <div><strong>Role Type:</strong> {typeof $currentUser?.role}</div>
      </div>
    </div>

    <!-- LocalStorage Content -->
    <div class="bg-white p-4 rounded-lg shadow">
      <h2 class="text-lg font-semibold mb-3">LocalStorage Content</h2>
      {#if storageContent}
        <div class="space-y-2 text-sm">
          <div><strong>User Role:</strong> {storageContent.state?.user?.role || 'None'}</div>
          <div><strong>User ID:</strong> {storageContent.state?.user?.id || 'None'}</div>
          <div><strong>Is Authenticated:</strong> {storageContent.state?.isAuthenticated ? 'Yes' : 'No'}</div>
          <div><strong>Version:</strong> {storageContent.version}</div>
        </div>
      {:else}
        <p class="text-gray-500">No auth data in localStorage</p>
      {/if}
    </div>

    <!-- Full Debug Info -->
    <div class="col-span-full bg-gray-50 p-4 rounded-lg">
      <h2 class="text-lg font-semibold mb-3">Full Debug Info</h2>
      <pre class="text-xs overflow-auto max-h-64 bg-white p-2 rounded border">
{JSON.stringify(debugInfo, null, 2)}
      </pre>
    </div>

    <!-- Actions -->
    <div class="col-span-full bg-white p-4 rounded-lg shadow">
      <h2 class="text-lg font-semibold mb-3">Debug Actions</h2>
      <div class="space-x-4">
        <button 
          on:click={updateDebugInfo}
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh Debug Info
        </button>
        <button 
          on:click={clearAndRefresh}
          class="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Clear Storage & Refresh Auth
        </button>
        <button 
          on:click={forceCorruptRole}
          class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Corrupt Role (Test)
        </button>
      </div>
    </div>
  </div>
</div>