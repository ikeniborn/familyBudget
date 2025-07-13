import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChartContainer, { ChartSkeleton, ChartEmpty } from '../core/ChartContainer';

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

describe('ChartContainer', () => {
  const defaultProps = {
    title: 'Test Chart',
    children: <div data-testid="chart-content">Chart Content</div>,
  };

  it('renders chart with title and content', () => {
    render(<ChartContainer {...defaultProps} />);
    
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByTestId('chart-content')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading prop is true', () => {
    render(<ChartContainer {...defaultProps} loading={true} />);
    
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByText('Загрузка графика...')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-content')).not.toBeInTheDocument();
  });

  it('shows error state when error prop is provided', () => {
    const errorMessage = 'Chart failed to load';
    render(<ChartContainer {...defaultProps} error={errorMessage} />);
    
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByText('Ошибка загрузки графика')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.queryByTestId('chart-content')).not.toBeInTheDocument();
  });

  it('shows empty state when showEmpty prop is true', () => {
    render(<ChartContainer {...defaultProps} showEmpty={true} />);
    
    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByText('Нет данных для отображения')).toBeInTheDocument();
    expect(screen.queryByTestId('chart-content')).not.toBeInTheDocument();
  });

  it('applies custom className and height', () => {
    const { container } = render(
      <ChartContainer {...defaultProps} className="custom-class" height={500} />
    );
    
    const chartContainer = container.firstChild as HTMLElement;
    expect(chartContainer).toHaveClass('custom-class');
    expect(chartContainer).toHaveStyle({ height: '500px' });
  });

  it('renders custom empty message', () => {
    const customEmptyMessage = 'Custom empty message';
    render(
      <ChartContainer 
        {...defaultProps} 
        showEmpty={true} 
        emptyMessage={customEmptyMessage} 
      />
    );
    
    expect(screen.getByText(customEmptyMessage)).toBeInTheDocument();
  });

  it('includes data-testid when provided', () => {
    render(<ChartContainer {...defaultProps} data-testid="test-chart" />);
    
    expect(screen.getByTestId('test-chart')).toBeInTheDocument();
  });
});

describe('ChartSkeleton', () => {
  it('renders default skeleton with 300px height', () => {
    const { container } = render(<ChartSkeleton />);
    
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveClass('animate-pulse');
    expect(skeleton).toHaveStyle({ height: '300px' });
  });

  it('renders skeleton with custom height', () => {
    const { container } = render(<ChartSkeleton height={400} />);
    
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveStyle({ height: '400px' });
  });

  it('includes loading text', () => {
    render(<ChartSkeleton />);
    
    expect(screen.getByText('Загрузка графика...')).toBeInTheDocument();
  });
});

describe('ChartEmpty', () => {
  it('renders default empty state', () => {
    render(<ChartEmpty />);
    
    expect(screen.getByText('Нет данных для отображения')).toBeInTheDocument();
    expect(screen.getByText('Добавьте данные для создания графика')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    const customMessage = 'Custom empty message';
    render(<ChartEmpty message={customMessage} />);
    
    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('applies custom height', () => {
    const { container } = render(<ChartEmpty height={500} />);
    
    const emptyContainer = container.firstChild as HTMLElement;
    expect(emptyContainer).toHaveStyle({ height: '500px' });
  });

  it('includes chart icon', () => {
    render(<ChartEmpty />);
    
    // The icon should be present in the DOM
    const iconContainer = screen.getByText('Нет данных для отображения').closest('div');
    expect(iconContainer).toBeInTheDocument();
  });
});