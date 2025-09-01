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

<div class="min-h-screen bg-background flex relative overflow-hidden">
  <!-- Mobile sidebar backdrop -->
  {#if sidebarOpen}
    <div
      class="fixed inset-0 z-30 bg-primary/60 backdrop-blur-md lg:hidden transition-opacity duration-300"
      onclick={closeSidebar}
      onkeydown={(e) => e.key === 'Escape' && closeSidebar()}
      role="button"
      tabindex="-1"
      aria-label="Закрыть меню навигации"
    ></div>
  {/if}

  <!-- Sidebar -->
  <Card
    variant="navy"
    class={clsx(
      'fixed inset-y-0 left-0 z-40 w-72 sm:w-64 transform transition-all duration-300 ease-out lg:relative lg:translate-x-0 border-r-2 rounded-none flex-shrink-0 shadow-2xl',
      sidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-90',
      'lg:opacity-100 lg:shadow-xl'
    )}
  >
    <div class="flex h-full flex-col">
      <!-- Logo with geometric elements -->
      <div class="flex h-16 items-center justify-between px-6 border-b bg-primary relative overflow-hidden">
        <!-- Geometric background elements -->
        <div class="absolute inset-0 opacity-10">
          <div class="geometric-circle absolute top-2 right-4 w-8 h-8"></div>
          <div class="geometric-triangle-up absolute bottom-2 left-8"></div>
          <div class="geometric-rectangle absolute top-3 left-24 w-12 h-3"></div>
        </div>
        
        <div class="flex items-center space-x-3 relative z-10">
          <div class="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
            <span class="text-sm font-bold text-accent-foreground">₽</span>
          </div>
          <h1 class="text-lg font-bold text-white tracking-tight">FamilyBudget</h1>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onclick={closeSidebar}
          class="lg:hidden text-white hover:bg-white/20 relative z-10"
        >
          <X class="h-5 w-5" />
        </Button>
      </div>

      <!-- Navigation -->
      <div class="flex-1 p-4">
        <nav class="space-y-1">
          {#each navItems as item (item.path)}
            {@const Icon = item.icon}
            {@const isActive = $page.url.pathname === item.path || 
              (item.path === '/settings' && $page.url.pathname.startsWith('/settings')) ||
              (item.path === '/reference' && $page.url.pathname.startsWith('/reference'))}
            
            <button
              class={clsx(
                'w-full flex items-center px-4 py-3 text-left font-medium rounded-lg transition-all duration-200 group relative overflow-hidden',
                isActive
                  ? 'bg-accent text-accent-foreground shadow-md font-semibold'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
              onclick={() => handleNavigation(item.path)}
            >
              <!-- Geometric accent for active state -->
              {#if isActive}
                <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r"></div>
              {/if}
              
              <div class={clsx(
                'flex items-center justify-center w-8 h-8 rounded-md mr-3 transition-colors',
                isActive
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground group-hover:text-foreground group-hover:bg-muted'
              )}>
                <Icon class="h-4 w-4" />
              </div>
              
              <span class="flex-1">{item.name}</span>
            </button>
          {/each}
        </nav>
      </div>

      <!-- User info -->
      <div class="border-t bg-surface-subtle p-4">
        <Card variant="beige" class="p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="flex-shrink-0">
                <div class="geometric-circle w-10 h-10 flex items-center justify-center">
                  <User class="h-5 w-5 text-white" />
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-foreground truncate">
                  {$currentUser?.first_name || $currentUser?.username || 'Пользователь'}
                </p>
                <p class="text-xs text-muted-foreground">ID: {$currentUser?.user_id}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onclick={handleLogout}
              class="text-muted-foreground hover:text-destructive transition-colors"
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
    <!-- Top bar with geometric header -->
    <Card variant="steel" class="sticky top-0 z-10 rounded-none border-b-2 shadow-lg relative overflow-hidden">
      <!-- Geometric background elements -->
      <div class="absolute inset-0 opacity-5">
        <div class="geometric-circle absolute top-2 right-20 w-12 h-12"></div>
        <div class="geometric-rectangle absolute top-4 right-4 w-8 h-8"></div>
        <div class="geometric-triangle-down absolute bottom-1 right-32"></div>
      </div>
      
      <div class="flex h-16 items-center p-4 relative z-10">
        <Button
          variant="ghost"
          size="icon"
          onclick={() => sidebarOpen = true}
          class="mr-3 lg:hidden text-primary hover:bg-primary/10 transition-all duration-200 hover:scale-105 active:scale-95"
          aria-label="Открыть меню навигации"
        >
          <Menu class="h-6 w-6" />
        </Button>
        
        <div class="flex flex-1 items-center justify-between">
          <div>
            <h2 class="text-xl font-bold text-foreground tracking-tight">
              {currentPageName}
            </h2>
            <p class="text-sm text-muted-foreground font-medium">
              Управление семейным бюджетом
            </p>
          </div>
          
          <div class="flex items-center space-x-1">
            <NotificationDropdown />
            <Button 
              variant="ghost" 
              size="icon"
              onclick={() => goto('/form-validation')}
              title="Валидация форм"
              class="text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <ClipboardList class="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              onclick={() => goto('/settings')}
              title="Настройки"
              class="text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              <Settings class="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>

    <!-- Page content -->
    <main class="flex-1 bg-background">
      <div class="p-6">
        <div class="mx-auto max-w-7xl">
          <slot />
        </div>
      </div>
    </main>
  </div>
</div>