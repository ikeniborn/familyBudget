import React, { useEffect, useState, useRef, ReactNode } from 'react';
import { ChartTheme } from '../utils/ChartTheme';

interface ResponsiveChartContainerProps {
  children: ReactNode;
  minHeight?: number;
  maxHeight?: number;
  aspectRatio?: number; // width/height ratio
  className?: string;
  onResize?: (width: number, height: number) => void;
}

export const ResponsiveChartContainer: React.FC<ResponsiveChartContainerProps> = ({
  children,
  minHeight = 200,
  maxHeight = 600,
  aspectRatio = 2, // 2:1 ratio by default
  className = '',
  onResize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;

      const { width } = containerRef.current.getBoundingClientRect();
      
      // Calculate height based on aspect ratio, constrained by min/max
      let height = width / aspectRatio;
      height = Math.max(minHeight, Math.min(maxHeight, height));

      setDimensions({ width, height });
      onResize?.(width, height);
    };

    // Initial measurement
    updateDimensions();

    // Setup ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Cleanup
    return () => {
      resizeObserver.disconnect();
    };
  }, [aspectRatio, minHeight, maxHeight, onResize]);

  return (
    <div 
      ref={containerRef}
      className={`w-full ${className}`}
      style={{ height: dimensions.height || minHeight }}
    >
      {children}
    </div>
  );
};

// Mobile-optimized chart container
export const MobileChartContainer: React.FC<{
  children: ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < ChartTheme.breakpoints.tablet);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  return (
    <ResponsiveChartContainer
      minHeight={isMobile ? 250 : 300}
      maxHeight={isMobile ? 350 : 500}
      aspectRatio={isMobile ? 1.2 : 2}
      className={className}
    >
      {children}
    </ResponsiveChartContainer>
  );
};

// Dashboard-optimized chart container
export const DashboardChartContainer: React.FC<{
  children: ReactNode;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}> = ({ children, size = 'medium', className = '' }) => {
  const sizeConfig = {
    small: { minHeight: 150, maxHeight: 250, aspectRatio: 2.5 },
    medium: { minHeight: 200, maxHeight: 300, aspectRatio: 2 },
    large: { minHeight: 300, maxHeight: 450, aspectRatio: 1.8 },
  };

  const config = sizeConfig[size];

  return (
    <ResponsiveChartContainer
      minHeight={config.minHeight}
      maxHeight={config.maxHeight}
      aspectRatio={config.aspectRatio}
      className={className}
    >
      {children}
    </ResponsiveChartContainer>
  );
};

// Full-width chart container for reports
export const ReportChartContainer: React.FC<{
  children: ReactNode;
  fullWidth?: boolean;
  className?: string;
}> = ({ children, fullWidth = true, className = '' }) => {
  return (
    <ResponsiveChartContainer
      minHeight={400}
      maxHeight={600}
      aspectRatio={fullWidth ? 2.5 : 2}
      className={`${fullWidth ? 'col-span-full' : ''} ${className}`}
    >
      {children}
    </ResponsiveChartContainer>
  );
};

// Chart container with automatic breakpoint detection
export const AdaptiveChartContainer: React.FC<{
  children: ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < ChartTheme.breakpoints.mobile) {
        setBreakpoint('mobile');
      } else if (width < ChartTheme.breakpoints.desktop) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);

    return () => {
      window.removeEventListener('resize', updateBreakpoint);
    };
  }, []);

  const config = {
    mobile: { minHeight: 200, maxHeight: 300, aspectRatio: 1 },
    tablet: { minHeight: 250, maxHeight: 400, aspectRatio: 1.5 },
    desktop: { minHeight: 300, maxHeight: 500, aspectRatio: 2 },
  };

  const currentConfig = config[breakpoint];

  return (
    <ResponsiveChartContainer
      minHeight={currentConfig.minHeight}
      maxHeight={currentConfig.maxHeight}
      aspectRatio={currentConfig.aspectRatio}
      className={className}
    >
      {children}
    </ResponsiveChartContainer>
  );
};

export default ResponsiveChartContainer;