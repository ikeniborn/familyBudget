<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { X, Download, Smartphone } from 'lucide-svelte';

  let showInstallPrompt = false;
  let deferredPrompt: any = null;
  let isIOS = false;
  let isStandalone = false;

  onMount(() => {
    if (!browser) return;

    // Check if already installed
    isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                   (window.navigator as any).standalone ||
                   document.referrer.includes('android-app://');

    // Check if iOS
    isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      
      // Check if user hasn't dismissed the prompt recently
      const lastDismissed = localStorage.getItem('pwa-install-dismissed');
      const now = Date.now();
      const dismissedTime = lastDismissed ? parseInt(lastDismissed) : 0;
      const daysSinceDismiss = (now - dismissedTime) / (1000 * 60 * 60 * 24);
      
      if (!isStandalone && daysSinceDismiss > 7) {
        showInstallPrompt = true;
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, show manual install instructions
    if (isIOS && !isStandalone) {
      const iosPromptShown = localStorage.getItem('ios-install-prompt-shown');
      if (!iosPromptShown) {
        setTimeout(() => {
          showInstallPrompt = true;
        }, 3000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  });

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA installation accepted');
      } else {
        console.log('PWA installation dismissed');
      }
      
      deferredPrompt = null;
      showInstallPrompt = false;
    }
  };

  const dismissPrompt = () => {
    showInstallPrompt = false;
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    
    if (isIOS) {
      localStorage.setItem('ios-install-prompt-shown', 'true');
    }
  };
</script>

{#if showInstallPrompt && !isStandalone}
  <div class="fixed inset-x-0 bottom-0 z-50 p-4 bg-gradient-to-t from-black/50 to-transparent">
    <Card class="mx-auto max-w-sm border-0 bg-white shadow-2xl">
      <div class="p-4">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 p-2 bg-blue-100 rounded-full">
            {#if isIOS}
              <Smartphone class="w-5 h-5 text-blue-600" />
            {:else}
              <Download class="w-5 h-5 text-blue-600" />
            {/if}
          </div>
          
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-gray-900">
              Установить приложение
            </h3>
            
            {#if isIOS}
              <p class="mt-1 text-xs text-gray-600">
                Нажмите кнопку "Поделиться" <span class="inline-block">📤</span> в Safari, 
                затем "Добавить на экран Домой"
              </p>
            {:else}
              <p class="mt-1 text-xs text-gray-600">
                Установите FamilyBudget для быстрого доступа и работы офлайн
              </p>
            {/if}
            
            <div class="flex gap-2 mt-3">
              {#if !isIOS}
                <Button 
                  size="sm" 
                  class="text-xs px-3 py-1"
                  on:click={handleInstallClick}
                >
                  Установить
                </Button>
              {/if}
              
              <Button 
                variant="ghost" 
                size="sm" 
                class="text-xs px-3 py-1"
                on:click={dismissPrompt}
              >
                Позже
              </Button>
            </div>
          </div>
          
          <button
            type="button"
            class="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
            on:click={dismissPrompt}
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  </div>
{/if}

<style>
  /* Hide install prompt on larger screens where PWA isn't as relevant */
  @media (min-width: 1024px) {
    div {
      display: none;
    }
  }
</style>