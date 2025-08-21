<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.store';

  export let botName: string;
  export let buttonSize: 'large' | 'medium' | 'small' = 'large';
  export let cornerRadius: number | undefined = undefined;
  export let showAvatar: boolean = true;
  export let dataAuthUrl: string | undefined = undefined;

  let containerRef: HTMLDivElement;
  let scriptElement: HTMLScriptElement | null = null;

  async function handleTelegramAuth(user: any) {
    try {
      await authStore.login(user);
      goto('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
    }
  }

  onMount(() => {
    // Define global callback function
    (window as any).onTelegramAuth = handleTelegramAuth;

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', buttonSize);
    
    if (cornerRadius !== undefined) {
      script.setAttribute('data-radius', cornerRadius.toString());
    }
    
    if (dataAuthUrl) {
      script.setAttribute('data-auth-url', dataAuthUrl);
    } else {
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    }
    
    script.setAttribute('data-request-access', 'write');
    
    if (!showAvatar) {
      script.setAttribute('data-userpic', 'false');
    }

    // Append script to container
    if (containerRef) {
      containerRef.appendChild(script);
      scriptElement = script;
    }
  });

  onDestroy(() => {
    // Cleanup
    if (scriptElement && scriptElement.parentNode) {
      scriptElement.parentNode.removeChild(scriptElement);
    }
    
    // Remove global callback
    if (typeof window !== 'undefined') {
      delete (window as any).onTelegramAuth;
    }
  });
</script>

<div bind:this={containerRef} class="telegram-login-button"></div>