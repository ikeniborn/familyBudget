<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Shield, ArrowLeft, Home } from 'lucide-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  // Auto-redirect after 10 seconds
  onMount(() => {
    const timeout = setTimeout(() => {
      goto('/dashboard');
    }, 10000);

    return () => clearTimeout(timeout);
  });

  function goBack() {
    window.history.back();
  }

  function goToDashboard() {
    goto('/dashboard');
  }
</script>

<svelte:head>
  <title>Access Denied - Family Budget</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <Card>
      <div class="text-center p-8">
        <!-- Icon -->
        <div class="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-6">
          <Shield class="h-12 w-12 text-red-600" />
        </div>

        <!-- Heading -->
        <h1 class="text-3xl font-bold text-gray-900 mb-2">
          Access Denied
        </h1>

        <h2 class="text-lg font-medium text-gray-700 mb-4">
          Administrator Access Required
        </h2>

        <!-- Description -->
        <div class="text-gray-600 mb-8 space-y-3">
          <p>
            This page requires administrator privileges to access reference data management features.
          </p>
          <p class="text-sm">
            Reference data (periods, financial centers, cost centers, and nomenclatures) can only be managed by system administrators to ensure data integrity and consistency across all users.
          </p>
        </div>

        <!-- Actions -->
        <div class="space-y-3">
          <Button
            variant="primary"
            class="w-full"
            on:click={goToDashboard}
          >
            <Home class="w-4 h-4 mr-2" />
            Go to Dashboard
          </Button>

          <Button
            variant="secondary"
            class="w-full"
            on:click={goBack}
          >
            <ArrowLeft class="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>

        <!-- Auto-redirect notice -->
        <p class="text-xs text-gray-500 mt-6">
          You will be automatically redirected to the dashboard in 10 seconds.
        </p>
      </div>
    </Card>

    <!-- Additional help -->
    <Card>
      <div class="p-6">
        <h3 class="text-sm font-medium text-gray-900 mb-3">
          Need Administrator Access?
        </h3>
        <div class="text-sm text-gray-600 space-y-2">
          <p>
            If you believe you should have administrator access, please contact your system administrator or:
          </p>
          <ul class="list-disc list-inside space-y-1 pl-4">
            <li>Check your user role settings</li>
            <li>Verify your account permissions</li>
            <li>Contact support if this is an error</li>
          </ul>
        </div>
      </div>
    </Card>
  </div>
</div>

<style>
  :global(body) {
    background-color: #f9fafb;
  }
</style>