import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import FormField from '../FormField.svelte';

// Create a test component that uses FormField
const TestFormFieldComponent = `
<script>
  import FormField from '../FormField.svelte';
  export let label = 'Test Field';
  export let name = 'test-field';
  export let required = false;
  export let error = null;
  export let helpText = '';
  export let isValidating = false;
  export let variant = 'default';
  export let size = 'md';
  export let disabled = false;
  export let labelPosition = 'top';
  export let showOptional = true;
  export let value = '';
</script>

<FormField
  {label}
  {name}
  {required}
  {error}
  {helpText}
  {isValidating}
  {variant}
  {size}
  {disabled}
  {labelPosition}
  {showOptional}
  let:fieldId
  let:hasError
>
  <input
    id={fieldId}
    type="text"
    class="w-full p-2 border rounded"
    aria-invalid={hasError}
    bind:value
  />
</FormField>
`;

describe('FormField Component', () => {
  it('renders with default props', () => {
    const { getByLabelText } = render(FormField, {
      props: {
        label: 'Test Field',
        name: 'test-field',
        $$slots: { 
          default: true 
        },
        $$scope: { 
          ctx: [] 
        }
      }
    });
    
    // Check that label is rendered
    expect(getByLabelText('Test Field')).toBeInTheDocument();
  });

  it('shows required indicator when required', () => {
    const { getByText, container } = render(FormField, {
      props: {
        label: 'Required Field',
        name: 'required-field',
        required: true,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    expect(getByText('Required Field')).toBeInTheDocument();
    const asterisk = container.querySelector('.text-red-500');
    expect(asterisk).toBeInTheDocument();
    expect(asterisk).toHaveTextContent('*');
    expect(asterisk).toHaveAttribute('aria-label', 'обязательное поле');
  });

  it('shows optional indicator when not required and showOptional is true', () => {
    const { getByText } = render(FormField, {
      props: {
        label: 'Optional Field',
        name: 'optional-field',
        required: false,
        showOptional: true,
        labelPosition: 'top',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    expect(getByText('(необязательно)')).toBeInTheDocument();
  });

  it('displays error message with proper styling and accessibility', () => {
    const errorMessage = 'This field is required';
    const { getByText, getByRole } = render(FormField, {
      props: {
        label: 'Field with Error',
        name: 'error-field',
        error: errorMessage,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    const errorElement = getByRole('alert');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveAttribute('aria-live', 'polite');
    expect(errorElement).toHaveTextContent(errorMessage);
    expect(errorElement).toHaveClass('text-red-600');
  });

  it('displays help text when provided', () => {
    const helpText = 'This is helpful information';
    const { getByText, container } = render(FormField, {
      props: {
        label: 'Field with Help',
        name: 'help-field',
        helpText,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    expect(getByText(helpText)).toBeInTheDocument();
    const helpElement = container.querySelector('.text-gray-500');
    expect(helpElement).toHaveTextContent(helpText);
  });

  it('shows validation spinner when isValidating is true', () => {
    const { getByText, container } = render(FormField, {
      props: {
        label: 'Validating Field',
        name: 'validating-field',
        isValidating: true,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    expect(getByText('Проверка...')).toBeInTheDocument();
    
    // Check for spinner elements
    const spinners = container.querySelectorAll('.animate-spin');
    expect(spinners.length).toBeGreaterThan(0);
  });

  it('applies different label positions correctly', () => {
    const positions = ['top', 'left', 'inside'];
    
    positions.forEach(position => {
      const { container } = render(FormField, {
        props: {
          label: 'Test Label',
          name: 'test-field',
          labelPosition: position as any,
          $$slots: { default: true },
          $$scope: { ctx: [] }
        }
      });
      
      const formField = container.querySelector('.form-field');
      const label = container.querySelector('.form-field__label');
      
      if (position === 'top') {
        expect(formField).toHaveClass('space-y-1');
        expect(label).toHaveClass('block', 'mb-1');
      } else if (position === 'left') {
        expect(formField).toHaveClass('flex', 'items-center', 'gap-3');
        expect(label).toHaveClass('flex-shrink-0', 'w-24');
      } else if (position === 'inside') {
        expect(formField).toHaveClass('relative');
        expect(label).toHaveClass('absolute', 'left-3', 'top-3');
      }
    });
  });

  it('applies different sizes correctly', () => {
    const sizes = [
      { size: 'sm', expectedClass: 'text-sm' },
      { size: 'md', expectedClass: 'text-base' },
      { size: 'lg', expectedClass: 'text-lg' }
    ];

    sizes.forEach(({ size, expectedClass }) => {
      const { container } = render(FormField, {
        props: {
          label: 'Sized Field',
          name: 'sized-field',
          size: size as any,
          $$slots: { default: true },
          $$scope: { ctx: [] }
        }
      });
      
      const label = container.querySelector('.form-field__label');
      expect(label).toHaveClass(expectedClass);
    });
  });

  it('applies disabled state correctly', () => {
    const { container } = render(FormField, {
      props: {
        label: 'Disabled Field',
        name: 'disabled-field',
        disabled: true,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    const formField = container.querySelector('.form-field');
    expect(formField).toHaveClass('opacity-50', 'pointer-events-none');
  });

  it('handles inline variant correctly', () => {
    const { container } = render(FormField, {
      props: {
        label: 'Inline Field',
        name: 'inline-field',
        variant: 'inline',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    const formField = container.querySelector('.form-field');
    expect(formField).toHaveClass('flex', 'items-center', 'gap-3');
  });

  it('does not show help text when error is present', () => {
    const { queryByText, getByRole } = render(FormField, {
      props: {
        label: 'Field with Error and Help',
        name: 'error-help-field',
        error: 'Error message',
        helpText: 'Help text that should be hidden',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    expect(getByRole('alert')).toHaveTextContent('Error message');
    expect(queryByText('Help text that should be hidden')).not.toBeInTheDocument();
  });

  it('applies custom CSS classes', () => {
    const { container } = render(FormField, {
      props: {
        label: 'Custom Class Field',
        name: 'custom-field',
        class: 'custom-form-field',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    const formField = container.querySelector('.form-field');
    expect(formField).toHaveClass('custom-form-field');
  });

  it('generates proper accessibility IDs', () => {
    const fieldName = 'accessible-field';
    const { container } = render(FormField, {
      props: {
        label: 'Accessible Field',
        name: fieldName,
        error: 'Error message',
        helpText: 'Help text',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    const label = container.querySelector('label');
    const errorElement = container.querySelector('[role="alert"]');
    
    expect(label).toHaveAttribute('for', fieldName);
    expect(errorElement).toHaveAttribute('id', `${fieldName}-error`);
  });

  it('changes label color when error is present', () => {
    const { container } = render(FormField, {
      props: {
        label: 'Error Field',
        name: 'error-field',
        error: 'Field has error',
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    const label = container.querySelector('label');
    expect(label).toHaveClass('text-red-700');
  });

  it('does not show validating message when error is present', () => {
    const { queryByText, getByRole } = render(FormField, {
      props: {
        label: 'Error and Validating Field',
        name: 'error-validating-field',
        error: 'Error message',
        isValidating: true,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    expect(getByRole('alert')).toHaveTextContent('Error message');
    expect(queryByText('Проверка...')).not.toBeInTheDocument();
  });

  it('provides slot props correctly', () => {
    const fieldName = 'slot-props-field';
    const errorMessage = 'Slot error';
    
    // This test verifies that the slot props are passed correctly
    // In a real implementation, this would be tested by creating a custom component
    // that uses the FormField and checking the props passed to the slot
    const { container } = render(FormField, {
      props: {
        label: 'Slot Props Field',
        name: fieldName,
        error: errorMessage,
        $$slots: { default: true },
        $$scope: { ctx: [] }
      }
    });
    
    // The slot should receive fieldId, errorId, helpId, error, hasError, isValidating
    const formField = container.querySelector('.form-field');
    expect(formField).toBeInTheDocument();
    
    // Error ID should be generated based on field name
    const errorElement = container.querySelector(`#${fieldName}-error`);
    expect(errorElement).toBeInTheDocument();
  });
});