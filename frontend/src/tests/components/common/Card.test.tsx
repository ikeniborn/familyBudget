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

  it('renders card with shadow', () => {
    render(<Card title="Card">Content</Card>);
    const card = screen.getByText('Content').closest('div')?.parentElement;
    expect(card).toHaveClass('shadow');
  });

  it('applies additional className', () => {
    render(<Card title="Card" className="custom-class">Content</Card>);
    const card = screen.getByText('Content').closest('div')?.parentElement;
    expect(card).toHaveClass('custom-class');
  });

  it('renders with description', () => {
    render(
      <Card 
        title="Card" 
        description="This is a description"
      >
        Content
      </Card>
    );
    expect(screen.getByText('This is a description')).toBeInTheDocument();
  });

  it('renders without title', () => {
    render(<Card>Content only</Card>);
    expect(screen.getByText('Content only')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});