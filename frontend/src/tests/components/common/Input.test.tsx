import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../../../components/common/form/Input';

describe('Input Component', () => {
  it('renders input with label', () => {
    render(<Input label="Test Label" name="test" />);
    expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
  });

  it('renders input without label', () => {
    render(<Input name="test" placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('shows required indicator when required', () => {
    render(<Input label="Required Field" name="test" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(<Input label="Field" name="test" error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Field')).toHaveClass('border-red-300');
  });

  it('handles value changes', () => {
    const handleChange = jest.fn();
    render(<Input label="Field" name="test" onChange={handleChange} />);
    
    const input = screen.getByLabelText('Field');
    fireEvent.change(input, { target: { value: 'new value' } });
    
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    render(<Input label="Disabled Field" name="test" disabled />);
    expect(screen.getByLabelText('Disabled Field')).toBeDisabled();
  });

  it('supports different input types', () => {
    const { rerender } = render(<Input label="Email" name="email" type="email" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');

    rerender(<Input label="Number" name="number" type="number" />);
    expect(screen.getByLabelText('Number')).toHaveAttribute('type', 'number');

    rerender(<Input label="Date" name="date" type="date" />);
    expect(screen.getByLabelText('Date')).toHaveAttribute('type', 'date');
  });

  it('applies additional className', () => {
    render(<Input label="Field" name="test" className="custom-class" />);
    expect(screen.getByLabelText('Field')).toHaveClass('custom-class');
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input label="Field" name="test" ref={ref} />);
    
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.name).toBe('test');
  });

  it('shows focus styles', () => {
    render(<Input label="Field" name="test" />);
    const input = screen.getByLabelText('Field');
    
    fireEvent.focus(input);
    expect(input).toHaveClass('focus:ring-blue-500');
  });
});