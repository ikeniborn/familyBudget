import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Card from '../Card.svelte';

describe('Card Component', () => {
  it('renders with default props', () => {
    const { container } = render(Card, {
      props: {
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    const card = container.firstElementChild;
    
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('rounded-lg', 'bg-white', 'shadow-lg');
  });

  it('renders different variants correctly', () => {
    const variants = [
      { variant: 'default', expectedClass: null },
      { variant: 'blue', expectedClass: 'border-l-blue-500' },
      { variant: 'green', expectedClass: 'border-l-green-500' },
      { variant: 'red', expectedClass: 'border-l-red-500' },
      { variant: 'purple', expectedClass: 'border-l-purple-500' }
    ];

    variants.forEach(({ variant, expectedClass }) => {
      const { container } = render(Card, { 
        props: { 
          variant: variant as any,
          $$slots: { default: true },
          $$scope: { ctx: [] }
        } 
      });
      const card = container.firstElementChild;
      
      if (expectedClass) {
        expect(card).toHaveClass(expectedClass, 'border-l-4');
      } else {
        expect(card).not.toHaveClass('border-l-4');
      }
    });
  });

  it('applies custom CSS classes', () => {
    const { container } = render(Card, { 
      props: { 
        class: 'custom-card-class',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    const card = container.firstElementChild;
    
    expect(card).toHaveClass('custom-card-class');
    expect(card).toHaveClass('rounded-lg', 'bg-white', 'shadow-lg'); // Still has base classes
  });

  it('renders slot content', () => {
    const slotContent = 'Card content goes here';
    const { getByText } = render(Card, {
      props: {
        $$slots: { default: [slotContent] },
        $$scope: { ctx: [slotContent] }
      }
    });
    
    expect(getByText(slotContent)).toBeInTheDocument();
  });

  it('passes through additional props', () => {
    const { container } = render(Card, { 
      props: { 
        'data-testid': 'custom-card',
        'aria-label': 'Custom card',
        role: 'region',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    const card = container.firstElementChild;
    
    expect(card).toHaveAttribute('data-testid', 'custom-card');
    expect(card).toHaveAttribute('aria-label', 'Custom card');
    expect(card).toHaveAttribute('role', 'region');
  });

  it('combines variant classes with custom classes correctly', () => {
    const { container } = render(Card, { 
      props: { 
        variant: 'blue',
        class: 'p-4 m-2',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      } 
    });
    const card = container.firstElementChild;
    
    expect(card).toHaveClass('rounded-lg', 'bg-white', 'shadow-lg');
    expect(card).toHaveClass('border-l-4', 'border-l-blue-500');
    expect(card).toHaveClass('p-4', 'm-2');
  });

  it('handles all color variants with correct border styles', () => {
    const colorVariants = [
      { variant: 'blue', border: 'border-l-blue-500' },
      { variant: 'green', border: 'border-l-green-500' },
      { variant: 'red', border: 'border-l-red-500' },
      { variant: 'purple', border: 'border-l-purple-500' }
    ];

    colorVariants.forEach(({ variant, border }) => {
      const { container } = render(Card, { 
        props: { 
          variant: variant as any,
          $$slots: { default: true },
          $$scope: { ctx: [] }
        } 
      });
      const card = container.firstElementChild;
      
      expect(card).toHaveClass(border);
      expect(card).toHaveClass('border-l-4'); // All colored variants have left border
    });
  });

  it('maintains base styling across all variants', () => {
    const allVariants = ['default', 'blue', 'green', 'red', 'purple'];
    
    allVariants.forEach(variant => {
      const { container } = render(Card, { 
        props: { 
          variant: variant as any,
          $$slots: { default: true },
          $$scope: { ctx: [] }
        } 
      });
      const card = container.firstElementChild;
      
      // Base classes should always be present
      expect(card).toHaveClass('rounded-lg', 'bg-white', 'shadow-lg');
    });
  });
});