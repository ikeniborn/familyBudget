import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card } from '../../../components/common/Card';

describe('Card Component', () => {
  it('renders card with title', () => {
    render(<Card title="Test Title">Content</Card>);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <Card title="Card">
        <div>Child content</div>
      </Card>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('applies hover effect by default', () => {
    render(<Card title="Card">Content</Card>);
    const card = screen.getByText('Card').closest('div');
    expect(card).toHaveClass('hover:shadow-lg');
  });

  it('can disable hover effect', () => {
    render(<Card title="Card" noHover>Content</Card>);
    const card = screen.getByText('Card').closest('div');
    expect(card).not.toHaveClass('hover:shadow-lg');
  });

  it('applies additional className', () => {
    render(<Card title="Card" className="custom-class">Content</Card>);
    const card = screen.getByText('Card').closest('div');
    expect(card).toHaveClass('custom-class');
  });

  it('renders header action when provided', () => {
    render(
      <Card 
        title="Card" 
        headerAction={<button>Action</button>}
      >
        Content
      </Card>
    );
    expect(screen.getByText('Action')).toBeInTheDocument();
  });

  it('renders without title', () => {
    render(<Card>Content only</Card>);
    expect(screen.getByText('Content only')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});