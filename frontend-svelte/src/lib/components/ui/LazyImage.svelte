<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';

  // Props
  export let src: string;
  export let alt: string = '';
  export let placeholder: string = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjZjFmNWY5Ii8+CjxwYXRoIGQ9Ik0xMiA5SDE5QzE5IDEwLjY1NjkgMjAuMzQzMSAxMiAyMiAxMlYxOUMyMi42NjI0IDE5IDIzLjI5OTEgMTguNzM2NiAyMy43NjUzIDE4LjI3MDRMMjYuMjcwNCAyMC43NzUzQzI2LjczNjYgMjEuMjk5MSAyNi4wMDAyIDIyIDI1LjE5NjEgMjJIMTJDMTAuMzQzMSAyMiA5IDIwLjY1NjkgOSAxOVYxMkM5IDEwLjM0MzEgMTAuMzQzMSA5IDEyIDlaIiBmaWxsPSIjY2JkNWUxIi8+CjxjaXJjbGUgY3g9IjE0IiBjeT0iMTQiIHI9IjIiIGZpbGw9IiM5NGEzYjgiLz4KPC9zdmc+Cg==';
  export let errorSrc: string | null = null;
  export let loading: 'lazy' | 'eager' = 'lazy';
  export let rootMargin: string = '50px';
  export let threshold: number = 0.1;
  export let fadeIn: boolean = true;
  export let aspectRatio: string | null = null;
  export let sizes: string = '';
  export let srcset: string = '';
  
  // CSS classes
  export let containerClass: string = '';
  export let imageClass: string = '';
  
  // State
  let imageElement: HTMLImageElement;
  let containerElement: HTMLDivElement;
  let isLoaded = false;
  let isError = false;
  let isIntersecting = false;
  let observer: IntersectionObserver | null = null;
  
  const dispatch = createEventDispatcher<{
    load: { src: string };
    error: { src: string; error: Event };
    intersect: { isIntersecting: boolean };
  }>();

  // Current source to display
  $: currentSrc = isError && errorSrc ? errorSrc : (isLoaded || loading === 'eager' || isIntersecting) ? src : placeholder;

  onMount(() => {
    if (!browser) return;

    // Setup intersection observer for lazy loading
    if (loading === 'lazy' && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              isIntersecting = true;
              dispatch('intersect', { isIntersecting: true });
              observer?.unobserve(entry.target);
            }
          });
        },
        {
          rootMargin,
          threshold
        }
      );

      if (containerElement) {
        observer.observe(containerElement);
      }
    } else {
      // For eager loading or when IntersectionObserver is not supported
      isIntersecting = true;
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  });

  function handleLoad(event: Event) {
    isLoaded = true;
    isError = false;
    dispatch('load', { src });
  }

  function handleError(event: Event) {
    isError = true;
    dispatch('error', { src, error: event });
  }

  // Preload high-priority images
  function preloadImage(src: string) {
    const img = new Image();
    img.src = src;
  }

  // Retry loading
  export function retry() {
    if (isError) {
      isError = false;
      isLoaded = false;
      // Force re-render by updating src
      if (imageElement) {
        imageElement.src = '';
        imageElement.src = src;
      }
    }
  }
</script>

<div
  bind:this={containerElement}
  class="lazy-image-container {containerClass}"
  class:aspect-ratio={aspectRatio}
  style:aspect-ratio={aspectRatio}
>
  <img
    bind:this={imageElement}
    src={currentSrc}
    {alt}
    {sizes}
    srcset={srcset || ''}
    class="lazy-image {imageClass}"
    class:fade-in={fadeIn}
    class:loaded={isLoaded}
    class:error={isError}
    on:load={handleLoad}
    on:error={handleError}
    loading={loading}
    decoding="async"
  />
  
  {#if !isLoaded && !isError && (isIntersecting || loading === 'eager')}
    <div class="loading-indicator">
      <div class="loading-spinner"></div>
    </div>
  {/if}
  
  {#if isError}
    <div class="error-overlay">
      <div class="error-content">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14.5 10a4.5 4.5 0 0 0-4.5-4.5"/>
          <path d="M14.5 10a4.5 4.5 0 0 1-4.5 4.5"/>
          <line x1="2" x2="22" y1="2" y2="22"/>
        </svg>
        <p>Не удалось загрузить изображение</p>
        <button type="button" on:click={retry} class="retry-button">
          Повторить
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .lazy-image-container {
    position: relative;
    overflow: hidden;
    display: inline-block;
    background-color: #f1f5f9;
  }

  .lazy-image-container.aspect-ratio {
    width: 100%;
    height: 0;
  }

  .lazy-image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.3s ease;
  }

  .lazy-image.fade-in {
    opacity: 0;
  }

  .lazy-image.fade-in.loaded {
    opacity: 1;
  }

  .lazy-image.error {
    opacity: 0;
  }

  .loading-indicator {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f8fafc;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #e2e8f0;
    border-top: 2px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #fef2f2;
    color: #991b1b;
  }

  .error-content {
    text-align: center;
    padding: 1rem;
  }

  .error-content svg {
    margin: 0 auto 0.5rem;
    display: block;
    width: 24px;
    height: 24px;
  }

  .error-content p {
    font-size: 0.875rem;
    margin: 0.5rem 0;
    color: #7f1d1d;
  }

  .retry-button {
    background-color: #dc2626;
    color: white;
    border: none;
    padding: 0.25rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .retry-button:hover {
    background-color: #b91c1c;
  }

  /* Responsive improvements */
  @media (max-width: 640px) {
    .loading-spinner {
      width: 20px;
      height: 20px;
    }
    
    .error-content {
      padding: 0.75rem;
    }
    
    .error-content svg {
      width: 20px;
      height: 20px;
    }
    
    .error-content p {
      font-size: 0.8125rem;
    }
  }
</style>