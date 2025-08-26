/**
 * Tests for Button component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Button from './Button.svelte';

describe('Button Component', () => {
	it('should render with default props', () => {
		const { getByRole } = render(Button, {
			props: {
				children: 'Click me'
			}
		});
		
		const button = getByRole('button');
		expect(button).toBeInTheDocument();
		expect(button).toHaveTextContent('Click me');
		expect(button).toHaveClass('btn-primary');
	});

	it('should apply variant classes', () => {
		const { getByRole } = render(Button, {
			props: {
				variant: 'secondary',
				children: 'Secondary Button'
			}
		});
		
		const button = getByRole('button');
		expect(button).toHaveClass('btn-secondary');
	});

	it('should apply size classes', () => {
		const { getByRole } = render(Button, {
			props: {
				size: 'lg',
				children: 'Large Button'
			}
		});
		
		const button = getByRole('button');
		expect(button).toHaveClass('text-lg');
	});

	it('should handle click events', async () => {
		const handleClick = vi.fn();
		const { getByRole } = render(Button, {
			props: {
				onclick: handleClick,
				children: 'Click me'
			}
		});
		
		const button = getByRole('button');
		await fireEvent.click(button);
		
		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it('should be disabled when disabled prop is true', () => {
		const handleClick = vi.fn();
		const { getByRole } = render(Button, {
			props: {
				disabled: true,
				onclick: handleClick,
				children: 'Disabled Button'
			}
		});
		
		const button = getByRole('button');
		expect(button).toBeDisabled();
		expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
	});

	it('should show loading state', () => {
		const { getByRole, container } = render(Button, {
			props: {
				loading: true,
				children: 'Loading...'
			}
		});
		
		const button = getByRole('button');
		expect(button).toBeDisabled();
		
		// Check for loading spinner
		const spinner = container.querySelector('.animate-spin');
		expect(spinner).toBeInTheDocument();
	});

	it('should apply full width when fullWidth is true', () => {
		const { getByRole } = render(Button, {
			props: {
				fullWidth: true,
				children: 'Full Width Button'
			}
		});
		
		const button = getByRole('button');
		expect(button).toHaveClass('w-full');
	});

	it('should apply custom className', () => {
		const { getByRole } = render(Button, {
			props: {
				class: 'custom-class',
				children: 'Custom Button'
			}
		});
		
		const button = getByRole('button');
		expect(button).toHaveClass('custom-class');
	});

	it('should render as different element with as prop', () => {
		const { container } = render(Button, {
			props: {
				as: 'a',
				href: '/test',
				children: 'Link Button'
			}
		});
		
		const link = container.querySelector('a');
		expect(link).toBeInTheDocument();
		expect(link).toHaveAttribute('href', '/test');
	});

	it('should render icon when provided', () => {
		const { container } = render(Button, {
			props: {
				icon: 'plus',
				children: 'Add Item'
			}
		});
		
		const icon = container.querySelector('svg');
		expect(icon).toBeInTheDocument();
	});

	it('should apply outline variant styles', () => {
		const { getByRole } = render(Button, {
			props: {
				variant: 'outline',
				children: 'Outline Button'
			}
		});
		
		const button = getByRole('button');
		expect(button).toHaveClass('btn-outline');
	});

	it('should apply ghost variant styles', () => {
		const { getByRole } = render(Button, {
			props: {
				variant: 'ghost',
				children: 'Ghost Button'
			}
		});
		
		const button = getByRole('button');
		expect(button).toHaveClass('btn-ghost');
	});

	it('should apply danger variant styles', () => {
		const { getByRole } = render(Button, {
			props: {
				variant: 'danger',
				children: 'Delete'
			}
		});
		
		const button = getByRole('button');
		expect(button).toHaveClass('btn-danger');
	});

	it('should not trigger click when disabled', async () => {
		const handleClick = vi.fn();
		const { getByRole } = render(Button, {
			props: {
				disabled: true,
				onclick: handleClick,
				children: 'Disabled'
			}
		});
		
		const button = getByRole('button');
		await fireEvent.click(button);
		
		expect(handleClick).not.toHaveBeenCalled();
	});
});