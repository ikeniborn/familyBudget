<script lang="ts">
  import { Bell } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  
  let isOpen = false;
  let notifications = [
    {
      id: 1,
      title: 'Добро пожаловать!',
      message: 'Система готова к использованию',
      time: '5 мин назад',
      unread: true
    }
  ];
  
  $: unreadCount = notifications.filter(n => n.unread).length;
  
  function toggleDropdown() {
    isOpen = !isOpen;
  }
  
  function closeDropdown() {
    isOpen = false;
  }
  
  function markAsRead(id: number) {
    notifications = notifications.map(n => 
      n.id === id ? { ...n, unread: false } : n
    );
  }
</script>

<div class="relative">
  <Button
    variant="ghost"
    size="icon"
    on:click={toggleDropdown}
    class="relative"
    title="Уведомления"
  >
    <Bell class="h-5 w-5" />
    {#if unreadCount > 0}
      <Badge 
        variant="destructive" 
        class="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
      >
        {unreadCount}
      </Badge>
    {/if}
  </Button>
  
  {#if isOpen}
    <!-- Backdrop -->
    <div 
      class="fixed inset-0 z-10" 
      on:click={closeDropdown}
      on:keydown={(e) => e.key === 'Escape' && closeDropdown()}
      role="button"
      tabindex="-1"
    ></div>
    
    <!-- Dropdown -->
    <div class="absolute right-0 mt-2 w-80 z-20 bg-white rounded-lg shadow-lg border border-gray-200">
      <div class="p-4 border-b border-gray-200">
        <h3 class="text-lg font-medium">Уведомления</h3>
      </div>
      
      <div class="max-h-96 overflow-y-auto">
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
  {/if}
</div>