<script lang="ts">
	import { onMount } from 'svelte';
	import { currentUser } from '$lib/stores/auth.store';
	import { sharingService } from '$lib/services/sharingService';
	import type { Sharing, SharingCreate, User } from '$lib/types/index.js';
	
	let myShares: Sharing[] = [];
	let sharedWithMe: Sharing[] = [];
	let availableUsers: User[] = [];
	let loading = false;
	let error = '';
	let showCreateModal = false;
	
	// Create sharing form
	let createForm = {
		shared_with_user_id: 0,
		resource_type: 'nomenclature' as 'nomenclature' | 'cost_center' | 'financial_center' | 'product',
		resource_id: null as number | null,
		permission_type: 'read' as 'read' | 'write',
		is_active: true
	};
	
	const resourceTypes = [
		{ value: 'nomenclature', label: 'Номенклатуры' },
		{ value: 'cost_center', label: 'Центры затрат' },
		{ value: 'financial_center', label: 'Финансовые центры' },
		{ value: 'product', label: 'Продукты' }
	];
	
	onMount(async () => {
		await loadData();
	});
	
	async function loadData() {
		try {
			loading = true;
			error = '';
			
			const [mySharesResult, sharedWithMeResult, availableUsersResult] = await Promise.all([
				sharingService.getMyShares(),
				sharingService.getSharedWithMe(),
				sharingService.getAvailableUsers()
			]);
			
			myShares = mySharesResult.data;
			sharedWithMe = sharedWithMeResult.data;
			availableUsers = availableUsersResult.data;
		} catch (err) {
			error = 'Не удалось загрузить данные sharing';
			console.error('Failed to load sharing data:', err);
		} finally {
			loading = false;
		}
	}
	
	async function createSharing() {
		if (createForm.shared_with_user_id === 0) {
			error = 'Выберите пользователя';
			return;
		}
		
		try {
			await sharingService.createSharing(createForm);
			showCreateModal = false;
			resetCreateForm();
			await loadData();
		} catch (err) {
			error = 'Не удалось создать настройку sharing';
			console.error('Failed to create sharing:', err);
		}
	}
	
	async function deleteSharing(sharingId: number) {
		if (!confirm('Вы уверены, что хотите удалить эту настройку sharing?')) {
			return;
		}
		
		try {
			await sharingService.deleteSharing(sharingId);
			await loadData();
		} catch (err) {
			error = 'Не удалось удалить настройку sharing';
			console.error('Failed to delete sharing:', err);
		}
	}
	
	async function toggleSharingStatus(sharing: Sharing) {
		try {
			await sharingService.updateSharing(sharing.id, {
				is_active: !sharing.is_active
			});
			await loadData();
		} catch (err) {
			error = 'Не удалось изменить статус sharing';
			console.error('Failed to toggle sharing:', err);
		}
	}
	
	function resetCreateForm() {
		createForm = {
			shared_with_user_id: 0,
			resource_type: 'nomenclature',
			resource_id: null,
			permission_type: 'read',
			is_active: true
		};
	}
	
	function formatResourceType(type: string): string {
		return resourceTypes.find(rt => rt.value === type)?.label || type;
	}
	
	function formatPermissionType(type: string): string {
		return type === 'read' ? 'Только чтение' : 'Чтение и запись';
	}
</script>

<div class="container mx-auto p-6">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-800">Настройки sharing</h1>
		<p class="text-gray-600 mt-2">Управление доступом к вашим данным</p>
	</div>
	
	{#if error}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
			{error}
		</div>
	{/if}
	
	<!-- My Shares Section -->
	<div class="bg-white rounded-lg shadow-md p-6 mb-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-xl font-semibold text-gray-800">Мои настройки sharing</h2>
			<button
				on:click={() => showCreateModal = true}
				class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
			>
				Добавить sharing
			</button>
		</div>
		
		{#if loading}
			<div class="text-center py-4">
				<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
				<p class="mt-2 text-gray-600">Загрузка...</p>
			</div>
		{:else if myShares.length === 0}
			<p class="text-gray-500 text-center py-8">У вас нет активных настроек sharing</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Пользователь
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Тип данных
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Права доступа
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Статус
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Действия
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each myShares as share}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{share.shared_with?.user_name || 'Неизвестно'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{formatResourceType(share.resource_type)}
									{#if share.resource_id}
										<span class="text-gray-500">(ID: {share.resource_id})</span>
									{:else}
										<span class="text-gray-500">(Все)</span>
									{/if}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{formatPermissionType(share.permission_type)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full {share.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
										{share.is_active ? 'Активен' : 'Неактивен'}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
									<button
										on:click={() => toggleSharingStatus(share)}
										class="text-indigo-600 hover:text-indigo-900 mr-3"
									>
										{share.is_active ? 'Отключить' : 'Включить'}
									</button>
									<button
										on:click={() => deleteSharing(share.id)}
										class="text-red-600 hover:text-red-900"
									>
										Удалить
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
	
	<!-- Shared With Me Section -->
	<div class="bg-white rounded-lg shadow-md p-6">
		<h2 class="text-xl font-semibold text-gray-800 mb-4">Данные, shared со мной</h2>
		
		{#if sharedWithMe.length === 0}
			<p class="text-gray-500 text-center py-8">С вами не поделились никакими данными</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Владелец
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Тип данных
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Права доступа
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Предоставлен
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each sharedWithMe as share}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{share.owner?.user_name || 'Неизвестно'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{formatResourceType(share.resource_type)}
									{#if share.resource_id}
										<span class="text-gray-500">(ID: {share.resource_id})</span>
									{:else}
										<span class="text-gray-500">(Все)</span>
									{/if}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{formatPermissionType(share.permission_type)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{new Date(share.created_at).toLocaleDateString('ru-RU')}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<!-- Create Sharing Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
			<div class="mt-3">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Создать новый sharing</h3>
				
				<form on:submit|preventDefault={createSharing}>
					<div class="mb-4">
						<label class="block text-sm font-medium text-gray-700 mb-2">Пользователь</label>
						<select bind:value={createForm.shared_with_user_id} class="w-full border border-gray-300 rounded-md px-3 py-2">
							<option value={0}>Выберите пользователя</option>
							{#each availableUsers as user}
								<option value={user.id}>{user.user_name}</option>
							{/each}
						</select>
					</div>
					
					<div class="mb-4">
						<label class="block text-sm font-medium text-gray-700 mb-2">Тип данных</label>
						<select bind:value={createForm.resource_type} class="w-full border border-gray-300 rounded-md px-3 py-2">
							{#each resourceTypes as resourceType}
								<option value={resourceType.value}>{resourceType.label}</option>
							{/each}
						</select>
					</div>
					
					<div class="mb-4">
						<label class="block text-sm font-medium text-gray-700 mb-2">Права доступа</label>
						<select bind:value={createForm.permission_type} class="w-full border border-gray-300 rounded-md px-3 py-2">
							<option value="read">Только чтение</option>
							<option value="write">Чтение и запись</option>
						</select>
					</div>
					
					<div class="flex items-center justify-end space-x-3">
						<button
							type="button"
							on:click={() => { showCreateModal = false; resetCreateForm(); }}
							class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md transition-colors"
						>
							Отмена
						</button>
						<button
							type="submit"
							class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
						>
							Создать
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<style>
	.container {
		max-width: 1200px;
	}
</style>