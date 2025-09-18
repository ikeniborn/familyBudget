<script lang="ts">
  import { Bell, Maximize2, Minimize2, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { portal, createPortal } from '$lib/utils/portal';
  
  let isOpen = false;
  let isExpanded = false;
  let buttonElement: HTMLButtonElement;
  let buttonRect: DOMRect | null = null;
  
  const portalManager = createPortal();
  
  let notifications = [
    {
      id: 1,
      title: 'Добро пожаловать!',
      message: 'Система готова к использованию',
      time: '5 мин назад',
      unread: true
    },
    {
      id: 2,
      title: 'Успешно!',
      message: 'Вы вошли в систему',
      time: 'только что',
      unread: true
    }
  ];
  
  $: unreadCount = notifications.filter(n => n.unread).length;
  
  function toggleDropdown(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Обновляем позицию кнопки для правильного позиционирования дропдауна
    if (buttonElement && !isOpen) {
      buttonRect = buttonElement.getBoundingClientRect();
    }

    isOpen = !isOpen;
    
    if (!isOpen) {
      isExpanded = false; // Reset expansion when closing
      buttonRect = null;
    }
  }
  
  function closeDropdown(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    isOpen = false;
    isExpanded = false;
    buttonRect = null;
  }
  
  function toggleExpanded(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    isExpanded = !isExpanded;
  }
  
  function markAsRead(id: number) {
    notifications = notifications.map(n => 
      n.id === id ? { ...n, unread: false } : n
    );
  }

  // Calculate dropdown position based on button position
  $: dropdownStyles = buttonRect && !isExpanded ? {
    position: 'fixed',
    top: `${buttonRect.bottom + 8}px`,
    right: `${window.innerWidth - buttonRect.right}px`,
    'max-width': '20rem',
    width: 'auto'
  } : {};

  // Handle escape key listener using lifecycle hooks
  onMount(() => {
    // Component mounted successfully
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        closeDropdown();
      }
    };
    
    const handleResize = () => {
      // Update button position on window resize
      if (buttonElement && isOpen && !isExpanded) {
        buttonRect = buttonElement.getBoundingClientRect();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleResize);
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleResize);
    };
  });
</script>

<style>
  /* Высокий z-index для портальных элементов */
  :global(.notification-portal) {
    z-index: 99999 !important;
    position: fixed !important;
  }
  
  :global(.notification-backdrop) {
    z-index: 99998 !important;
    position: fixed !important;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
  
  @media (max-width: 640px) {
    :global(.notification-dropdown-mobile) {
      right: 0.5rem !important;
      left: 0.5rem !important;
      width: calc(100% - 1rem) !important;
    }
  }
</style>

<div class="relative" role="region" aria-label="Панель уведомлений">
  <!-- Direct button implementation for notification bell -->
  <button
    bind:this={buttonElement}
    type="button"
    on:click={toggleDropdown}
    on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleDropdown(e)}
    class="relative inline-flex items-center justify-center h-10 w-10 rounded-md font-medium transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95"
    title="Уведомления"
    aria-label="Открыть уведомления"
  >
    <Bell class="h-5 w-5" />
    {#if unreadCount > 0}
      <span class="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
    {/if}
  </button>
</div>

{#if isOpen && portalManager.mounted}
  <!-- Backdrop - всегда через портал -->
  <div 
    use:portal
    class={`notification-backdrop ${isExpanded ? 'bg-black/50' : ''}`}
    on:click={closeDropdown}
    on:keydown={(e) => e.key === 'Escape' && closeDropdown(e)}
    role="button"
    tabindex="-1"
    aria-label="Закрыть уведомления"
  ></div>
  
  <!-- Dropdown - через портал для правильного z-index -->
  <div 
    use:portal
    class="notification-portal"
    style={isExpanded ? 'position: fixed; top: 0; right: 0; bottom: 0; width: 100%; max-width: 50vw;' : Object.entries(dropdownStyles).map(([k, v]) => `${k}: ${v}`).join('; ')}
  >
    <div class={`
      ${isExpanded 
        ? 'h-screen w-full' 
        : 'w-80 max-w-sm sm:w-80 notification-dropdown-mobile'
      } 
      bg-white ${isExpanded ? '' : 'rounded-lg'} shadow-lg border border-gray-200 transition-all duration-300 ease-in-out
    `}>
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-lg font-medium">Уведомления</h3>
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            on:click={toggleExpanded}
            class="h-8 w-8"
            title={isExpanded ? "Свернуть" : "Развернуть"}
          >
            {#if isExpanded}
              <Minimize2 class="h-4 w-4" />
            {:else}
              <Maximize2 class="h-4 w-4" />
            {/if}
          </Button>
          {#if isExpanded}
            <Button
              variant="ghost"
              size="icon"
              on:click={closeDropdown}
              class="h-8 w-8"
              title="Закрыть"
            >
              <X class="h-4 w-4" />
            </Button>
          {/if}
        </div>
      </div>
      
      <div class={`${isExpanded ? 'h-[calc(100vh-8rem)]' : 'max-h-96'} overflow-y-auto`}>
        {#if notifications.length === 0}
          <div class="p-4 text-center text-gray-500">
            Нет уведомлений
          </div>
        {:else}
          {#each notifications as notification (notification.id)}
            <div 
              class="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              on:click={() => markAsRead(notification.id)}
              on:keydown={(e) => e.key === 'Enter' && markAsRead(notification.id)}
              role="button"
              tabindex="0"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center">
                    <h4 class="font-medium text-sm">{notification.title}</h4>
                    {#if notification.unread}
                      <div class="w-2 h-2 bg-blue-500 rounded-full ml-2"></div>
                    {/if}
                  </div>
                  <p class="text-sm text-gray-600 mt-1">{notification.message}</p>
                  <p class="text-xs text-gray-400 mt-1">{notification.time}</p>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
      
      {#if notifications.some(n => n.unread)}
        <div class="p-4 border-t border-gray-200">
          <Button 
            variant="ghost" 
            size="sm" 
            class="w-full"
            on:click={() => {
              notifications = notifications.map(n => ({ ...n, unread: false }));
            }}
          >
            Отметить все как прочитанные
          </Button>
        </div>
      {/if}
    </div>
  </div>
{/if}