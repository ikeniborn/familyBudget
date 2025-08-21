import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Input from '../Input.svelte';

describe('Input Component', () => {
  it('renders with default props', () => {
    const { getByRole } = render(Input);
    const input = getByRole('textbox');
    
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
    expect(input).not.toBeDisabled();
    expect(input).not.toBeRequired();
  });

  it('renders with custom type', () => {
    const { container } = render(Input, { props: { type: 'email' } });
    const input = container.querySelector('input[type="email"]');
    
    expect(input).toBeInTheDocument();
  });

  it('renders with placeholder', () => {
    const placeholder = 'Enter your email';
    const { getByPlaceholderText } = render(Input, { props: { placeholder } });
    
    expect(getByPlaceholderText(placeholder)).toBeInTheDocument();
  });

  it('handles value prop and binding', async () => {
    const { getByRole, component } = render(Input, { props: { value: 'initial' } });
    const input = getByRole('textbox') as HTMLInputElement;
    
    expect(input.value).toBe('initial');
    
    // Test value binding by updating the prop
    await component.$set({ value: 'updated' });
    expect(input.value).toBe('updated');
  });

  it('handles user input and fires events', async () => {
    const user = userEvent.setup();
    const inputHandler = vi.fn();
    const changeHandler = vi.fn();
    
    const { getByRole, component } = render(Input);
    const input = getByRole('textbox');
    
    component.$on('input', inputHandler);
    component.$on('change', changeHandler);
    
    await user.type(input, 'hello');
    
    expect(inputHandler).toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe('hello');
  });

  it('handles disabled state', () => {
    const { getByRole } = render(Input, { props: { disabled: true } });
    const input = getByRole('textbox');
    
    expect(input).toBeDisabled();
    expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50');
  });

  it('handles required state', () => {
    const { getByRole } = render(Input, { props: { required: true } });
    const input = getByRole('textbox');
    
    expect(input).toBeRequired();
  });

  it('handles readonly state', () => {
    const { getByRole } = render(Input, { props: { readonly: true } });
    const input = getByRole('textbox');
    
    expect(input).toHaveAttribute('readonly');
  });

  it('renders different sizes correctly', () => {
    const sizes = [
      { size: 'sm', expectedClass: 'h-8' },
      { size: 'md', expectedClass: 'h-10' },
      { size: 'lg', expectedClass: 'h-12' }
    ];

    sizes.forEach(({ size, expectedClass }) => {
      const { getByRole } = render(Input, { props: { size: size as any } });
      const input = getByRole('textbox');
      expect(input).toHaveClass(expectedClass);
    });
  });

  it('shows error state correctly', () => {
    const { getByRole } = render(Input, { 
      props: { hasError: true, id: 'test-input' } 
    });
    const input = getByRole('textbox');
    
    expect(input).toHaveClass('border-red-300', 'bg-red-50');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'test-input-error');
  });

  it('shows normal state without error', () => {
    const { getByRole } = render(Input, { props: { hasError: false } });
    const input = getByRole('textbox');
    
    expect(input).toHaveClass('border-gray-300');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('sets id and name attributes', () => {
    const { getByRole } = render(Input, { 
      props: { id: 'test-id', name: 'test-name' } 
    });
    const input = getByRole('textbox');
    
    expect(input).toHaveAttribute('id', 'test-id');
    expect(input).toHaveAttribute('name', 'test-name');
  });

  it('applies custom CSS classes', () => {
    const { getByRole } = render(Input, { props: { class: 'custom-class' } });
    const input = getByRole('textbox');
    
    expect(input).toHaveClass('custom-class');
  });

  it('handles focus events', async () => {
    const focusHandler = vi.fn();
    const blurHandler = vi.fn();
    
    const { getByRole, component } = render(Input);
    const input = getByRole('textbox');
    
    component.$on('focus', focusHandler);
    component.$on('blur', blurHandler);
    
    await fireEvent.focus(input);
    expect(focusHandler).toHaveBeenCalled();
    
    await fireEvent.blur(input);
    expect(blurHandler).toHaveBeenCalled();
  });

  it('handles keyboard events', async () => {
    const keydownHandler = vi.fn();
    const keypressHandler = vi.fn();
    const keyupHandler = vi.fn();
    
    const { getByRole, component } = render(Input);
    const input = getByRole('textbox');
    
    component.$on('keydown', keydownHandler);
    component.$on('keypress', keypressHandler);
    component.$on('keyup', keyupHandler);
    
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(keydownHandler).toHaveBeenCalled();
    
    await fireEvent.keyPress(input, { key: 'a' });
    expect(keypressHandler).toHaveBeenCalled();
    
    await fireEvent.keyUp(input, { key: 'a' });
    expect(keyupHandler).toHaveBeenCalled();
  });

  it('handles mouse events', async () => {
    const mouseEnterHandler = vi.fn();
    const mouseLeaveHandler = vi.fn();
    const clickHandler = vi.fn();
    
    const { getByRole, component } = render(Input);
    const input = getByRole('textbox');
    
    component.$on('mouseenter', mouseEnterHandler);
    component.$on('mouseleave', mouseLeaveHandler);
    component.$on('click', clickHandler);
    
    await fireEvent.mouseEnter(input);
    expect(mouseEnterHandler).toHaveBeenCalled();
    
    await fireEvent.mouseLeave(input);
    expect(mouseLeaveHandler).toHaveBeenCalled();
    
    await fireEvent.click(input);
    expect(clickHandler).toHaveBeenCalled();
  });

  it('passes through additional props', () => {
    const { getByRole } = render(Input, { 
      props: { 
        'data-testid': 'custom-input',
        'aria-label': 'Custom input',
        min: '0',
        max: '100'
      } 
    });
    const input = getByRole('textbox');
    
    expect(input).toHaveAttribute('data-testid', 'custom-input');
    expect(input).toHaveAttribute('aria-label', 'Custom input');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '100');
  });

  it('maintains focus styles for accessibility', () => {
    const { getByRole } = render(Input);
    const input = getByRole('textbox');
    
    expect(input).toHaveClass(
      'focus-visible:outline-none',
      'focus-visible:ring-2',
      'focus-visible:ring-offset-2'
    );
  });
});