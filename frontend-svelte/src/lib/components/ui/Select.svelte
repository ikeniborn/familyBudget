<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  import { createEventDispatcher, tick } from 'svelte';
  import { ChevronDown, X, Check } from 'lucide-svelte';

  interface Option {
    value: string | number;
    label: string;
    disabled?: boolean;
  }

  export let options: Option[] = [];
  export let value: string | number | (string | number)[] = '';
  export let placeholder: string = 'Select option...';
  export let disabled: boolean = false;
  export let multiple: boolean = false;
  export let searchable: boolean = false;
  export let clearable: boolean = false;
  export let loading: boolean = false;
  export let loadOptions: ((query: string) => Promise<Option[]>) | undefined = undefined;
  export let searchPlaceholder: string = 'Search...';
  export let noOptionsText: string = 'No options found';
  export let maxHeight: string = 'max-h-60';
  export let hasError: boolean = false;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let id: string | undefined = undefined;
  export let name: string | undefined = undefined;

  let className = '';
  export { className as class };

  const dispatch = createEventDispatcher<{
    change: { value: typeof value; selected: Option | Option[] };
    search: { query: string };
    open: void;
    close: void;
  }>();

  let isOpen = false;
  let searchQuery = '';
  let filteredOptions = options;
  let selectElement: HTMLDivElement;
  let searchInput: HTMLInputElement;
  let activeIndex = -1;
  let isLoadingOptions = false;

  $: selectedOptions = multiple 
    ? options.filter(opt => Array.isArray(value) && value.includes(opt.value))
    : options.find(opt => opt.value === value);

  $: selectedLabels = multiple && Array.isArray(selectedOptions)
    ? selectedOptions.map(opt => opt.label)
    : selectedOptions && !Array.isArray(selectedOptions)
    ? [selectedOptions.label]
    : [];

  $: displayValue = selectedLabels.length > 0
    ? selectedLabels.length === 1
      ? selectedLabels[0]
      : `${selectedLabels.length} selected`
    : placeholder;

  $: {
    if (loadOptions && searchQuery) {
      handleAsyncSearch();
    } else if (searchable) {
      filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
    } else {
      filteredOptions = options;
    }
  }

  async function handleAsyncSearch() {
    if (!loadOptions) return;
    
    isLoadingOptions = true;
    try {
      const results = await loadOptions(searchQuery);
      filteredOptions = results;
    } catch (error) {
      console.error('Failed to load options:', error);
      filteredOptions = [];
    } finally {
      isLoadingOptions = false;
    }
  }

  function toggleOpen() {
    if (disabled) return;
    
    if (isOpen) {
      closeSelect();
    } else {
      openSelect();
    }
  }

  async function openSelect() {
    isOpen = true;
    activeIndex = -1;
    dispatch('open');
    
    if (searchable) {
      await tick();
      searchInput?.focus();
    }
  }

  function closeSelect() {
    isOpen = false;
    searchQuery = '';
    activeIndex = -1;
    dispatch('close');
  }

  function selectOption(option: Option) {
    if (option.disabled) return;

    let newValue: typeof value;
    let selected: Option | Option[];

    if (multiple) {
      const currentArray = Array.isArray(value) ? value : [];
      if (currentArray.includes(option.value)) {
        newValue = currentArray.filter(v => v !== option.value);
      } else {
        newValue = [...currentArray, option.value];
      }
      selected = options.filter(opt => Array.isArray(newValue) && newValue.includes(opt.value));
    } else {
      newValue = option.value;
      selected = option;
      closeSelect();
    }

    value = newValue;
    dispatch('change', { value: newValue, selected });
  }

  function clearSelection() {
    const newValue = multiple ? [] : '';
    const selected = multiple ? [] : null;
    value = newValue;
    dispatch('change', { value: newValue, selected: selected as Option | Option[] });
  }

  function handleKeydown(event: KeyboardEvent) {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        if (!isOpen) {
          openSelect();
        } else if (activeIndex >= 0) {
          selectOption(filteredOptions[activeIndex]);
        }
        event.preventDefault();
        break;
      case 'Escape':
        closeSelect();
        event.preventDefault();
        break;
      case 'ArrowDown':
        if (!isOpen) {
          openSelect();
        } else {
          activeIndex = Math.min(activeIndex + 1, filteredOptions.length - 1);
        }
        event.preventDefault();
        break;
      case 'ArrowUp':
        if (isOpen) {
          activeIndex = Math.max(activeIndex - 1, -1);
        }
        event.preventDefault();
        break;
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (selectElement && !selectElement.contains(event.target as Node)) {
      closeSelect();
    }
  }

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchQuery = target.value;
    activeIndex = -1;
    dispatch('search', { query: searchQuery });
  }

  $: selectClass = twMerge(
    clsx(
      'relative w-full',
      className
    )
  );

  $: triggerClass = twMerge(
    clsx(
      'flex w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-colors duration-200',
      // Size variants
      {
        'h-8 text-xs px-2': size === 'sm',
        'h-10 text-sm px-3': size === 'md',
        'h-12 text-base px-4': size === 'lg',
      },
      // Error/normal states
      {
        'border-gray-300 focus:ring-blue-600 focus:border-blue-500': !hasError,
        'border-red-300 focus:ring-red-600 focus:border-red-500 bg-red-50': hasError,
      },
      // Open state
      {
        'ring-2 ring-offset-2': isOpen,
        'ring-blue-600': isOpen && !hasError,
        'ring-red-600': isOpen && hasError,
      },
      // Disabled state
      disabled && 'bg-gray-50'
    )
  );

  $: dropdownClass = twMerge(
    clsx(
      'absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg',
      maxHeight,
      'overflow-auto'
    )
  );
</script>

<svelte:window on:click={handleClickOutside} />

<div bind:this={selectElement} class={selectClass}>
  <!-- Trigger -->
  <div
    class={triggerClass}
    tabindex={disabled ? -1 : 0}
    role="combobox"
    aria-expanded={isOpen}
    aria-haspopup="listbox"
    aria-invalid={hasError}
    aria-describedby={hasError && id ? `${id}-error` : undefined}
    {id}
    on:click={toggleOpen}
    on:keydown={handleKeydown}
  >
    <span class={clsx('truncate', !selectedLabels.length && 'text-gray-500')}>
      {displayValue}
    </span>
    
    <div class="flex items-center space-x-1">
      {#if clearable && selectedLabels.length > 0 && !disabled}
        <button
          type="button"
          class="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:text-gray-600"
          on:click|stopPropagation={clearSelection}
        >
          <X size={14} />
        </button>
      {/if}
      
      <div class={clsx('transition-transform duration-200', isOpen && 'rotate-180')}>
        <ChevronDown size={16} class="text-gray-400" />
      </div>
    </div>
  </div>

  <!-- Dropdown -->
  {#if isOpen}
    <div class={dropdownClass}>
      {#if searchable}
        <div class="px-3 py-2 border-b border-gray-100">
          <input
            bind:this={searchInput}
            type="text"
            class="w-full text-sm border-0 outline-none placeholder-gray-500"
            placeholder={searchPlaceholder}
            value={searchQuery}
            on:input={handleSearchInput}
          />
        </div>
      {/if}

      {#if loading || isLoadingOptions}
        <div class="flex items-center justify-center py-4">
          <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span class="ml-2 text-sm text-gray-500">Loading...</span>
        </div>
      {:else if filteredOptions.length === 0}
        <div class="py-4 text-center text-sm text-gray-500">
          {noOptionsText}
        </div>
      {:else}
        <div role="listbox" class="py-1">
          {#each filteredOptions as option, index}
            {@const isSelected = multiple 
              ? Array.isArray(value) && value.includes(option.value)
              : value === option.value}
            {@const isActive = index === activeIndex}
            
            <div
              role="option"
              aria-selected={isSelected}
              class={clsx(
                'flex items-center justify-between px-3 py-2 text-sm cursor-pointer',
                'hover:bg-gray-50',
                isActive && 'bg-blue-50',
                option.disabled && 'opacity-50 cursor-not-allowed',
                isSelected && 'bg-blue-50 text-blue-900'
              )}
              on:click={() => selectOption(option)}
              on:mouseenter={() => activeIndex = index}
            >
              <span class="truncate">{option.label}</span>
              {#if isSelected}
                <Check size={16} class="text-blue-600" />
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>