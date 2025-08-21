import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Table from '../Table.svelte';

describe('Table Component', () => {
  it('renders with default props', () => {
    const { container } = render(Table, {
      props: {
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    const tableWrapper = container.querySelector('.relative.w-full.overflow-auto');
    const table = container.querySelector('table');
    
    expect(tableWrapper).toBeInTheDocument();
    expect(table).toBeInTheDocument();
    expect(table).toHaveClass('w-full', 'caption-bottom', 'text-sm');
  });

  it('applies custom CSS classes', () => {
    const { container } = render(Table, { 
      props: { 
        class: 'custom-table-class',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const table = container.querySelector('table');
    expect(table).toHaveClass('custom-table-class');
    expect(table).toHaveClass('w-full', 'caption-bottom', 'text-sm'); // Still has base classes
  });

  it('has overflow wrapper for responsiveness', () => {
    const { container } = render(Table, {
      props: {
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    const wrapper = container.querySelector('.relative.w-full.overflow-auto');
    expect(wrapper).toBeInTheDocument();
    
    const table = wrapper?.querySelector('table');
    expect(table).toBeInTheDocument();
  });

  it('passes through additional props', () => {
    const { container } = render(Table, { 
      props: { 
        'data-testid': 'custom-table',
        'aria-label': 'Custom table',
        role: 'grid',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const table = container.querySelector('table');
    expect(table).toHaveAttribute('data-testid', 'custom-table');
    expect(table).toHaveAttribute('aria-label', 'Custom table');
    expect(table).toHaveAttribute('role', 'grid');
  });

  it('renders slot content', () => {
    const slotContent = `
      <thead>
        <tr>
          <th>Header 1</th>
          <th>Header 2</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Cell 1</td>
          <td>Cell 2</td>
        </tr>
      </tbody>
    `;
    
    const { getByText, container } = render(Table, {
      props: {
        $$slots: { default: [slotContent] },
        $$scope: { ctx: [slotContent] }
      }
    });
    
    expect(getByText('Header 1')).toBeInTheDocument();
    expect(getByText('Header 2')).toBeInTheDocument();
    expect(getByText('Cell 1')).toBeInTheDocument();
    expect(getByText('Cell 2')).toBeInTheDocument();
    
    const thead = container.querySelector('thead');
    const tbody = container.querySelector('tbody');
    expect(thead).toBeInTheDocument();
    expect(tbody).toBeInTheDocument();
  });

  it('maintains proper table structure', () => {
    const { container } = render(Table, {
      props: {
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('relative', 'w-full', 'overflow-auto');
    
    const table = wrapper?.firstElementChild;
    expect(table?.tagName).toBe('TABLE');
    expect(table).toHaveClass('w-full', 'caption-bottom', 'text-sm');
  });

  it('combines custom classes with default classes properly', () => {
    const { container } = render(Table, { 
      props: { 
        class: 'border border-gray-200 rounded-lg',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    
    const table = container.querySelector('table');
    expect(table).toHaveClass('w-full', 'caption-bottom', 'text-sm'); // Default classes
    expect(table).toHaveClass('border', 'border-gray-200', 'rounded-lg'); // Custom classes
  });

  it('maintains accessibility for table structure', () => {
    const { container } = render(Table, {
      props: {
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    const table = container.querySelector('table');
    expect(table?.tagName).toBe('TABLE');
    
    // The table should be in a scrollable container for accessibility
    const scrollableContainer = table?.parentElement;
    expect(scrollableContainer).toHaveClass('overflow-auto');
  });
});