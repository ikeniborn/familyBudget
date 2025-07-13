import { useCallback, useState } from 'react';
import { 
  exportChartAsPNG, 
  exportChartAsSVG, 
  copyChartToClipboard, 
  printChart, 
  exportChartDataAsCSV 
} from '../utils/chartExport';

export interface UseChartExportOptions {
  filename?: string;
  onExportStart?: () => void;
  onExportSuccess?: (format: string) => void;
  onExportError?: (error: Error) => void;
}

export interface UseChartExportReturn {
  exportPNG: (element: HTMLElement) => Promise<void>;
  exportSVG: (element: HTMLElement) => Promise<void>;
  copyToClipboard: (element: HTMLElement) => Promise<void>;
  print: (element: HTMLElement, title?: string) => void;
  exportDataCSV: (data: any[], columns: Array<{ key: string; label: string }>) => void;
  isExporting: boolean;
  lastError: string | null;
}

/**
 * Hook for managing chart export functionality
 */
export function useChartExport(options: UseChartExportOptions = {}): UseChartExportReturn {
  const [isExporting, setIsExporting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const {
    filename = 'chart',
    onExportStart,
    onExportSuccess,
    onExportError,
  } = options;

  const handleExport = useCallback(async (
    exportFn: () => Promise<void>,
    format: string
  ) => {
    try {
      setIsExporting(true);
      setLastError(null);
      onExportStart?.();
      
      await exportFn();
      
      onExportSuccess?.(format);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      setLastError(errorMessage);
      onExportError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsExporting(false);
    }
  }, [onExportStart, onExportSuccess, onExportError]);

  const exportPNG = useCallback(async (element: HTMLElement) => {
    await handleExport(
      () => exportChartAsPNG(element, filename),
      'PNG'
    );
  }, [filename, handleExport]);

  const exportSVG = useCallback(async (element: HTMLElement) => {
    await handleExport(
      () => exportChartAsSVG(element, filename),
      'SVG'
    );
  }, [filename, handleExport]);

  const copyToClipboard = useCallback(async (element: HTMLElement) => {
    await handleExport(
      () => copyChartToClipboard(element),
      'Clipboard'
    );
  }, [handleExport]);

  const print = useCallback((element: HTMLElement, title?: string) => {
    try {
      setLastError(null);
      printChart(element, title || filename);
      onExportSuccess?.('Print');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Print failed';
      setLastError(errorMessage);
      onExportError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [filename, onExportSuccess, onExportError]);

  const exportDataCSV = useCallback((
    data: any[],
    columns: Array<{ key: string; label: string }>
  ) => {
    try {
      setLastError(null);
      exportChartDataAsCSV(data, columns, filename);
      onExportSuccess?.('CSV');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'CSV export failed';
      setLastError(errorMessage);
      onExportError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [filename, onExportSuccess, onExportError]);

  return {
    exportPNG,
    exportSVG,
    copyToClipboard,
    print,
    exportDataCSV,
    isExporting,
    lastError,
  };
}