<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  import { createEventDispatcher, tick } from 'svelte';
  import { 
    format, 
    parseISO, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    isSameMonth, 
    isSameDay, 
    addMonths, 
    subMonths,
    isValid,
    parse
  } from 'date-fns';
  import { ru, enUS } from 'date-fns/locale';
  import { ChevronLeft, ChevronRight, Calendar } from 'lucide-svelte';

  export let value: string | Date | null = null;
  export let startDate: string | Date | null = null;
  export let endDate: string | Date | null = null;
  export let mode: 'single' | 'range' = 'single';
  export let locale: 'ru' | 'en' = 'ru';
  export let placeholder: string = 'Select date...';
  export let disabled: boolean = false;
  export let clearable: boolean = true;
  export let displayFormat: string = 'dd.MM.yyyy';
  export let minDate: string | Date | null = null;
  export let maxDate: string | Date | null = null;

  let className = '';
  export { className as class };

  const dispatch = createEventDispatcher<{
    change: { value: string | Date | null; startDate?: string | Date | null; endDate?: string | Date | null };
    open: void;
    close: void;
  }>();

  let isOpen = false;
  let currentMonth = new Date();
  let datePickerElement: HTMLDivElement;
  let inputValue = '';

  const localeMap = { ru, en: enUS };
  $: dateLocale = localeMap[locale];

  $: {
    if (mode === 'single' && value) {
      const dateObj = typeof value === 'string' ? parseISO(value) : value;
      if (isValid(dateObj)) {
        inputValue = format(dateObj, displayFormat, { locale: dateLocale });
        currentMonth = dateObj;
      }
    } else if (mode === 'range' && (startDate || endDate)) {
      if (startDate && endDate) {
        const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
        const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
        if (isValid(start) && isValid(end)) {
          inputValue = `${format(start, displayFormat, { locale: dateLocale })} - ${format(end, displayFormat, { locale: dateLocale })}`;
          currentMonth = start;
        }
      } else if (startDate) {
        const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
        if (isValid(start)) {
          inputValue = format(start, displayFormat, { locale: dateLocale }) + ' - ...';
          currentMonth = start;
        }
      }
    } else {
      inputValue = '';
    }
  }

  // Generate calendar days
  $: calendarDays = (() => {
    const start = startOfWeek(startOfMonth(currentMonth), { locale: dateLocale });
    const end = endOfWeek(endOfMonth(currentMonth), { locale: dateLocale });
    return eachDayOfInterval({ start, end });
  })();

  // Get month/year display
  $: monthYear = format(currentMonth, 'LLLL yyyy', { locale: dateLocale });

  function toggleOpen() {
    if (disabled) return;
    
    if (isOpen) {
      closeCalendar();
    } else {
      openCalendar();
    }
  }

  async function openCalendar() {
    isOpen = true;
    dispatch('open');
  }

  function closeCalendar() {
    isOpen = false;
    dispatch('close');
  }

  function selectDate(date: Date) {
    if (isDateDisabled(date)) return;

    if (mode === 'single') {
      value = date;
      dispatch('change', { value: date });
      closeCalendar();
    } else if (mode === 'range') {
      if (!startDate || (startDate && endDate)) {
        // Start new range
        startDate = date;
        endDate = null;
        dispatch('change', { startDate: date, endDate: null });
      } else if (startDate && !endDate) {
        // Complete range
        if (date < (typeof startDate === 'string' ? parseISO(startDate) : startDate)) {
          // If selected date is before start, make it the new start
          endDate = startDate;
          startDate = date;
        } else {
          endDate = date;
        }
        dispatch('change', { startDate, endDate });
        closeCalendar();
      }
    }
  }

  function isDateDisabled(date: Date): boolean {
    if (minDate) {
      const min = typeof minDate === 'string' ? parseISO(minDate) : minDate;
      if (date < min) return true;
    }
    if (maxDate) {
      const max = typeof maxDate === 'string' ? parseISO(maxDate) : maxDate;
      if (date > max) return true;
    }
    return false;
  }

  function isDateSelected(date: Date): boolean {
    if (mode === 'single') {
      if (!value) return false;
      const selectedDate = typeof value === 'string' ? parseISO(value) : value;
      return isSameDay(date, selectedDate);
    } else {
      if (startDate && isSameDay(date, typeof startDate === 'string' ? parseISO(startDate) : startDate)) {
        return true;
      }
      if (endDate && isSameDay(date, typeof endDate === 'string' ? parseISO(endDate) : endDate)) {
        return true;
      }
      return false;
    }
  }

  function isDateInRange(date: Date): boolean {
    if (mode !== 'range' || !startDate || !endDate) return false;
    
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
    
    return date > start && date < end;
  }

  function clearDate() {
    if (mode === 'single') {
      value = null;
      dispatch('change', { value: null });
    } else {
      startDate = null;
      endDate = null;
      dispatch('change', { startDate: null, endDate: null });
    }
  }

  function navigateMonth(direction: 'prev' | 'next') {
    currentMonth = direction === 'next' 
      ? addMonths(currentMonth, 1)
      : subMonths(currentMonth, 1);
  }

  function handleInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const inputVal = target.value;
    
    if (!inputVal) {
      clearDate();
      return;
    }

    if (mode === 'single') {
      try {
        const parsed = parse(inputVal, displayFormat, new Date(), { locale: dateLocale });
        if (isValid(parsed) && !isDateDisabled(parsed)) {
          value = parsed;
          currentMonth = parsed;
          dispatch('change', { value: parsed });
        }
      } catch {
        // Invalid format, ignore
      }
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        if (!isOpen) {
          toggleOpen();
          event.preventDefault();
        }
        break;
      case 'Escape':
        if (isOpen) {
          closeCalendar();
          event.preventDefault();
        }
        break;
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (datePickerElement && !datePickerElement.contains(event.target as Node)) {
      closeCalendar();
    }
  }

  // Week day names
  $: weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(2023, 0, i + 1); // Start from Sunday
    return format(startOfWeek(date, { locale: dateLocale }), 'EEEEE', { locale: dateLocale });
  });

  $: containerClass = twMerge(
    clsx(
      'relative w-full',
      className
    )
  );

  $: inputClass = twMerge(
    clsx(
      'flex h-10 w-full items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
      'focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
      'placeholder:text-gray-500'
    )
  );

  $: calendarClass = twMerge(
    clsx(
      'absolute z-50 mt-1 w-80 rounded-md border border-gray-200 bg-white p-4 shadow-lg'
    )
  );
</script>

<svelte:window on:click={handleClickOutside} />

<div bind:this={datePickerElement} class={containerClass}>
  <!-- Input -->
  <div class="relative">
    <input
      type="text"
      class={inputClass}
      {placeholder}
      {disabled}
      value={inputValue}
      on:input={handleInputChange}
      on:click={toggleOpen}
      on:keydown={handleKeydown}
    />
    
    <button
      type="button"
      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      {disabled}
      on:click={toggleOpen}
    >
      <Calendar size={16} />
    </button>
    
    {#if clearable && inputValue && !disabled}
      <button
        type="button"
        class="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        on:click|stopPropagation={clearDate}
      >
        ×
      </button>
    {/if}
  </div>

  <!-- Calendar -->
  {#if isOpen}
    <div class={calendarClass}>
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <button
          type="button"
          class="p-1 rounded hover:bg-gray-100"
          on:click={() => navigateMonth('prev')}
        >
          <ChevronLeft size={20} />
        </button>
        
        <h3 class="text-lg font-semibold capitalize">
          {monthYear}
        </h3>
        
        <button
          type="button"
          class="p-1 rounded hover:bg-gray-100"
          on:click={() => navigateMonth('next')}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <!-- Week days -->
      <div class="grid grid-cols-7 gap-1 mb-2">
        {#each weekDays as day}
          <div class="text-center text-xs font-medium text-gray-500 py-2 uppercase">
            {day}
          </div>
        {/each}
      </div>

      <!-- Calendar days -->
      <div class="grid grid-cols-7 gap-1">
        {#each calendarDays as date}
          {@const isCurrentMonth = isSameMonth(date, currentMonth)}
          {@const isSelected = isDateSelected(date)}
          {@const isInRange = isDateInRange(date)}
          {@const isDisabled = isDateDisabled(date)}
          
          <button
            type="button"
            class={clsx(
              'relative h-10 w-10 text-sm rounded-md',
              'hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-600',
              !isCurrentMonth && 'text-gray-300',
              isCurrentMonth && !isDisabled && 'text-gray-900',
              isDisabled && 'text-gray-300 cursor-not-allowed',
              isSelected && 'bg-blue-600 text-white hover:bg-blue-700',
              isInRange && !isSelected && 'bg-blue-100 text-blue-900',
              !isDisabled && !isSelected && !isInRange && 'hover:bg-gray-100'
            )}
            disabled={isDisabled}
            on:click={() => selectDate(date)}
          >
            {format(date, 'd')}
          </button>
        {/each}
      </div>

      <!-- Footer for range mode -->
      {#if mode === 'range'}
        <div class="mt-4 pt-4 border-t border-gray-200">
          <div class="flex justify-between text-xs text-gray-500">
            <span>Start: {startDate ? format(typeof startDate === 'string' ? parseISO(startDate) : startDate, displayFormat, { locale: dateLocale }) : 'Not selected'}</span>
            <span>End: {endDate ? format(typeof endDate === 'string' ? parseISO(endDate) : endDate, displayFormat, { locale: dateLocale }) : 'Not selected'}</span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>