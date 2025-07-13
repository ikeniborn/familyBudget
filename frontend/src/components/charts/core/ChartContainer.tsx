import React, { useRef, useState, useCallback, ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { Download, Maximize2, Minimize2 } from 'lucide-react';
import { ChartTheme } from '../utils/ChartTheme';
import { exportChartAsPNG, exportChartAsSVG } from '../utils/chartExport';

interface ChartContainerProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  height?: number | string;
  className?: string;
  loading?: boolean;
  error?: string | null;
  exportable?: boolean;
  fullscreenable?: boolean;
  controls?: ReactNode;
  footer?: ReactNode;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  subtitle,
  children,
  height = ChartTheme.sizes.medium.height,
  className = '',
  loading = false,
  error = null,
  exportable = true,
  fullscreenable = true,
  controls,
  footer,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPNG = useCallback(async () => {
    if (!chartRef.current || isExporting) return;
    
    setIsExporting(true);
    try {
      await exportChartAsPNG(chartRef.current, title || 'chart');
    } catch (error) {
      console.error('Failed to export chart as PNG:', error);
    } finally {
      setIsExporting(false);
    }
  }, [title, isExporting]);

  const handleExportSVG = useCallback(async () => {
    if (!chartRef.current || isExporting) return;
    
    setIsExporting(true);
    try {
      await exportChartAsSVG(chartRef.current, title || 'chart');
    } catch (error) {
      console.error('Failed to export chart as SVG:', error);
    } finally {
      setIsExporting(false);
    }
  }, [title, isExporting]);

  const toggleFullscreen = useCallback(() => {
    if (!chartRef.current) return;

    if (!isFullscreen) {
      // Enter fullscreen
      const elem = chartRef.current.parentElement;
      if (elem?.requestFullscreen) {
        elem.requestFullscreen();
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  // Handle loading state
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          {title && <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>}
          {subtitle && <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>}
          <div className="bg-gray-200 rounded" style={{ height }}></div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        {title && <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>}
        <div 
          className="flex items-center justify-center bg-red-50 border border-red-200 rounded-lg p-8"
          style={{ height }}
        >
          <div className="text-center">
            <p className="text-red-600 font-medium">Ошибка загрузки данных</p>
            <p className="text-red-500 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      {(title || subtitle || exportable || fullscreenable || controls) && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {title && (
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              )}
              {subtitle && (
                <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>
            
            <div className="flex items-center gap-2 ml-4">
              {controls}
              
              {exportable && (
                <div className="relative group">
                  <button
                    onClick={handleExportPNG}
                    disabled={isExporting}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                    title="Экспорт графика"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  
                  {/* Export dropdown */}
                  <div className="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                    <button
                      onClick={handleExportPNG}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-md"
                    >
                      Экспорт PNG
                    </button>
                    <button
                      onClick={handleExportSVG}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-b-md"
                    >
                      Экспорт SVG
                    </button>
                  </div>
                </div>
              )}
              
              {fullscreenable && (
                <button
                  onClick={toggleFullscreen}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  title={isFullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Chart content */}
      <div className="p-6" ref={chartRef}>
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      </div>
      
      {/* Footer */}
      {footer && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          {footer}
        </div>
      )}
    </div>
  );
};

// Loading skeleton component
export const ChartSkeleton: React.FC<{ height?: number | string }> = ({ 
  height = ChartTheme.sizes.medium.height 
}) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
      <div className="bg-gray-200 rounded" style={{ height }}></div>
    </div>
  </div>
);

// Empty state component
export const ChartEmpty: React.FC<{ 
  message?: string;
  height?: number | string;
}> = ({ 
  message = 'Нет данных для отображения',
  height = ChartTheme.sizes.medium.height 
}) => (
  <div 
    className="flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
    style={{ height }}
  >
    <p className="text-gray-500">{message}</p>
  </div>
);

export default ChartContainer;