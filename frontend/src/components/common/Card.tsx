// Re-export shadcn/ui Card components
export { 
  Card as BaseCard, 
  CardHeader as BaseCardHeader,
  CardTitle as BaseCardTitle,
  CardDescription as BaseCardDescription,
  CardContent as BaseCardContent,
  CardFooter as BaseCardFooter
} from '@/components/ui/card';

import React from 'react';
import { 
  Card as ShadcnCard, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  description,
  className,
  padding = 'medium',
}) => {
  const paddingClasses = {
    none: '',
    small: 'p-4',
    medium: 'p-6',
    large: 'p-8',
  };

  const contentPadding = padding === 'none' ? 'p-0' : paddingClasses[padding];

  return (
    <ShadcnCard className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={cn(contentPadding, !title && !description && 'pt-6')}>
        {children}
      </CardContent>
    </ShadcnCard>
  );
};