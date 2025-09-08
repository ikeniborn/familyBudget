<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { createEventDispatcher } from 'svelte';
  import { AlertTriangle } from 'lucide-svelte';
  import type { User } from '$lib/types';

  export let open = false;
  export let user: User | null = null;
  export let loading = false;

  const dispatch = createEventDispatcher<{
    close: void;
    confirm: void;
  }>();

  function handleClose() {
    open = false;
    dispatch('close');
  }

  function handleConfirm() {
    dispatch('confirm');
  }
</script>

<Modal bind:open on:close={handleClose} title="Подтверждение удаления" size="sm">
  <div class="p-6 bg-white border border-gray-200 rounded-lg">
    <div class="flex items-start gap-4">
      <div class="flex-shrink-0">
        <AlertTriangle class="h-8 w-8 text-red-500" />
      </div>
      <div class="flex-1">
        <h3 class="text-lg font-medium text-gray-900 mb-2">
          Удалить пользователя?
        </h3>
        {#if user}
          <p class="text-sm text-gray-600 mb-4">
            Вы уверены, что хотите удалить пользователя <strong>{user.user_name}</strong>?
          </p>
          <div class="text-xs text-gray-500 space-y-1">
            <p>• Пользователь будет деактивирован</p>
            <p>• Все данные пользователя будут сохранены</p>
            <p>• Отменить это действие будет невозможно</p>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <svelte:fragment slot="footer">
    <div class="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
      <Button variant="outline" on:click={handleClose} disabled={loading}>
        Отмена
      </Button>
      <Button 
        variant="destructive" 
        on:click={handleConfirm} 
        disabled={loading}
        class="bg-red-600 hover:bg-red-700 text-white"
      >
        {loading ? 'Удаление...' : 'Удалить пользователя'}
      </Button>
    </div>
  </svelte:fragment>
</Modal>