import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Select from '../Select.svelte';

const mockOptions = [
  { value: '1', label: 'Option 1' },
  { value: '2', label: 'Option 2' },
  { value: '3', label: 'Option 3', disabled: true },
  { value: '4', label: 'Option 4' }
];

describe('Select Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default props', () => {
    const { getByRole } = render(Select, { 
      props: { options: mockOptions } 
    });
    const combobox = getByRole('combobox');
    
    expect(combobox).toBeInTheDocument();
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).toHaveTextContent('Select option...');
  });

  it('opens dropdown on click', async () => {
    const { getByRole, getByText } = render(Select, { 
      props: { options: mockOptions } 
    });
    const combobox = getByRole('combobox');
    
    await fireEvent.click(combobox);
    
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    expect(getByText('Option 1')).toBeInTheDocument();
    expect(getByText('Option 2')).toBeInTheDocument();
  });

  it('selects single option correctly', async () => {
    const { getByRole, getByText, component } = render(Select, { 
      props: { options: mockOptions } 
    });
    const changeHandler = vi.fn();
    component.$on('change', changeHandler);
    
    const combobox = getByRole('combobox');
    await fireEvent.click(combobox);
    
    const option = getByText('Option 1');
    await fireEvent.click(option);
    
    expect(changeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          value: '1',
          selected: { value: '1', label: 'Option 1' }
        }
      })
    );
    expect(combobox).toHaveTextContent('Option 1');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('handles multiple selection', async () => {
    const { getByRole, getByText, component } = render(Select, { 
      props: { options: mockOptions, multiple: true } 
    });
    const changeHandler = vi.fn();
    component.$on('change', changeHandler);
    
    const combobox = getByRole('combobox');
    await fireEvent.click(combobox);
    
    // Select first option
    await fireEvent.click(getByText('Option 1'));
    expect(changeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          value: ['1'],
          selected: [{ value: '1', label: 'Option 1' }]
        }
      })
    );
    
    // Select second option
    await fireEvent.click(getByText('Option 2'));
    expect(changeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          value: ['1', '2'],
          selected: expect.arrayContaining([
            { value: '1', label: 'Option 1' },
            { value: '2', label: 'Option 2' }
          ])
        }
      })
    );
    
    expect(combobox).toHaveTextContent('2 selected');
  });

  it('handles disabled state', async () => {
    const { getByRole } = render(Select, { 
      props: { options: mockOptions, disabled: true } 
    });
    const combobox = getByRole('combobox');
    
    expect(combobox).toHaveAttribute('tabindex', '-1');
    expect(combobox).toHaveClass('disabled:cursor-not-allowed');
    
    await fireEvent.click(combobox);
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('handles disabled options', async () => {
    const { getByRole, getByText, component } = render(Select, { 
      props: { options: mockOptions } 
    });
    const changeHandler = vi.fn();
    component.$on('change', changeHandler);
    
    const combobox = getByRole('combobox');
    await fireEvent.click(combobox);
    
    const disabledOption = getByText('Option 3');
    expect(disabledOption).toHaveClass('opacity-50', 'cursor-not-allowed');
    
    await fireEvent.click(disabledOption);
    expect(changeHandler).not.toHaveBeenCalled();
  });

  it('handles searchable functionality', async () => {
    const { getByRole, getByPlaceholderText, getByText, queryByText } = render(Select, { 
      props: { options: mockOptions, searchable: true, searchPlaceholder: 'Search options...' } 
    });
    const combobox = getByRole('combobox');
    
    await fireEvent.click(combobox);
    
    const searchInput = getByPlaceholderText('Search options...');
    expect(searchInput).toBeInTheDocument();
    
    // Search for "Option 1"
    await fireEvent.input(searchInput, { target: { value: 'Option 1' } });
    
    expect(getByText('Option 1')).toBeInTheDocument();
    expect(queryByText('Option 2')).not.toBeInTheDocument();
  });

  it('handles clearable functionality', async () => {
    const { getByRole, component, container } = render(Select, { 
      props: { options: mockOptions, clearable: true, value: '1' } 
    });
    const changeHandler = vi.fn();
    component.$on('change', changeHandler);
    
    const combobox = getByRole('combobox');
    expect(combobox).toHaveTextContent('Option 1');
    
    // Find and click clear button
    const clearButton = container.querySelector('button');
    expect(clearButton).toBeInTheDocument();
    
    await fireEvent.click(clearButton!);
    
    expect(changeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          value: '',
          selected: null
        }
      })
    );
  });

  it('handles keyboard navigation', async () => {
    const { getByRole, getByText } = render(Select, { 
      props: { options: mockOptions } 
    });
    const combobox = getByRole('combobox');
    
    // Open with Enter
    await fireEvent.keyDown(combobox, { key: 'Enter' });
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    
    // Navigate down
    await fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    expect(getByText('Option 1')).toHaveClass('bg-blue-50');
    
    // Navigate down again
    await fireEvent.keyDown(combobox, { key: 'ArrowDown' });
    expect(getByText('Option 2')).toHaveClass('bg-blue-50');
    
    // Navigate up
    await fireEvent.keyDown(combobox, { key: 'ArrowUp' });
    expect(getByText('Option 1')).toHaveClass('bg-blue-50');
    
    // Close with Escape
    await fireEvent.keyDown(combobox, { key: 'Escape' });
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('handles different sizes', () => {
    const sizes = [
      { size: 'sm', expectedClass: 'h-8' },
      { size: 'md', expectedClass: 'h-10' },
      { size: 'lg', expectedClass: 'h-12' }
    ];

    sizes.forEach(({ size, expectedClass }) => {
      const { getByRole } = render(Select, { 
        props: { options: mockOptions, size: size as any } 
      });
      const combobox = getByRole('combobox');
      expect(combobox).toHaveClass(expectedClass);
    });
  });

  it('shows error state', () => {
    const { getByRole } = render(Select, { 
      props: { options: mockOptions, hasError: true, id: 'test-select' } 
    });
    const combobox = getByRole('combobox');
    
    expect(combobox).toHaveClass('border-red-300', 'bg-red-50');
    expect(combobox).toHaveAttribute('aria-invalid', 'true');
    expect(combobox).toHaveAttribute('aria-describedby', 'test-select-error');
  });

  it('shows loading state', () => {
    const { getByText, container } = render(Select, { 
      props: { options: [], loading: true } 
    });
    const combobox = container.querySelector('[role="combobox"]');
    
    fireEvent.click(combobox!);
    
    expect(getByText('Loading...')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows no options message when empty', async () => {
    const { getByRole, getByText } = render(Select, { 
      props: { options: [], noOptionsText: 'No data available' } 
    });
    const combobox = getByRole('combobox');
    
    await fireEvent.click(combobox);
    
    expect(getByText('No data available')).toBeInTheDocument();
  });

  it('handles async options loading', async () => {
    const loadOptions = vi.fn().mockResolvedValue([
      { value: 'async1', label: 'Async Option 1' },
      { value: 'async2', label: 'Async Option 2' }
    ]);
    
    const { getByRole, getByPlaceholderText, getByText, component } = render(Select, { 
      props: { 
        options: [], 
        searchable: true, 
        loadOptions,
        searchPlaceholder: 'Search...'
      } 
    });
    
    const searchHandler = vi.fn();
    component.$on('search', searchHandler);
    
    const combobox = getByRole('combobox');
    await fireEvent.click(combobox);
    
    const searchInput = getByPlaceholderText('Search...');
    await fireEvent.input(searchInput, { target: { value: 'test' } });
    
    expect(searchHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { query: 'test' }
      })
    );
    
    await waitFor(() => {
      expect(loadOptions).toHaveBeenCalledWith('test');
    });
    
    await waitFor(() => {
      expect(getByText('Async Option 1')).toBeInTheDocument();
    });
  });

  it('dispatches open and close events', async () => {
    const { getByRole, component } = render(Select, { 
      props: { options: mockOptions } 
    });
    const openHandler = vi.fn();
    const closeHandler = vi.fn();
    
    component.$on('open', openHandler);
    component.$on('close', closeHandler);
    
    const combobox = getByRole('combobox');
    
    // Open dropdown
    await fireEvent.click(combobox);
    expect(openHandler).toHaveBeenCalled();
    
    // Close dropdown
    await fireEvent.keyDown(combobox, { key: 'Escape' });
    expect(closeHandler).toHaveBeenCalled();
  });

  it('closes dropdown on outside click', async () => {
    const { getByRole } = render(Select, { 
      props: { options: mockOptions } 
    });
    const combobox = getByRole('combobox');
    
    // Open dropdown
    await fireEvent.click(combobox);
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    
    // Click outside
    await fireEvent.click(document.body);
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('applies custom CSS classes', () => {
    const { getByRole } = render(Select, { 
      props: { options: mockOptions, class: 'custom-select-class' } 
    });
    const container = getByRole('combobox').closest('.relative');
    
    expect(container).toHaveClass('custom-select-class');
  });

  it('maintains accessibility attributes', () => {
    const { getByRole } = render(Select, { 
      props: { 
        options: mockOptions, 
        id: 'test-select',
        name: 'test-name'
      } 
    });
    const combobox = getByRole('combobox');
    
    expect(combobox).toHaveAttribute('role', 'combobox');
    expect(combobox).toHaveAttribute('aria-haspopup', 'listbox');
    expect(combobox).toHaveAttribute('id', 'test-select');
    expect(combobox).toHaveAttribute('name', 'test-name');
  });
});