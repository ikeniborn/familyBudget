import React from 'react';
import { screen } from '@testing-library/react';
import { customRender } from '@/test/utils/test-utils';
import { Alert, AlertDescription, AlertTitle } from './alert';

describe('Alert', () => {
  it('should render default alert', () => {
    customRender(
      <Alert>
        <AlertTitle>Alert Title</AlertTitle>
        <AlertDescription>Alert description text</AlertDescription>
      </Alert>
    );

    expect(screen.getByText('Alert Title')).toBeInTheDocument();
    expect(screen.getByText('Alert description text')).toBeInTheDocument();
  });

  it('should render with default variant styling', () => {
    customRender(
      <Alert>
        <AlertDescription>Default alert</AlertDescription>
      </Alert>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('bg-background', 'text-foreground');
  });

  it('should render destructive variant', () => {
    customRender(
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Something went wrong</AlertDescription>
      </Alert>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('border-destructive/50', 'text-destructive');
  });

  it('should apply custom className', () => {
    customRender(
      <Alert className="custom-class">
        <AlertDescription>Custom alert</AlertDescription>
      </Alert>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('custom-class');
  });

  it('should render AlertTitle with correct styling', () => {
    customRender(
      <Alert>
        <AlertTitle>Important Notice</AlertTitle>
      </Alert>
    );

    const title = screen.getByText('Important Notice');
    expect(title).toHaveClass('mb-1', 'font-medium', 'leading-none', 'tracking-tight');
  });

  it('should render AlertDescription with correct styling', () => {
    customRender(
      <Alert>
        <AlertDescription>Description text</AlertDescription>
      </Alert>
    );

    const description = screen.getByText('Description text');
    expect(description).toHaveClass('text-sm', '[&_p]:leading-relaxed');
  });

  it('should support custom props on AlertTitle', () => {
    customRender(
      <Alert>
        <AlertTitle className="custom-title" data-testid="alert-title">
          Title
        </AlertTitle>
      </Alert>
    );

    const title = screen.getByTestId('alert-title');
    expect(title).toHaveClass('custom-title');
  });

  it('should support custom props on AlertDescription', () => {
    customRender(
      <Alert>
        <AlertDescription className="custom-desc" data-testid="alert-desc">
          Description
        </AlertDescription>
      </Alert>
    );

    const description = screen.getByTestId('alert-desc');
    expect(description).toHaveClass('custom-desc');
  });

  it('should render with icon when provided', () => {
    const Icon = () => <svg data-testid="alert-icon" />;
    
    customRender(
      <Alert>
        <Icon />
        <AlertTitle>Alert with icon</AlertTitle>
      </Alert>
    );

    expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
  });

  it('should handle complex content', () => {
    customRender(
      <Alert>
        <AlertTitle>Complex Alert</AlertTitle>
        <AlertDescription>
          <p>First paragraph</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </AlertDescription>
      </Alert>
    );

    expect(screen.getByText('First paragraph')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('should be accessible', () => {
    customRender(
      <Alert>
        <AlertTitle>Accessible Alert</AlertTitle>
        <AlertDescription>This alert is accessible</AlertDescription>
      </Alert>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
  });
});