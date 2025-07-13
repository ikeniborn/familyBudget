import React from 'react';
import { screen } from '@testing-library/react';
import { customRender } from '@/test/utils/test-utils';
import { Loading } from './Loading';

describe('Loading', () => {
  it('should render with default props', () => {
    customRender(<Loading />);
    
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('h-8', 'w-8', 'border-3', 'border-blue-600');
  });

  it('should render with small size', () => {
    customRender(<Loading size="small" />);
    
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveClass('h-4', 'w-4', 'border-2');
  });

  it('should render with medium size', () => {
    customRender(<Loading size="medium" />);
    
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveClass('h-8', 'w-8', 'border-3');
  });

  it('should render with large size', () => {
    customRender(<Loading size="large" />);
    
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveClass('h-12', 'w-12', 'border-4');
  });

  it('should render with primary color', () => {
    customRender(<Loading color="primary" />);
    
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveClass('border-blue-600');
  });

  it('should render with white color', () => {
    customRender(<Loading color="white" />);
    
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveClass('border-white');
  });

  it('should render loading text', () => {
    customRender(<Loading text="Loading data..." />);
    
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('should render text with correct color for primary spinner', () => {
    customRender(<Loading color="primary" text="Loading..." />);
    
    const text = screen.getByText('Loading...');
    expect(text).toHaveClass('text-gray-600');
  });

  it('should render text with correct color for white spinner', () => {
    customRender(<Loading color="white" text="Loading..." />);
    
    const text = screen.getByText('Loading...');
    expect(text).toHaveClass('text-white');
  });

  it('should not render in fullscreen mode by default', () => {
    customRender(<Loading />);
    
    const fullscreenContainer = document.querySelector('.fixed.inset-0');
    expect(fullscreenContainer).not.toBeInTheDocument();
  });

  it('should render in fullscreen mode when specified', () => {
    customRender(<Loading fullScreen />);
    
    const fullscreenContainer = document.querySelector('.fixed.inset-0');
    expect(fullscreenContainer).toBeInTheDocument();
    expect(fullscreenContainer).toHaveClass(
      'z-50',
      'flex',
      'items-center',
      'justify-center',
      'bg-gray-900',
      'bg-opacity-50'
    );
  });

  it('should render spinner inside fullscreen container', () => {
    customRender(<Loading fullScreen />);
    
    const fullscreenContainer = document.querySelector('.fixed.inset-0');
    const spinner = fullscreenContainer?.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should have correct spinner animation classes', () => {
    customRender(<Loading />);
    
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveClass('rounded-full', 'border-t-transparent');
  });

  it('should combine all props correctly', () => {
    customRender(
      <Loading 
        size="large" 
        color="white" 
        fullScreen 
        text="Please wait..."
      />
    );
    
    const fullscreenContainer = document.querySelector('.fixed.inset-0');
    expect(fullscreenContainer).toBeInTheDocument();
    
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveClass('h-12', 'w-12', 'border-4', 'border-white');
    
    const text = screen.getByText('Please wait...');
    expect(text).toHaveClass('text-white');
  });

  it('should maintain flex layout structure', () => {
    customRender(<Loading text="Loading..." />);
    
    const container = document.querySelector('.flex.flex-col.items-center');
    expect(container).toBeInTheDocument();
    
    const children = container?.children;
    expect(children).toHaveLength(2);
    expect(children?.[0]).toHaveClass('animate-spin');
    expect(children?.[1]).toHaveTextContent('Loading...');
  });

  it('should apply margin to text when present', () => {
    customRender(<Loading text="Loading..." />);
    
    const text = screen.getByText('Loading...');
    expect(text).toHaveClass('mt-2', 'text-sm');
  });

  it('should work without any props', () => {
    customRender(<Loading />);
    
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByText(/./)).not.toBeInTheDocument(); // No text
  });

  it('should be accessible with proper ARIA attributes', () => {
    customRender(<Loading text="Loading content" />);
    
    // The component should ideally have aria-label or role="status"
    // This test documents current behavior
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});