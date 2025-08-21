<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { HelpCircle, X, ChevronRight, ChevronDown, ExternalLink } from 'lucide-svelte';
  import type { HelpContent, StyleConfig } from '$lib/types/help';
  import Tooltip from '../ui/Tooltip.svelte';

  export let content: HelpContent;
  export let compact: boolean = false;
  export let dismissible: boolean = true;
  export let expanded: boolean = false;
  export let className: string = '';

  let isExpanded = expanded;
  let isDismissed = false;

  const dispatch = createEventDispatcher();

  // Get type-specific styles
  function getTypeStyles(type: HelpContent['type']): StyleConfig {
    switch (type) {
      case 'tip':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          icon: 'text-blue-600'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          icon: 'text-yellow-600'
        };
      case 'info':
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          icon: 'text-gray-600'
        };
      case 'tutorial':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          icon: 'text-green-600'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          icon: 'text-gray-600'
        };
    }
  }

  function handleDismiss() {
    isDismissed = true;
    dispatch('dismiss');
  }

  function toggleExpanded() {
    isExpanded = !isExpanded;
  }

  $: styles = getTypeStyles(content.type);
</script>

{#if !isDismissed}
  {#if compact}
    <Tooltip content={content.content} maxWidth="max-w-sm">
      <button
        class="inline-flex items-center gap-1 text-sm {styles.icon} hover:{styles.text} {className}"
        on:click={toggleExpanded}
      >
        <HelpCircle class="h-4 w-4" />
        <span>{content.title}</span>
      </button>
    </Tooltip>
  {:else}
    <div class="{styles.bg} {styles.border} {styles.text} border rounded-lg p-4 {className}">
      <div class="flex items-start gap-3">
        <HelpCircle class="h-5 w-5 {styles.icon} flex-shrink-0 mt-0.5" />
        
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-2">
            <h4 class="font-medium text-sm">{content.title}</h4>
            
            <div class="flex items-center gap-2">
              {#if content.content}
                <button
                  on:click={toggleExpanded}
                  class="{styles.icon} hover:{styles.text} p-1 rounded"
                >
                  {#if isExpanded}
                    <ChevronDown class="h-4 w-4" />
                  {:else}
                    <ChevronRight class="h-4 w-4" />
                  {/if}
                </button>
              {/if}
              
              {#if dismissible}
                <button
                  on:click={handleDismiss}
                  class="{styles.icon} hover:{styles.text} p-1 rounded"
                >
                  <X class="h-4 w-4" />
                </button>
              {/if}
            </div>
          </div>

          {#if isExpanded || !content.content}
            <div class="space-y-3">
              {#if content.content}
                <p class="text-sm leading-relaxed">{content.content}</p>
              {/if}

              {#if content.links && content.links.length > 0}
                <div class="space-y-1">
                  {#each content.links as link}
                    <a
                      href={link.url}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      class="inline-flex items-center gap-1 text-sm {styles.icon} hover:{styles.text} underline"
                    >
                      {link.label}
                      {#if link.external}
                        <ExternalLink class="h-3 w-3" />
                      {/if}
                    </a>
                  {/each}
                </div>
              {/if}

              {#if content.actions && content.actions.length > 0}
                <div class="flex items-center gap-2 pt-2">
                  {#each content.actions as action}
                    <button
                      on:click={action.action}
                      class="px-3 py-1 text-xs rounded {action.primary
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : `${styles.bg} ${styles.border} border hover:bg-opacity-80`}"
                    >
                      {action.label}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
{/if}