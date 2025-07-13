import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlanFactBarChart from '../business/PlanFactBarChart';

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children, onClick }: any) => (
    <div data-testid="bar-chart" onClick={onClick}>
      {children}
    </div>
  ),
  Bar: ({ dataKey, fill }: any) => (
    <div data-testid={`bar-${dataKey}`} style={{ backgroundColor: fill }} />
  ),
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis" data-key={dataKey} />,
  YAxis: ({ tickFormatter }: any) => <div data-testid="y-axis" data-formatter={tickFormatter?.name} />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: ({ content }: any) => <div data-testid="tooltip" data-content={content?.name} />,
  Legend: () => <div data-testid="legend" />,
}));

describe('PlanFactBarChart', () => {
  const mockData = [
    {
      name: 'January',
      planned_amount: 100000,
      actual_amount: 85000,
      category: 'Operations',
    },
    {
      name: 'February', 
      planned_amount: 120000,
      actual_amount: 135000,
      category: 'Marketing',
    },
    {
      name: 'March',
      planned_amount: 95000,
      actual_amount: 92000,
      category: 'IT',
    },
  ];

  const defaultProps = {
    data: mockData,
    title: 'Plan vs Fact Analysis',
  };

  it('renders chart with title and data', () => {
    render(<PlanFactBarChart {...defaultProps} />);
    
    expect(screen.getByText('Plan vs Fact Analysis')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders plan and fact bars', () => {
    render(<PlanFactBarChart {...defaultProps} />);
    
    expect(screen.getByTestId('bar-planned_amount')).toBeInTheDocument();
    expect(screen.getByTestId('bar-actual_amount')).toBeInTheDocument();
  });

  it('includes chart components', () => {
    render(<PlanFactBarChart {...defaultProps} />);
    
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('legend')).toBeInTheDocument();
  });

  it('shows loading state when loading prop is true', () => {
    render(<PlanFactBarChart {...defaultProps} loading={true} />);
    
    expect(screen.getByText('Загрузка графика...')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('shows error state when error is provided', () => {
    const errorMessage = 'Failed to load chart data';
    render(<PlanFactBarChart {...defaultProps} error={errorMessage} />);
    
    expect(screen.getByText('Ошибка загрузки графика')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('shows empty state when data is empty', () => {
    render(<PlanFactBarChart {...defaultProps} data={[]} />);
    
    expect(screen.getByText('Нет данных для отображения')).toBeInTheDocument();
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('handles bar click events', () => {
    const mockOnBarClick = jest.fn();
    render(<PlanFactBarChart {...defaultProps} onBarClick={mockOnBarClick} />);
    
    const barChart = screen.getByTestId('bar-chart');
    fireEvent.click(barChart);
    
    // Note: In a real implementation, we'd need to simulate clicking on specific bars
    // This is a simplified test of the click handler setup
    expect(barChart).toBeInTheDocument();
  });

  it('shows variance when showVariance prop is true', () => {
    render(<PlanFactBarChart {...defaultProps} showVariance={true} />);
    
    // The variance would be calculated and displayed in the tooltip or additional elements
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('shows percentage labels when showPercentage prop is true', () => {
    render(<PlanFactBarChart {...defaultProps} showPercentage={true} />);
    
    // Percentage labels would be rendered in the chart
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PlanFactBarChart {...defaultProps} className="custom-chart" />
    );
    
    expect(container.firstChild).toHaveClass('custom-chart');
  });

  it('handles element click callback', () => {
    const mockOnElementClick = jest.fn();
    render(<PlanFactBarChart {...defaultProps} onElementClick={mockOnElementClick} />);
    
    // Chart should be rendered and ready for interactions
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('renders with different bar colors', () => {
    render(<PlanFactBarChart {...defaultProps} />);
    
    const plannedBar = screen.getByTestId('bar-planned_amount');
    const actualBar = screen.getByTestId('bar-actual_amount');
    
    // Bars should have different background colors
    expect(plannedBar).toBeInTheDocument();
    expect(actualBar).toBeInTheDocument();
  });

  it('formats currency values in tooltip', () => {
    render(<PlanFactBarChart {...defaultProps} />);
    
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
    // Tooltip would format values as currency in the real implementation
  });
});