<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { currentUser, isAuthenticated, isAdmin } from '$lib/stores/auth.store';
	import { adminService } from '$lib/services/adminService';
	import type { User } from '$lib/types/index.js';
	
	let users: User[] = [];
	let selectedUser: number | null = null;
	let selectedResourceType = 'nomenclature';
	let references: any[] = [];
	let loading = false;
	let error = '';
	
	const resourceTypes = [
		{ value: 'nomenclature', label: 'Номенклатуры' },
		{ value: 'cost_center', label: 'Центры затрат' },
		{ value: 'financial_center', label: 'Финансовые центры' },
		{ value: 'product', label: 'Продукты' }
	];
	
	onMount(async () => {
		// Check if current user is admin using stores
		if (!$isAdmin) {
			goto('/');
			return;
		}
		
		await loadUsers();
		await loadReferences();
	});
	
	async function loadUsers() {
		try {
			loading = true;
			const result = await adminService.getAllUsers();
			users = result.data;
		} catch (err) {
			error = 'Не удалось загрузить список пользователей';
			console.error('Failed to load users:', err);
		} finally {
			loading = false;
		}
	}
	
	async function loadReferences() {
		try {
			loading = true;
			const result = await adminService.getAllReferences(selectedResourceType, selectedUser || undefined);
			references = result.data;
		} catch (err) {
			error = `Не удалось загрузить ${resourceTypes.find(rt => rt.value === selectedResourceType)?.label}`;
			console.error('Failed to load references:', err);
		} finally {
			loading = false;
		}
	}
	
	async function deleteReference(id: number) {
		if (!confirm('Вы уверены, что хотите удалить этот элемент?')) {
			return;
		}
		
		try {
			await adminService.deleteReference(selectedResourceType, id);
			await loadReferences();
		} catch (err) {
			error = 'Не удалось удалить элемент';
			console.error('Failed to delete reference:', err);
		}
	}
	
	function handleResourceTypeChange() {
		loadReferences();
	}
	
	function handleUserChange() {
		loadReferences();
	}
</script>

<div class="container mx-auto p-6">
	<div class="mb-6">
		<h1 class="text-3xl font-bold text-gray-800">Администрирование справочников</h1>
		<p class="text-gray-600 mt-2">Управление данными пользователей</p>
	</div>
	
	{#if error}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
			{error}
		</div>
	{/if}
	
	<!-- Filters -->
	<div class="bg-white rounded-lg shadow-md p-6 mb-6">
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<!-- Resource Type Filter -->
			<div>
				<label for="resourceType" class="block text-sm font-medium text-gray-700 mb-2">
					Тип справочника
				</label>
				<select
					id="resourceType"
					bind:value={selectedResourceType}
					on:change={handleResourceTypeChange}
					class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					{#each resourceTypes as resourceType}
						<option value={resourceType.value}>{resourceType.label}</option>
					{/each}
				</select>
			</div>
			
			<!-- User Filter -->
			<div>
				<label for="userFilter" class="block text-sm font-medium text-gray-700 mb-2">
					Пользователь
				</label>
				<select
					id="userFilter"
					bind:value={selectedUser}
					on:change={handleUserChange}
					class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					<option value={null}>Все пользователи</option>
					{#each users as user}
						<option value={user.id}>{user.user_name} ({user.username || user.telegram_id})</option>
					{/each}
				</select>
			</div>
		</div>
	</div>
	
	<!-- References Table -->
	<div class="bg-white rounded-lg shadow-md overflow-hidden">
		<div class="px-6 py-4 border-b border-gray-200">
			<h2 class="text-lg font-medium text-gray-800">
				{resourceTypes.find(rt => rt.value === selectedResourceType)?.label}
			</h2>
		</div>
		
		{#if loading}
			<div class="p-6 text-center">
				<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
				<p class="mt-2 text-gray-600">Загрузка...</p>
			</div>
		{:else if references.length === 0}
			<div class="p-6 text-center text-gray-500">
				Нет данных для отображения
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								ID
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Название
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Описание
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Пользователь
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
						{#each references as ref}
							<tr class="hover:bg-gray-50">
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{ref.id}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{ref.name}
								</td>
								<td class="px-6 py-4 text-sm text-gray-900">
									{ref.description || '-'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
									{ref.user?.user_name || 'Неизвестно'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full {ref.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
										{ref.is_active ? 'Активен' : 'Неактивен'}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
									<button
										on:click={() => deleteReference(ref.id)}
										class="text-red-600 hover:text-red-900 mr-3"
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
</div>

<style>
	.container {
		max-width: 1200px;
	}
</style>