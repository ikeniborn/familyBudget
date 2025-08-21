<script lang="ts">
  interface $$Props {
    height?: number;
    class?: string;
  }

  export let height = 250;
  
  let className = '';
  export { className as class };
</script>

<div class="animate-pulse bg-gray-50 rounded-lg border {className}" style="height: {height}px;">
  <div class="p-4 h-full flex flex-col">
    <!-- Chart title skeleton -->
    <div class="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
    
    <!-- Chart area skeleton -->
    <div class="flex-1 flex items-end justify-between space-x-2">
      <!-- Bars/lines skeleton -->
      <div class="bg-gray-200 rounded-t w-8 h-16"></div>
      <div class="bg-gray-200 rounded-t w-8 h-24"></div>
      <div class="bg-gray-200 rounded-t w-8 h-32"></div>
      <div class="bg-gray-200 rounded-t w-8 h-20"></div>
      <div class="bg-gray-200 rounded-t w-8 h-28"></div>
      <div class="bg-gray-200 rounded-t w-8 h-36"></div>
      <div class="bg-gray-200 rounded-t w-8 h-24"></div>
      <div class="bg-gray-200 rounded-t w-8 h-40"></div>
    </div>
    
    <!-- X-axis labels skeleton -->
    <div class="flex justify-between mt-2">
      <div class="h-3 bg-gray-200 rounded w-8"></div>
      <div class="h-3 bg-gray-200 rounded w-8"></div>
      <div class="h-3 bg-gray-200 rounded w-8"></div>
      <div class="h-3 bg-gray-200 rounded w-8"></div>
      <div class="h-3 bg-gray-200 rounded w-8"></div>
    </div>
  </div>
</div>

<style>
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
</style>