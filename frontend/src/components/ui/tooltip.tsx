import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Types for tooltip
export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  delay?: number;
  disabled?: boolean;
  className?: string;
  maxWidth?: number;
  arrow?: boolean;
  interactive?: boolean;
  offset?: number;
}

interface TooltipPosition {
  x: number;
  y: number;
  position: 'top' | 'bottom' | 'left' | 'right';
}

// Tooltip Component
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'auto',
  delay = 500,
  disabled = false,
  className = '',
  maxWidth = 250,
  arrow = true,
  interactive = false,
  offset = 8
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate optimal tooltip position
  const calculatePosition = useCallback((): TooltipPosition | null => {
    if (!triggerRef.current || !tooltipRef.current) return null;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    const positions = {
      top: {
        x: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
        y: triggerRect.top - tooltipRect.height - offset,
        position: 'top' as const
      },
      bottom: {
        x: triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2,
        y: triggerRect.bottom + offset,
        position: 'bottom' as const
      },
      left: {
        x: triggerRect.left - tooltipRect.width - offset,
        y: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
        position: 'left' as const
      },
      right: {
        x: triggerRect.right + offset,
        y: triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2,
        position: 'right' as const
      }
    };

    // If position is specified and fits, use it
    if (position !== 'auto') {
      const pos = positions[position];
      if (
        pos.x >= 0 && pos.x + tooltipRect.width <= viewport.width &&
        pos.y >= 0 && pos.y + tooltipRect.height <= viewport.height
      ) {
        return pos;
      }
    }

    // Auto-position: find the best fit
    const candidates = [
      positions.top,
      positions.bottom,
      positions.right,
      positions.left
    ];

    for (const candidate of candidates) {
      if (
        candidate.x >= 0 && candidate.x + tooltipRect.width <= viewport.width &&
        candidate.y >= 0 && candidate.y + tooltipRect.height <= viewport.height
      ) {
        return candidate;
      }
    }

    // Fallback to top position with adjustments
    const fallback = positions.top;
    fallback.x = Math.max(10, Math.min(fallback.x, viewport.width - tooltipRect.width - 10));
    fallback.y = Math.max(10, Math.min(fallback.y, viewport.height - tooltipRect.height - 10));

    return fallback;
  }, [position, offset]);

  // Show tooltip
  const showTooltip = useCallback(() => {
    if (disabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [disabled, delay]);

  // Hide tooltip
  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setIsVisible(false);
    setTooltipPosition(null);
  }, []);

  // Update position when visible
  useEffect(() => {
    if (isVisible) {
      const updatePosition = () => {
        const pos = calculatePosition();
        setTooltipPosition(pos);
      };

      updatePosition();

      // Update position on scroll/resize
      const handleUpdate = () => updatePosition();
      window.addEventListener('scroll', handleUpdate, true);
      window.addEventListener('resize', handleUpdate);

      return () => {
        window.removeEventListener('scroll', handleUpdate, true);
        window.removeEventListener('resize', handleUpdate);
      };
    }
  }, [isVisible, calculatePosition]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => showTooltip();
  const handleMouseLeave = () => {
    if (!interactive) {
      hideTooltip();
    }
  };

  const handleFocus = () => showTooltip();
  const handleBlur = () => hideTooltip();

  const getArrowStyle = (): React.CSSProperties => {
    if (!arrow || !tooltipPosition) return {};

    const arrowSize = 6;
    const { position: pos } = tooltipPosition;

    switch (pos) {
      case 'top':
        return {
          content: '""',
          position: 'absolute',
          top: '100%',
          left: '50%',
          marginLeft: `-${arrowSize}px`,
          borderWidth: `${arrowSize}px ${arrowSize}px 0`,
          borderStyle: 'solid',
          borderColor: '#1f2937 transparent transparent transparent'
        };
      case 'bottom':
        return {
          content: '""',
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          marginLeft: `-${arrowSize}px`,
          borderWidth: `0 ${arrowSize}px ${arrowSize}px`,
          borderStyle: 'solid',
          borderColor: 'transparent transparent #1f2937 transparent'
        };
      case 'left':
        return {
          content: '""',
          position: 'absolute',
          left: '100%',
          top: '50%',
          marginTop: `-${arrowSize}px`,
          borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
          borderStyle: 'solid',
          borderColor: 'transparent transparent transparent #1f2937'
        };
      case 'right':
        return {
          content: '""',
          position: 'absolute',
          right: '100%',
          top: '50%',
          marginTop: `-${arrowSize}px`,
          borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
          borderStyle: 'solid',
          borderColor: 'transparent #1f2937 transparent transparent'
        };
      default:
        return {};
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="inline-block"
      >
        {children}
      </div>

      {isVisible && tooltipPosition && createPortal(
        <div
          ref={tooltipRef}
          className={`
            fixed z-50 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg
            pointer-events-none select-none
            ${interactive ? 'pointer-events-auto' : ''}
            ${className}
          `}
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            maxWidth: maxWidth
          }}
          onMouseEnter={interactive ? () => {} : undefined}
          onMouseLeave={interactive ? hideTooltip : undefined}
        >
          {content}
          
          {arrow && (
            <div
              className="absolute"
              style={getArrowStyle()}
            />
          )}
        </div>,
        document.body
      )}
    </>
  );
};

// Hook for programmatic tooltips
export const useTooltip = () => {
  const [tooltip, setTooltip] = useState<{
    content: React.ReactNode;
    position: { x: number; y: number };
    visible: boolean;
  } | null>(null);

  const showTooltip = useCallback((
    content: React.ReactNode,
    event: React.MouseEvent | MouseEvent
  ) => {
    setTooltip({
      content,
      position: { x: event.clientX, y: event.clientY },
      visible: true
    });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const TooltipComponent = tooltip && (
    <div
      className="fixed z-50 px-3 py-2 text-sm text-white bg-gray-800 rounded-lg shadow-lg pointer-events-none"
      style={{
        left: tooltip.position.x + 10,
        top: tooltip.position.y + 10
      }}
    >
      {tooltip.content}
    </div>
  );

  return {
    showTooltip,
    hideTooltip,
    TooltipComponent
  };
};

// Predefined tooltip variants
export const InfoTooltip: React.FC<Omit<TooltipProps, 'content'> & { info: string }> = ({
  info,
  children,
  ...props
}) => (
  <Tooltip
    content={
      <div className="flex items-start gap-2">
        <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold mt-0.5">
          i
        </div>
        <div>{info}</div>
      </div>
    }
    {...props}
  >
    {children}
  </Tooltip>
);

export const ErrorTooltip: React.FC<Omit<TooltipProps, 'content' | 'className'> & { error: string }> = ({
  error,
  children,
  ...props
}) => (
  <Tooltip
    content={
      <div className="flex items-start gap-2">
        <div className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold mt-0.5">
          !
        </div>
        <div>{error}</div>
      </div>
    }
    className="bg-red-800"
    {...props}
  >
    {children}
  </Tooltip>
);

export const HelpTooltip: React.FC<Omit<TooltipProps, 'content'> & { help: string }> = ({
  help,
  children,
  ...props
}) => (
  <Tooltip
    content={
      <div className="max-w-xs">
        <div className="flex items-start gap-2 mb-2">
          <div className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">
            ?
          </div>
          <div className="font-medium">Подсказка</div>
        </div>
        <div className="text-gray-300">{help}</div>
      </div>
    }
    maxWidth={300}
    {...props}
  >
    {children}
  </Tooltip>
);