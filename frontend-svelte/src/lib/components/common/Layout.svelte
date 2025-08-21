<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { currentUser, authStore } from '$lib/stores/auth.store';
  import NotificationDropdown from './NotificationDropdown.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { clsx } from 'clsx';
  import { 
    Menu, 
    X, 
    Home, 
    Calculator, 
    CreditCard, 
    BarChart3, 
    Package,
    LogOut,
    User,
    ClipboardList,
    Settings,
    Database
  } from 'lucide-svelte';

  let sidebarOpen = false;

  interface NavItem {
    name: string;
    path: string;
    icon: any;
  }

  const navItems: NavItem[] = [
    { name: 'Главная', path: '/dashboard', icon: Home },
    { name: 'Факт', path: '/fact', icon: CreditCard },
    { name: 'Бюджет', path: '/budget', icon: Calculator },
    { name: 'Отчеты', path: '/reports', icon: BarChart3 },
    { name: 'Продукты', path: '/products', icon: Package },
    { name: 'Справочники', path: '/reference', icon: Database },
  ];

  async function handleLogout() {
    await authStore.logout();
    goto('/login');
  }

  function handleNavigation(path: string) {
    sidebarOpen = false;
    if ($page.url.pathname !== path) {
      goto(path);
    }
  }

  function closeSidebar() {
    sidebarOpen = false;
  }

  // Close sidebar when route changes
  $: $page && (sidebarOpen = false);

  // Get current page name
  $: currentPageName = (() => {
    const pathname = $page.url.pathname;
    
    // Check for exact matches first
    const exactMatch = navItems.find(item => item.path === pathname);
    if (exactMatch) return exactMatch.name;
    
    // Check for prefix matches
    if (pathname.startsWith('/settings')) return 'Настройки';
    if (pathname.startsWith('/reference')) {
      if (pathname === '/reference') return 'Справочники';
      if (pathname.includes('/periods')) return 'Управление периодами';
      if (pathname.includes('/financial-centers')) return 'Управление ЦФО';
      if (pathname.includes('/cost-centers')) return 'Управление МВЗ';
      if (pathname.includes('/nomenclatures')) return 'Управление номенклатурами';
      return 'Справочники';
    }
    
    return 'Страница';
  })();
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
  <!-- Mobile sidebar backdrop -->
  {#if sidebarOpen}
    <div
      class="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
      on:click={closeSidebar}
      on:keydown={(e) => e.key === 'Escape' && closeSidebar()}
      role="button"
      tabindex="-1"
    />
  {/if}

  <!-- Sidebar -->
  <Card
    class={clsx(
      'fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 border-r-2 rounded-none flex-shrink-0',
      sidebarOpen ? 'translate-x-0' : '-translate-x-full'
    )}
  >
    <div class="flex h-full flex-col">
      <!-- Logo -->
      <div class="flex h-16 items-center justify-between px-6 border-b bg-gradient-to-r from-blue-600 to-purple-600">
        <h1 class="text-xl font-bold text-white">💰 FamilyBudget</h1>
        <Button
          variant="ghost"
          size="icon"
          on:click={closeSidebar}
          class="lg:hidden text-white hover:bg-white/20"
        >
          <X class="h-5 w-5" />
        </Button>
      </div>

      <!-- Navigation -->
      <div class="flex-1 p-4">
        <nav class="space-y-2">
          {#each navItems as item (item.path)}
            {@const Icon = item.icon}
            {@const isActive = $page.url.pathname === item.path || 
              (item.path === '/settings' && $page.url.pathname.startsWith('/settings')) ||
              (item.path === '/reference' && $page.url.pathname.startsWith('/reference'))}
            
            <Button
              variant={isActive ? "default" : "ghost"}
              class={clsx(
                'w-full justify-start h-12 text-left font-medium',
                isActive
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
              on:click={() => handleNavigation(item.path)}
            >
              <Icon class="mr-3 h-5 w-5" />
              {item.name}
            </Button>
          {/each}
        </nav>
      </div>

      <!-- User info -->
      <div class="border-t bg-slate-50/50 p-4">
        <Card class="p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="flex-shrink-0">
                <div class="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                  <User class="h-5 w-5 text-white" />
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-slate-700 truncate">
                  {$currentUser?.first_name || $currentUser?.username || 'Пользователь'}
                </p>
                <p class="text-xs text-slate-500">ID: {$currentUser?.user_id}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              on:click={handleLogout}
              class="text-slate-400 hover:text-red-500"
              title="Выйти"
            >
              <LogOut class="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  </Card>

  <!-- Main content -->
  <div class="flex-1 flex flex-col w-full">
    <!-- Top bar -->
    <Card class="sticky top-0 z-10 rounded-none border-b-2 shadow-sm">
      <div class="flex h-16 items-center p-4">
        <Button
          variant="ghost"
          size="icon"
          on:click={() => sidebarOpen = true}
          class="mr-2 lg:hidden"
        >
          <Menu class="h-6 w-6" />
        </Button>
        
        <div class="flex flex-1 items-center justify-between">
          <div>
            <h2 class="text-xl font-semibold text-slate-800">
              {currentPageName}
            </h2>
            <p class="text-sm text-slate-500">
              Управление семейным бюджетом
            </p>
          </div>
          
          <div class="flex items-center space-x-2">
            <NotificationDropdown />
            <Button 
              variant="ghost" 
              size="icon"
              on:click={() => goto('/form-validation')}
              title="Валидация форм"
            >
              <ClipboardList class="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              on:click={() => goto('/settings')}
              title="Настройки"
            >
              <Settings class="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <!-- Page content -->
    <main class="flex-1">
      <div class="p-6">
        <div class="mx-auto max-w-7xl">
          <slot />
        </div>
      </div>
    </main>
  </div>
</div>