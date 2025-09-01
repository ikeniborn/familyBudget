<script lang="ts">
  import { Bell, Maximize2, Minimize2, X } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  
  let isOpen = false;
  let isExpanded = false;
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
    console.log('toggleDropdown called!', event);
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    console.log('Notification button clicked, isOpen was:', isOpen);
    isOpen = !isOpen;
    if (!isOpen) {
      isExpanded = false; // Reset expansion when closing
    }
    console.log('Notification dropdown toggled, isOpen is now:', isOpen);
  }
  
  function closeDropdown(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    console.log('Closing notification dropdown');
    isOpen = false;
    isExpanded = false;
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

  // Handle escape key listener using lifecycle hooks
  onMount(() => {
    console.log('NotificationDropdown mounted!');
    
    // Test that button is clickable
    const button = document.querySelector('button[aria-label="Открыть уведомления"]');
    console.log('Found notification button:', button);
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        closeDropdown();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  });
</script>

<style>
  @media (max-width: 640px) {
    :global(.notification-dropdown-mobile) {
      right: 0.5rem !important;
      left: 0.5rem !important;
      width: calc(100% - 1rem) !important;
    }
  }
</style>

<div class="relative" role="region" aria-label="Панель уведомлений">
  <!-- Fallback direct button implementation -->
  <button
    type="button"
    onclick={toggleDropdown}
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleDropdown(e)}
    class="relative inline-flex items-center justify-center h-12 w-12 rounded-md font-medium transition-all hover:bg-secondary hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95"
    title="Уведомления"
    aria-label="Открыть уведомления"
  >
    <Bell class="h-5 w-5" />
    {#if unreadCount > 0}
      <Badge 
        variant="destructive" 
        class="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs pointer-events-none"
      >
        {unreadCount}
      </Badge>
    {/if}
  </button>
  
  {#if isOpen}
    <!-- Backdrop -->
    <div 
      class={`fixed inset-0 ${isExpanded ? 'z-40 bg-black/50' : 'z-30'}`}
      onclick={closeDropdown}
      onkeydown={(e) => e.key === 'Escape' && closeDropdown()}
      role="button"
      tabindex="-1"
      aria-label="Закрыть уведомления"
    ></div>
    
    <!-- Dropdown -->
    <div class={`
      ${isExpanded 
        ? 'fixed top-0 right-0 h-screen w-full sm:w-1/2 z-50' 
        : 'absolute top-full right-0 mt-2 w-full sm:w-80 max-w-sm z-40 notification-dropdown-mobile'
      } 
      bg-white ${isExpanded ? '' : 'rounded-lg'} shadow-lg border border-gray-200 transition-all duration-300 ease-in-out
    `}>
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-lg font-medium">Уведомления</h3>
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onclick={toggleExpanded}
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
              onclick={closeDropdown}
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
              onclick={() => markAsRead(notification.id)}
              onkeydown={(e) => e.key === 'Enter' && markAsRead(notification.id)}
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
            onclick={() => {
              notifications = notifications.map(n => ({ ...n, unread: false }));
            }}
          >
            Отметить все как прочитанные
          </Button>
        </div>
      {/if}
    </div>
  {/if}
</div>