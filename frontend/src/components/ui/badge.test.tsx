import React from 'react';
import { screen } from '@testing-library/react';
import { customRender } from '@/test/utils/test-utils';
import { Badge, badgeVariants } from './badge';

describe('Badge', () => {
  it('should render with text content', () => {
    customRender(<Badge>Badge Text</Badge>);
    
    expect(screen.getByText('Badge Text')).toBeInTheDocument();
  });

  it('should render with default variant', () => {
    customRender(<Badge>Default</Badge>);
    
    const badge = screen.getByText('Default');
    expect(badge).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('should render secondary variant', () => {
    customRender(<Badge variant="secondary">Secondary</Badge>);
    
    const badge = screen.getByText('Secondary');
    expect(badge).toHaveClass('bg-secondary', 'text-secondary-foreground');
  });

  it('should render destructive variant', () => {
    customRender(<Badge variant="destructive">Destructive</Badge>);
    
    const badge = screen.getByText('Destructive');
    expect(badge).toHaveClass('bg-destructive', 'text-destructive-foreground');
  });

  it('should render outline variant', () => {
    customRender(<Badge variant="outline">Outline</Badge>);
    
    const badge = screen.getByText('Outline');
    expect(badge).toHaveClass('text-foreground');
  });

  it('should apply custom className', () => {
    customRender(<Badge className="custom-badge">Custom</Badge>);
    
    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('custom-badge');
  });

  it('should have base styling', () => {
    customRender(<Badge>Styled</Badge>);
    
    const badge = screen.getByText('Styled');
    expect(badge).toHaveClass(
      'inline-flex',
      'items-center',
      'rounded-full',
      'px-2.5',
      'py-0.5',
      'text-xs',
      'font-semibold'
    );
  });

  it('should support all HTML div props', () => {
    customRender(
      <Badge 
        data-testid="custom-badge"
        onClick={jest.fn()}
        style={{ color: 'red' }}
      >
        Props Test
      </Badge>
    );
    
    const badge = screen.getByTestId('custom-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveStyle({ color: 'red' });
  });

  it('should render with children elements', () => {
    customRender(
      <Badge>
        <span>Icon</span>
        <span>Text</span>
      </Badge>
    );
    
    expect(screen.getByText('Icon')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('should handle empty content', () => {
    customRender(<Badge />);
    
    // Badge should still render even without content
    const badges = document.querySelectorAll('.inline-flex.items-center.rounded-full');
    expect(badges.length).toBeGreaterThan(0);
  });

  describe('badgeVariants', () => {
    it('should generate correct classes for default variant', () => {
      const classes = badgeVariants({ variant: 'default' });
      expect(classes).toContain('bg-primary');
      expect(classes).toContain('text-primary-foreground');
    });

    it('should generate correct classes for secondary variant', () => {
      const classes = badgeVariants({ variant: 'secondary' });
      expect(classes).toContain('bg-secondary');
      expect(classes).toContain('text-secondary-foreground');
    });

    it('should generate correct classes for destructive variant', () => {
      const classes = badgeVariants({ variant: 'destructive' });
      expect(classes).toContain('bg-destructive');
      expect(classes).toContain('text-destructive-foreground');
    });

    it('should generate correct classes for outline variant', () => {
      const classes = badgeVariants({ variant: 'outline' });
      expect(classes).toContain('text-foreground');
    });
  });

  it('should be usable in different contexts', () => {
    customRender(
      <div>
        <Badge variant="default">Active</Badge>
        <Badge variant="secondary">Pending</Badge>
        <Badge variant="destructive">Error</Badge>
        <Badge variant="outline">Draft</Badge>
      </div>
    );
    
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });
});