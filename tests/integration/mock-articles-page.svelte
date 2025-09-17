<!--
Mock Articles Page Component for Integration Testing
Simulates the actual articles settings page functionality
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import { isAdmin, authStore } from '$lib/stores/auth.store';
  import { toast } from '$lib/stores/toast.store';
  import api from '$lib/services/api';

  interface Article {
    id: number;
    code: string;
    name: string;
    description: string;
    is_active: boolean;
    user_id: number;
    is_shared: boolean;
  }

  let articles: Article[] = [];
  let loading = false;
  let showCreateModal = false;
  let showEditModal = false;
  let showDeleteModal = false;
  let selectedArticle: Article | null = null;
  let formData = {
    code: '',
    name: '',
    description: '',
    is_active: true,
    is_shared: false
  };

  onMount(async () => {
    await loadArticles();
  });

  async function loadArticles() {
    loading = true;
    try {
      const response = await api.get('/articles');
      if (response.success) {
        articles = response.data;
      } else {
        toast.error('Failed to load articles');
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        await authStore.logout();
        return;
      }
      toast.error('Failed to load articles');
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
      is_shared: false
    };
    showCreateModal = true;
  }

  function openEditModal(article: Article) {
    selectedArticle = article;
    formData = {
      code: article.code,
      name: article.name,
      description: article.description,
      is_active: article.is_active,
      is_shared: article.is_shared
    };
    showEditModal = true;
  }

  function openDeleteModal(article: Article) {
    selectedArticle = article;
    showDeleteModal = true;
  }

  async function createArticle() {
    try {
      const response = await api.post('/articles', formData);
      if (response.success) {
        toast.success('Article created successfully');
        showCreateModal = false;
        await loadArticles();
      } else {
        toast.error('Failed to create article');
      }
    } catch (error) {
      toast.error('Failed to create article');
    }
  }

  async function updateArticle() {
    if (!selectedArticle) return;

    try {
      const response = await api.put(`/articles/${selectedArticle.id}`, formData);
      if (response.success) {
        toast.success('Article updated successfully');
        showEditModal = false;
        await loadArticles();
      } else {
        toast.error('Failed to update article');
      }
    } catch (error) {
      toast.error('Failed to update article');
    }
  }

  async function deleteArticle() {
    if (!selectedArticle) return;

    try {
      const response = await api.delete(`/articles/${selectedArticle.id}`);
      if (response.success) {
        toast.success('Article deleted successfully');
        showDeleteModal = false;
        await loadArticles();
      } else {
        toast.error('Failed to delete article');
      }
    } catch (error) {
      toast.error('Failed to delete article');
    }
  }
</script>

<div class="p-6">
  <div class="flex justify-between items-center mb-6">
    <h1 class="text-2xl font-bold">Articles Management</h1>
    <div class="flex gap-2">
      {#if $isAdmin}
        <button data-testid="bulk-operations-btn" class="btn btn-secondary">
          Bulk Operations
        </button>
        <label data-testid="shared-articles-toggle" class="flex items-center gap-2">
          <input type="checkbox" />
          Show Shared Articles
        </label>
      {/if}
      <button
        data-testid="create-article-btn"
        class="btn btn-primary"
        on:click={openCreateModal}
      >
        Create Article
      </button>
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center p-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="table w-full">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Description</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each articles as article}
            <tr>
              <td>{article.code}</td>
              <td>{article.name}</td>
              <td>{article.description}</td>
              <td>
                <span class="badge {article.is_active ? 'badge-success' : 'badge-error'}">
                  {article.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>
                <div class="flex gap-2">
                  <button
                    data-testid="edit-article-btn"
                    class="btn btn-sm btn-outline"
                    on:click={() => openEditModal(article)}
                  >
                    Edit
                  </button>
                  <button
                    data-testid="delete-article-btn"
                    class="btn btn-sm btn-error"
                    on:click={() => openDeleteModal(article)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Create Modal -->
{#if showCreateModal}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Create Article</h3>
      <div class="form-control">
        <label class="label" for="create-code">
          <span class="label-text">Code</span>
        </label>
        <input
          id="create-code"
          type="text"
          class="input input-bordered"
          bind:value={formData.code}
        />
      </div>
      <div class="form-control">
        <label class="label" for="create-name">
          <span class="label-text">Name</span>
        </label>
        <input
          id="create-name"
          type="text"
          class="input input-bordered"
          bind:value={formData.name}
        />
      </div>
      <div class="form-control">
        <label class="label" for="create-description">
          <span class="label-text">Description</span>
        </label>
        <textarea
          id="create-description"
          class="textarea textarea-bordered"
          bind:value={formData.description}
        ></textarea>
      </div>
      <div class="modal-action">
        <button
          data-testid="submit-article-btn"
          class="btn btn-primary"
          on:click={createArticle}
        >
          Create
        </button>
        <button class="btn" on:click={() => showCreateModal = false}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Modal -->
{#if showEditModal && selectedArticle}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Edit Article</h3>
      <div class="form-control">
        <label class="label" for="edit-code">
          <span class="label-text">Code</span>
        </label>
        <input
          id="edit-code"
          type="text"
          class="input input-bordered"
          bind:value={formData.code}
        />
      </div>
      <div class="form-control">
        <label class="label" for="edit-name">
          <span class="label-text">Name</span>
        </label>
        <input
          id="edit-name"
          type="text"
          class="input input-bordered"
          bind:value={formData.name}
        />
      </div>
      <div class="form-control">
        <label class="label" for="edit-description">
          <span class="label-text">Description</span>
        </label>
        <textarea
          id="edit-description"
          class="textarea textarea-bordered"
          bind:value={formData.description}
        ></textarea>
      </div>
      <div class="modal-action">
        <button
          data-testid="update-article-btn"
          class="btn btn-primary"
          on:click={updateArticle}
        >
          Update
        </button>
        <button class="btn" on:click={() => showEditModal = false}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Modal -->
{#if showDeleteModal && selectedArticle}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Confirm Deletion</h3>
      <p class="py-4">
        Are you sure you want to delete the article "{selectedArticle.name}"?
        This action cannot be undone.
      </p>
      <div class="modal-action">
        <button
          data-testid="confirm-delete-btn"
          class="btn btn-error"
          on:click={deleteArticle}
        >
          Delete
        </button>
        <button class="btn" on:click={() => showDeleteModal = false}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .btn {
    @apply px-4 py-2 rounded;
  }
  .btn-primary {
    @apply bg-blue-600 text-white;
  }
  .btn-secondary {
    @apply bg-gray-600 text-white;
  }
  .btn-outline {
    @apply border border-gray-300;
  }
  .btn-error {
    @apply bg-red-600 text-white;
  }
  .btn-sm {
    @apply px-2 py-1 text-sm;
  }
  .input, .textarea {
    @apply w-full px-3 py-2 border border-gray-300 rounded;
  }
  .table {
    @apply w-full border-collapse;
  }
  .table th, .table td {
    @apply px-4 py-2 text-left border-b;
  }
  .badge {
    @apply px-2 py-1 rounded text-xs;
  }
  .badge-success {
    @apply bg-green-100 text-green-800;
  }
  .badge-error {
    @apply bg-red-100 text-red-800;
  }
  .modal {
    @apply fixed inset-0 flex items-center justify-center bg-black bg-opacity-50;
  }
  .modal-box {
    @apply bg-white p-6 rounded-lg max-w-md w-full mx-4;
  }
  .modal-action {
    @apply flex justify-end gap-2 mt-4;
  }
  .form-control {
    @apply mb-4;
  }
  .label {
    @apply block mb-1;
  }
  .label-text {
    @apply text-sm font-medium;
  }
</style>