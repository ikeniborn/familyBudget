<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentUser, authStore } from '$lib/stores/auth.store';
  import { deviceStore } from '$lib/stores/device.store';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import NotificationDropdown from '$lib/components/common/NotificationDropdown.svelte';
  import { clsx } from 'clsx';
  import { 
    Home, 
    Calculator, 
    CreditCard, 
    BarChart3, 
    Package,
    Menu,
    Bell,
    User,
    LogOut,
    Database,
    ChevronLeft
  } from 'lucide-svelte';

  let mobileMenuOpen = false;
  $: showBackButton = $page.url.pathname !== '/dashboard';

  // Mobile navigation items
  const bottomNavItems = [
    { name: 'Главная', path: '/dashboard', icon: Home },
    { name: 'Факт', path: '/fact', icon: CreditCard },
    { name: 'Бюджет', path: '/budget', icon: Calculator },
    { name: 'Отчеты', path: '/reports', icon: BarChart3 },
    { name: 'Еще', path: '#menu', icon: Menu }
  ];

  const menuItems = [
    { name: 'Продукты', path: '/products', icon: Package },
    { name: 'Справочники', path: '/reference', icon: Database },
  ];

  function handleNavigation(path: string) {
    if (path === '#menu') {
      mobileMenuOpen = !mobileMenuOpen;
    } else {
      mobileMenuOpen = false;
      goto(path);
    }
  }

  function goBack() {
    history.back();
  }

  async function handleLogout() {
    await authStore.logout();
    goto('/login');
  }

  // Get current page title
  $: pageTitle = (() => {
    const pathname = $page.url.pathname;
    
    const item = bottomNavItems.find(item => item.path === pathname) ||
                menuItems.find(item => item.path === pathname);
    
    if (item) return item.name;
    
    if (pathname.startsWith('/settings')) return 'Настройки';
    if (pathname.startsWith('/reference')) {
      if (pathname === '/reference') return 'Справочники';
      if (pathname.includes('/periods')) return 'Периоды';
      if (pathname.includes('/financial-centers')) return 'ЦФО';
      if (pathname.includes('/cost-centers')) return 'МВЗ';
      if (pathname.includes('/nomenclatures')) return 'Номенклатуры';
    }
    
    return 'Family Budget';
  })();

  // Handle swipe gestures for navigation
  let touchStartX = 0;
  let touchEndX = 0;

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.changedTouches[0].screenX;
  }

  function handleTouchEnd(e: TouchEvent) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipeGesture();
  }

  function handleSwipeGesture() {
    const swipeDistance = touchEndX - touchStartX;
    const minSwipeDistance = 50;

    if (Math.abs(swipeDistance) < minSwipeDistance) return;

    // Swipe right to go back
    if (swipeDistance > 0 && showBackButton) {
      goBack();
    }
  }
</script>

<div class="flex flex-col h-screen bg-background overflow-hidden">
  <!-- Mobile Header -->
  <Card variant="steel" class="sticky top-0 z-20 rounded-none border-b shadow-sm">
    <div class="flex items-center justify-between p-4 h-14">
      <div class="flex items-center gap-3 flex-1">
        {#if showBackButton}
          <Button
            variant="ghost"
            size="icon"
            onclick={goBack}
            class="text-primary"
          >
            <ChevronLeft class="h-6 w-6" />
          </Button>
        {/if}
        
        <h1 class="text-lg font-semibold text-foreground truncate">
          {pageTitle}
        </h1>
      </div>

      <div class="flex items-center gap-2">
        <NotificationDropdown />

        <Button
          variant="ghost"
          size="icon"
          onclick={() => goto('/profile')}
        >
          <User class="h-5 w-5" />
        </Button>
      </div>
    </div>
  </Card>

  <!-- Main Content Area -->
  <main 
    class="flex-1 overflow-y-auto pb-16"
    ontouchstart={handleTouchStart}
    ontouchend={handleTouchEnd}
  >
    <div class="p-4">
      <slot />
    </div>
  </main>

  <!-- Mobile Menu Overlay -->
  {#if mobileMenuOpen}
    <div
      class="fixed inset-0 bg-black/50 z-30"
      onclick={() => mobileMenuOpen = false}
    >
      <div
        class="absolute bottom-16 left-0 right-0 bg-background rounded-t-2xl shadow-xl"
        onclick={(e) => e.stopPropagation()}
      >
        <div class="p-4 space-y-2">
          <div class="h-1 w-12 bg-muted rounded-full mx-auto mb-4"></div>
          
          {#each menuItems as item}
            {@const Icon = item.icon}
            <button
              class="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-muted transition-colors"
              onclick={() => handleNavigation(item.path)}
            >
              <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon class="h-5 w-5 text-primary" />
              </div>
              <span class="text-base font-medium">{item.name}</span>
            </button>
          {/each}

          <div class="border-t pt-2 mt-4">
            <Card variant="beige" class="p-3 mb-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <User class="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p class="text-sm font-semibold">
                      {$currentUser?.first_name || $currentUser?.username}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      ID: {$currentUser?.user_id}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <button
              class="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
              onclick={handleLogout}
            >
              <LogOut class="h-5 w-5" />
              <span class="text-base font-medium">Выйти</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Bottom Navigation -->
  <Card variant="navy" class="fixed bottom-0 left-0 right-0 z-20 rounded-none border-t">
    <nav class="flex justify-around items-center h-16 px-2">
      {#each bottomNavItems as item}
        {@const Icon = item.icon}
        {@const isActive = $page.url.pathname === item.path}
        {@const isMenu = item.path === '#menu'}
        
        <button
          class={clsx(
            'flex flex-col items-center justify-center flex-1 h-full py-2 transition-colors',
            isActive && !isMenu && 'text-primary',
            !isActive && !isMenu && 'text-muted-foreground',
            isMenu && mobileMenuOpen && 'text-primary',
            isMenu && !mobileMenuOpen && 'text-muted-foreground'
          )}
          onclick={() => handleNavigation(item.path)}
        >
          <div class="relative">
            <Icon class="h-5 w-5" />
            {#if isActive && !isMenu}
              <div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary rounded-full"></div>
            {/if}
          </div>
          <span class="text-xs mt-1">{item.name}</span>
        </button>
      {/each}
    </nav>
  </Card>
</div>

<style>
  /* Mobile-optimized styles */
  :global(.touch-device) {
    /* Larger tap targets for touch devices */
    --min-tap-size: 44px;
  }

  :global(.touch-device button) {
    min-height: var(--min-tap-size);
    min-width: var(--min-tap-size);
  }

  /* Smooth scrolling for mobile */
  main {
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }

  /* Prevent text selection on navigation */
  nav button {
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  /* iOS safe area handling */
  @supports (padding-bottom: env(safe-area-inset-bottom)) {
    .fixed.bottom-0 {
      padding-bottom: env(safe-area-inset-bottom);
    }
  }
</style>