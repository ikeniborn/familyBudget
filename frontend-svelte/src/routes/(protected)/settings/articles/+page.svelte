<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Loading from '$lib/components/common/Loading.svelte';
  import {
    BookOpen,
    Plus,
    Edit,
    Trash2,
    Shield,
    Users,
    User,
    Check,
    X,
    Search,
    Tag,
    Archive
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { useToast } from '$lib/stores/toast.store';
  import { articlesService } from '$lib/services/articles.service';
  import { isAdmin } from '$lib/stores/auth.store';
  import type { Article, ArticleStats } from '$lib/types';

  const toast = useToast();

  // State management
  let articles: Article[] = [];
  let articleStats: ArticleStats = {
    total: 0,
    active: 0,
    inactive: 0,
    shared: 0,
    user_specific: 0
  };
  let loading = true;
  let error = '';

  // Admin status
  let userIsAdmin = false;
  $: userIsAdmin = $isAdmin;

  // Modal states
  let showCreateModal = false;
  let showEditModal = false;
  let showDeleteModal = false;
  let selectedArticle: Article | null = null;

  // Form data
  let formData = {
    code: '',
    name: '',
    description: '',
    is_active: true,
    user_id: null as number | null
  };

  // Filter and search
  let searchTerm = '';
  let activeFilter: 'all' | 'active' | 'inactive' = 'all';
  let sharedFilter: 'all' | 'shared' | 'user' = 'all';

  // Pagination
  let currentPage = 1;
  let itemsPerPage = 50;

  // Computed filtered articles
  $: filteredArticles = articles.filter(article => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        article.name.toLowerCase().includes(searchLower) ||
        article.code.toLowerCase().includes(searchLower) ||
        (article.description && article.description.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
    }

    // Active filter
    if (activeFilter === 'active' && !article.is_active) return false;
    if (activeFilter === 'inactive' && article.is_active) return false;

    // Shared filter
    if (sharedFilter === 'shared' && !article.is_shared) return false;
    if (sharedFilter === 'user' && article.is_shared) return false;

    return true;
  });

  // Functions
  async function loadArticles() {
    try {
      loading = true;
      error = '';

      const [articlesResponse, statsResponse] = await Promise.all([
        articlesService.getAll(0, 1000),
        articlesService.getStats()
      ]);

      if (articlesResponse.success && articlesResponse.data) {
        articles = articlesResponse.data;
      } else {
        throw new Error(articlesResponse.error || 'Failed to load articles');
      }

      if (statsResponse.success && statsResponse.data) {
        articleStats = statsResponse.data;
      }

    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load articles';
      toast.error(`Error loading articles: ${error}`);
    } finally {
      loading = false;
    }
  }

  function openCreateModal() {
    formData = {
      code: '',
      name: '',
      description: '',
      is_active: true,
      user_id: null
    };
    showCreateModal = true;
  }

  function openEditModal(article: Article) {
    selectedArticle = article;
    formData = {
      code: article.code,
      name: article.name,
      description: article.description || '',
      is_active: article.is_active,
      user_id: article.user_id
    };
    showEditModal = true;
  }

  function openDeleteModal(article: Article) {
    selectedArticle = article;
    showDeleteModal = true;
  }

  async function handleCreate() {
    try {
      const response = await articlesService.create({
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        is_active: formData.is_active,
        user_id: formData.user_id
      });

      if (response.success) {
        toast.success(`Article "${formData.name}" created successfully`);
        showCreateModal = false;
        await loadArticles();
      } else {
        throw new Error(response.error || 'Failed to create article');
      }
    } catch (err) {
      toast.error(`Failed to create article: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleUpdate() {
    if (!selectedArticle) return;

    try {
      const response = await articlesService.update(selectedArticle.id, {
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        is_active: formData.is_active
      });

      if (response.success) {
        toast.success(`Article "${formData.name}" updated successfully`);
        showEditModal = false;
        selectedArticle = null;
        await loadArticles();
      } else {
        throw new Error(response.error || 'Failed to update article');
      }
    } catch (err) {
      toast.error(`Failed to update article: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleDelete() {
    if (!selectedArticle) return;

    try {
      const response = await articlesService.delete(selectedArticle.id);

      if (response.success) {
        toast.success(`Article "${selectedArticle.name}" deleted successfully`);
        showDeleteModal = false;
        selectedArticle = null;
        await loadArticles();
      } else {
        throw new Error(response.error || 'Failed to delete article');
      }
    } catch (err) {
      toast.error(`Failed to delete article: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function canEdit(article: Article): boolean {
    return article.is_editable || false;
  }

  function canDelete(article: Article): boolean {
    return canEdit(article);
  }

  onMount(() => {
    loadArticles();
  });
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <BookOpen class="h-6 w-6 text-blue-600" />
        Управление статьями
      </h1>
      <p class="text-gray-600 mt-1">
        Управление категориями статей для группировки номенклатур
      </p>
    </div>

    <Button on:click={openCreateModal} class="flex items-center gap-2">
      <Plus class="h-4 w-4" />
      Создать статью
    </Button>
  </div>

  <!-- Statistics Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
    <Card class="p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-600">Всего</p>
          <p class="text-2xl font-bold text-gray-900">{articleStats.total}</p>
        </div>
        <Tag class="h-8 w-8 text-blue-600" />
      </div>
    </Card>

    <Card class="p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-600">Активные</p>
          <p class="text-2xl font-bold text-green-600">{articleStats.active}</p>
        </div>
        <Check class="h-8 w-8 text-green-600" />
      </div>
    </Card>

    <Card class="p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-600">Неактивные</p>
          <p class="text-2xl font-bold text-red-600">{articleStats.inactive}</p>
        </div>
        <Archive class="h-8 w-8 text-red-600" />
      </div>
    </Card>

    <Card class="p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-600">Общие</p>
          <p class="text-2xl font-bold text-purple-600">{articleStats.shared}</p>
        </div>
        <Users class="h-8 w-8 text-purple-600" />
      </div>
    </Card>

    <Card class="p-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-600">Личные</p>
          <p class="text-2xl font-bold text-orange-600">{articleStats.user_specific}</p>
        </div>
        <User class="h-8 w-8 text-orange-600" />
      </div>
    </Card>
  </div>

  <!-- Filters -->
  <Card class="p-4">
    <div class="flex flex-col sm:flex-row gap-4">
      <!-- Search -->
      <div class="flex-1">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по названию, коду или описанию..."
            bind:value={searchTerm}
            class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <!-- Status Filter -->
      <select
        bind:value={activeFilter}
        class="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="all">Все статусы</option>
        <option value="active">Только активные</option>
        <option value="inactive">Только неактивные</option>
      </select>

      <!-- Shared Filter -->
      <select
        bind:value={sharedFilter}
        class="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <option value="all">Все типы</option>
        <option value="shared">Только общие</option>
        <option value="user">Только личные</option>
      </select>
    </div>
  </Card>

  <!-- Articles Table -->
  <Card class="overflow-hidden">
    {#if loading}
      <Loading text="Загрузка статей..." />
    {:else if error}
      <div class="p-6 text-center">
        <X class="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p class="text-gray-900 font-medium mb-2">Ошибка загрузки</p>
        <p class="text-gray-600 mb-4">{error}</p>
        <Button on:click={loadArticles}>Попробовать снова</Button>
      </div>
    {:else if filteredArticles.length === 0}
      <div class="p-6 text-center">
        <BookOpen class="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p class="text-gray-900 font-medium mb-2">Статьи не найдены</p>
        <p class="text-gray-600 mb-4">
          {searchTerm ? 'Попробуйте изменить критерии поиска' : 'Создайте первую статью'}
        </p>
        {#if !searchTerm}
          <Button on:click={openCreateModal}>Создать статью</Button>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Код и название
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Описание
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Тип
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredArticles as article (article.id)}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div class="flex items-center gap-2">
                      <code class="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                        {article.code}
                      </code>
                    </div>
                    <div class="text-sm font-medium text-gray-900 mt-1">
                      {article.name}
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="text-sm text-gray-900">
                    {article.description || '-'}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    {#if article.is_shared}
                      <Badge variant="purple" class="flex items-center gap-1">
                        <Shield class="h-3 w-3" />
                        Общая
                      </Badge>
                    {:else}
                      <Badge variant="orange" class="flex items-center gap-1">
                        <User class="h-3 w-3" />
                        Личная
                      </Badge>
                    {/if}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  {#if article.is_active}
                    <Badge variant="green" class="flex items-center gap-1">
                      <Check class="h-3 w-3" />
                      Активна
                    </Badge>
                  {:else}
                    <Badge variant="red" class="flex items-center gap-1">
                      <X class="h-3 w-3" />
                      Неактивна
                    </Badge>
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div class="flex items-center justify-end gap-2">
                    {#if canEdit(article)}
                      <Button
                        variant="outline"
                        size="sm"
                        on:click={() => openEditModal(article)}
                        class="flex items-center gap-1"
                      >
                        <Edit class="h-4 w-4" />
                        Изменить
                      </Button>
                    {/if}
                    {#if canDelete(article)}
                      <Button
                        variant="outline"
                        size="sm"
                        on:click={() => openDeleteModal(article)}
                        class="flex items-center gap-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 class="h-4 w-4" />
                        Удалить
                      </Button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </Card>
</div>

<!-- Create Modal -->
<Modal bind:show={showCreateModal} title="Создать статью">
  <form on:submit|preventDefault={handleCreate} class="space-y-4">
    <div>
      <label for="create-code" class="block text-sm font-medium text-gray-700 mb-1">
        Код статьи *
      </label>
      <input
        id="create-code"
        type="text"
        required
        bind:value={formData.code}
        placeholder="FOOD, TRANSPORT, etc."
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>

    <div>
      <label for="create-name" class="block text-sm font-medium text-gray-700 mb-1">
        Название *
      </label>
      <input
        id="create-name"
        type="text"
        required
        bind:value={formData.name}
        placeholder="Питание"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>

    <div>
      <label for="create-description" class="block text-sm font-medium text-gray-700 mb-1">
        Описание
      </label>
      <textarea
        id="create-description"
        bind:value={formData.description}
        placeholder="Описание статьи"
        rows="3"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      ></textarea>
    </div>

    {#if userIsAdmin}
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Тип статьи
        </label>
        <div class="space-y-2">
          <label class="flex items-center">
            <input
              type="radio"
              bind:group={formData.user_id}
              value={null}
              class="mr-2"
            />
            <span class="text-sm">Общая статья (доступна всем пользователям)</span>
          </label>
        </div>
      </div>
    {/if}

    <div class="flex items-center">
      <input
        id="create-active"
        type="checkbox"
        bind:checked={formData.is_active}
        class="mr-2"
      />
      <label for="create-active" class="text-sm text-gray-700">
        Активная статья
      </label>
    </div>

    <div class="flex justify-end gap-3 pt-4">
      <Button
        type="button"
        variant="outline"
        on:click={() => (showCreateModal = false)}
      >
        Отмена
      </Button>
      <Button type="submit">Создать</Button>
    </div>
  </form>
</Modal>

<!-- Edit Modal -->
<Modal bind:show={showEditModal} title="Редактировать статью">
  <form on:submit|preventDefault={handleUpdate} class="space-y-4">
    <div>
      <label for="edit-code" class="block text-sm font-medium text-gray-700 mb-1">
        Код статьи *
      </label>
      <input
        id="edit-code"
        type="text"
        required
        bind:value={formData.code}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>

    <div>
      <label for="edit-name" class="block text-sm font-medium text-gray-700 mb-1">
        Название *
      </label>
      <input
        id="edit-name"
        type="text"
        required
        bind:value={formData.name}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>

    <div>
      <label for="edit-description" class="block text-sm font-medium text-gray-700 mb-1">
        Описание
      </label>
      <textarea
        id="edit-description"
        bind:value={formData.description}
        rows="3"
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      ></textarea>
    </div>

    <div class="flex items-center">
      <input
        id="edit-active"
        type="checkbox"
        bind:checked={formData.is_active}
        class="mr-2"
      />
      <label for="edit-active" class="text-sm text-gray-700">
        Активная статья
      </label>
    </div>

    <div class="flex justify-end gap-3 pt-4">
      <Button
        type="button"
        variant="outline"
        on:click={() => (showEditModal = false)}
      >
        Отмена
      </Button>
      <Button type="submit">Сохранить</Button>
    </div>
  </form>
</Modal>

<!-- Delete Modal -->
<Modal bind:show={showDeleteModal} title="Удалить статью">
  <div class="space-y-4">
    <p class="text-gray-700">
      Вы уверены, что хотите удалить статью
      <strong>"{selectedArticle?.name}"</strong>?
    </p>
    <p class="text-sm text-red-600">
      Это действие нельзя отменить. Убедитесь, что статья не используется в номенклатурах.
    </p>

    <div class="flex justify-end gap-3 pt-4">
      <Button
        type="button"
        variant="outline"
        on:click={() => (showDeleteModal = false)}
      >
        Отмена
      </Button>
      <Button
        type="button"
        variant="destructive"
        on:click={handleDelete}
      >
        Удалить
      </Button>
    </div>
  </div>
</Modal>