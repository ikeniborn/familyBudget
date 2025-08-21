import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { renderComponent } from '$test/utils';
import Button from '../Button.svelte';

describe('Button Component', () => {
  it('renders with default props', () => {
    const { getByRole } = render(Button, { props: { children: 'Click me' } });
    const button = getByRole('button');
    
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Click me');
    expect(button).toHaveClass('bg-blue-600', 'text-white');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('renders different variants correctly', () => {
    const variants = [
      { variant: 'default', expectedClass: 'bg-blue-600' },
      { variant: 'destructive', expectedClass: 'bg-red-600' },
      { variant: 'outline', expectedClass: 'border-gray-300' },
      { variant: 'secondary', expectedClass: 'bg-gray-100' },
      { variant: 'ghost', expectedClass: 'hover:bg-slate-100' },
      { variant: 'link', expectedClass: 'text-blue-600' }
    ];

    variants.forEach(({ variant, expectedClass }) => {
      const { getByRole } = render(Button, { 
        props: { variant: variant as any, children: 'Test' } 
      });
      const button = getByRole('button');
      expect(button).toHaveClass(expectedClass);
    });
  });

  it('renders different sizes correctly', () => {
    const sizes = [
      { size: 'default', expectedClass: 'h-10' },
      { size: 'sm', expectedClass: 'h-9' },
      { size: 'lg', expectedClass: 'h-11' },
      { size: 'icon', expectedClass: 'h-10 w-10' }
    ];

    sizes.forEach(({ size, expectedClass }) => {
      const { getByRole } = render(Button, { 
        props: { size: size as any, children: 'Test' } 
      });
      const button = getByRole('button');
      expect(button).toHaveClass(expectedClass);
    });
  });

  it('handles disabled state', () => {
    const { getByRole } = render(Button, { 
      props: { disabled: true, children: 'Disabled' } 
    });
    const button = getByRole('button');
    
    expect(button).toBeDisabled();
    expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50');
  });

  it('shows loading state', () => {
    const { getByRole, container } = render(Button, { 
      props: { loading: true, children: 'Loading' } 
    });
    const button = getByRole('button');
    const spinner = container.querySelector('svg.animate-spin');
    
    expect(button).toBeInTheDocument();
    expect(spinner).toBeInTheDocument();
  });

  it('renders as link when href is provided', () => {
    const { getByRole } = render(Button, { 
      props: { href: '/test-url', children: 'Link Button' } 
    });
    const link = getByRole('link');
    
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test-url');
    expect(link).toHaveTextContent('Link Button');
  });

  it('does not render as link when disabled and href is provided', () => {
    const { getByRole } = render(Button, { 
      props: { href: '/test-url', disabled: true, children: 'Disabled Link' } 
    });
    const button = getByRole('button');
    
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const { getByRole, component } = render(Button, { 
      props: { children: 'Click me' } 
    });
    
    component.$on('click', handleClick);
    const button = getByRole('button');
    
    await fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not handle click when disabled', async () => {
    const handleClick = vi.fn();
    const { getByRole, component } = render(Button, { 
      props: { disabled: true, children: 'Disabled' } 
    });
    
    component.$on('click', handleClick);
    const button = getByRole('button');
    
    await fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies custom CSS classes', () => {
    const { getByRole } = render(Button, { 
      props: { class: 'custom-class', children: 'Custom' } 
    });
    const button = getByRole('button');
    
    expect(button).toHaveClass('custom-class');
  });

  it('sets correct button type', () => {
    const types = ['button', 'submit', 'reset'];
    
    types.forEach(type => {
      const { getByRole } = render(Button, { 
        props: { type: type as any, children: 'Test' } 
      });
      const button = getByRole('button');
      expect(button).toHaveAttribute('type', type);
    });
  });

  it('passes through additional props', () => {
    const { getByRole } = render(Button, { 
      props: { 
        'data-testid': 'custom-button',
        'aria-label': 'Custom button',
        children: 'Test' 
      } 
    });
    const button = getByRole('button');
    
    expect(button).toHaveAttribute('data-testid', 'custom-button');
    expect(button).toHaveAttribute('aria-label', 'Custom button');
  });

  it('maintains focus states for accessibility', () => {
    const { getByRole } = render(Button, { 
      props: { children: 'Focus test' } 
    });
    const button = getByRole('button');
    
    expect(button).toHaveClass(
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-offset-2'
    );
  });
});