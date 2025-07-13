import React, { useState } from 'react';
import { HelpCircle, X, ChevronRight, ChevronDown, ExternalLink } from 'lucide-react';
import { Tooltip } from '../ui/tooltip';

// Types for inline help
export interface HelpContent {
  id: string;
  title: string;
  content: string;
  type: 'tip' | 'warning' | 'info' | 'tutorial';
  icon?: React.ComponentType<{ className?: string }>;
  actions?: Array<{
    label: string;
    action: () => void;
    primary?: boolean;
  }>;
  links?: Array<{
    label: string;
    url: string;
    external?: boolean;
  }>;
}

export interface InlineHelpProps {
  content: HelpContent;
  compact?: boolean;
  dismissible?: boolean;
  expanded?: boolean;
  onDismiss?: () => void;
  className?: string;
}

// Inline Help Component
export const InlineHelp: React.FC<InlineHelpProps> = ({
  content,
  compact = false,
  dismissible = true,
  expanded = false,
  onDismiss,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const getTypeStyles = (type: HelpContent['type']) => {
    switch (type) {
      case 'tip':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-800',
          icon: 'text-blue-600'
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          icon: 'text-yellow-600'
        };
      case 'info':
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          icon: 'text-gray-600'
        };
      case 'tutorial':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          text: 'text-green-800',
          icon: 'text-green-600'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-800',
          icon: 'text-gray-600'
        };
    }
  };

  const styles = getTypeStyles(content.type);
  const Icon = content.icon || HelpCircle;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (compact) {
    return (
      <Tooltip content={content.content} maxWidth={300}>
        <button
          className={`inline-flex items-center gap-1 text-sm ${styles.icon} hover:${styles.text} ${className}`}
          onClick={toggleExpanded}
        >
          <Icon className="h-4 w-4" />
          <span>{content.title}</span>
        </button>
      </Tooltip>
    );
  }

  return (
    <div className={`${styles.bg} ${styles.border} ${styles.text} border rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 ${styles.icon} flex-shrink-0 mt-0.5`} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">{content.title}</h4>
            
            <div className="flex items-center gap-2">
              {content.content && (
                <button
                  onClick={toggleExpanded}
                  className={`${styles.icon} hover:${styles.text} p-1 rounded`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
              
              {dismissible && (
                <button
                  onClick={handleDismiss}
                  className={`${styles.icon} hover:${styles.text} p-1 rounded`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {(isExpanded || !content.content) && (
            <div className="space-y-3">
              {content.content && (
                <p className="text-sm leading-relaxed">{content.content}</p>
              )}

              {content.links && content.links.length > 0 && (
                <div className="space-y-1">
                  {content.links.map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className={`inline-flex items-center gap-1 text-sm ${styles.icon} hover:${styles.text} underline`}
                    >
                      {link.label}
                      {link.external && <ExternalLink className="h-3 w-3" />}
                    </a>
                  ))}
                </div>
              )}

              {content.actions && content.actions.length > 0 && (
                <div className="flex items-center gap-2 pt-2">
                  {content.actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={action.action}
                      className={`px-3 py-1 text-xs rounded ${
                        action.primary
                          ? `bg-blue-600 text-white hover:bg-blue-700`
                          : `${styles.bg} ${styles.border} border hover:bg-opacity-80`
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Help Panel for grouping multiple help items
export interface HelpPanelProps {
  title?: string;
  items: HelpContent[];
  compact?: boolean;
  className?: string;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({
  title,
  items,
  compact = false,
  className = ''
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {title && (
        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-blue-600" />
          {title}
        </h3>
      )}
      
      <div className="space-y-2">
        {items.map((item) => (
          <InlineHelp
            key={item.id}
            content={item}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
};

// Context-specific help content
export const createFieldHelp = (
  field: string,
  description: string,
  examples?: string[],
  validation?: string
): HelpContent => ({
  id: `field-help-${field}`,
  title: `Поле "${field}"`,
  content: description,
  type: 'info',
  links: examples ? [
    {
      label: 'Примеры использования',
      url: '#',
      external: false
    }
  ] : undefined
});

export const createValidationHelp = (
  field: string,
  rules: string[]
): HelpContent => ({
  id: `validation-help-${field}`,
  title: 'Правила валидации',
  content: rules.join('; '),
  type: 'warning'
});

export const createFeatureHelp = (
  feature: string,
  description: string,
  tutorialUrl?: string
): HelpContent => ({
  id: `feature-help-${feature}`,
  title: feature,
  content: description,
  type: 'tutorial',
  links: tutorialUrl ? [
    {
      label: 'Смотреть руководство',
      url: tutorialUrl,
      external: true
    }
  ] : undefined
});

// Hook for managing help state
export const useInlineHelp = () => {
  const [dismissedHelp, setDismissedHelp] = useState<Set<string>>(new Set());

  const dismissHelp = (helpId: string) => {
    setDismissedHelp(prev => new Set([...prev, helpId]));
  };

  const isDismissed = (helpId: string) => {
    return dismissedHelp.has(helpId);
  };

  const resetDismissed = () => {
    setDismissedHelp(new Set());
  };

  return {
    dismissHelp,
    isDismissed,
    resetDismissed
  };
};