<script lang="ts">
  import Input from '$lib/components/ui/Input.svelte';
</script>

<div class="p-8 space-y-6 bg-gray-50 min-h-screen">
  <h1 class="text-2xl font-bold text-gray-900">Input Component Visual Demo</h1>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    <!-- Normal State -->
    <div class="bg-white p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-3 text-gray-700">Normal State</h3>
      <div class="space-y-3">
        <Input
          type="text"
          placeholder="Enter your name"
          value="John Doe"
        />
        <p class="text-sm text-gray-600">Editable field with white background</p>
      </div>
    </div>

    <!-- Readonly State -->
    <div class="bg-white p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-3 text-gray-700">Readonly State</h3>
      <div class="space-y-3">
        <Input
          type="text"
          placeholder="Username (readonly)"
          value="admin"
          readonly={true}
        />
        <p class="text-sm text-gray-600">Readonly field with gray background and lock icon</p>
      </div>
    </div>

    <!-- Disabled State -->
    <div class="bg-white p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-3 text-gray-700">Disabled State</h3>
      <div class="space-y-3">
        <Input
          type="text"
          placeholder="Disabled field"
          value="Cannot edit"
          disabled={true}
        />
        <p class="text-sm text-gray-600">Disabled field with darker gray background</p>
      </div>
    </div>

    <!-- Readonly with Error -->
    <div class="bg-white p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-3 text-gray-700">Readonly + Error</h3>
      <div class="space-y-3">
        <Input
          type="text"
          placeholder="Readonly with error"
          value="invalid@"
          readonly={true}
          hasError={true}
        />
        <p class="text-sm text-gray-600">Readonly field with error state</p>
      </div>
    </div>

    <!-- Normal with Error -->
    <div class="bg-white p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-3 text-gray-700">Normal + Error</h3>
      <div class="space-y-3">
        <Input
          type="email"
          placeholder="Enter valid email"
          value="invalid-email"
          hasError={true}
        />
        <p class="text-sm text-gray-600">Editable field with error state</p>
      </div>
    </div>

    <!-- Different Sizes -->
    <div class="bg-white p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-3 text-gray-700">Size Variants (Readonly)</h3>
      <div class="space-y-3">
        <Input
          type="text"
          placeholder="Small readonly"
          value="Small"
          readonly={true}
          size="sm"
        />
        <Input
          type="text"
          placeholder="Medium readonly"
          value="Medium"
          readonly={true}
          size="md"
        />
        <Input
          type="text"
          placeholder="Large readonly"
          value="Large"
          readonly={true}
          size="lg"
        />
        <p class="text-sm text-gray-600">Different sizes with proper icon scaling</p>
      </div>
    </div>
  </div>

  <div class="bg-white p-6 rounded-lg shadow">
    <h3 class="text-lg font-semibold mb-4 text-gray-700">User Management Form Example</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Username (readonly)</label>
        <Input
          type="text"
          value="admin"
          readonly={true}
        />
        <p class="text-xs text-gray-500 mt-1">Username cannot be changed after creation</p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
        <Input
          type="text"
          value="Administrator"
          placeholder="Enter display name"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <Input
          type="email"
          value="admin@example.com"
          placeholder="Enter email address"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <Input
          type="password"
          value="••••••••"
          placeholder="Enter new password"
        />
      </div>
    </div>
  </div>
</div>