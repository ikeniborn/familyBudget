import { writable, type Readable } from 'svelte/store';
import { 
  exportChartAsPNG, 
  exportChartAsSVG, 
  copyChartToClipboard, 
  printChart, 
  exportChartDataAsCSV 
} from '../../utils/charts/chartExport';

export interface ChartExportOptions {
  filename?: string;
  onExportStart?: () => void;
  onExportSuccess?: (format: string) => void;
  onExportError?: (error: Error) => void;
}

export interface ChartExportStore {
  isExporting: Readable<boolean>;
  lastError: Readable<string | null>;
  exportPNG: (element: HTMLElement) => Promise<void>;
  exportSVG: (element: HTMLElement) => Promise<void>;
  copyToClipboard: (element: HTMLElement) => Promise<void>;
  print: (element: HTMLElement, title?: string) => void;
  exportDataCSV: (data: any[], columns: Array<{ key: string; label: string }>) => void;
}

/**
 * Store for managing chart export functionality
 */
export function createChartExportStore(options: ChartExportOptions = {}): ChartExportStore {
  const isExporting = writable(false);
  const lastError = writable<string | null>(null);
  
  const {
    filename = 'chart',
    onExportStart,
    onExportSuccess,
    onExportError,
  } = options;

  const handleExport = async (
    exportFn: () => Promise<void>,
    format: string
  ) => {
    try {
      isExporting.set(true);
      lastError.set(null);
      onExportStart?.();
      
      await exportFn();
      
      onExportSuccess?.(format);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      lastError.set(errorMessage);
      onExportError?.(error instanceof Error ? error : new Error(errorMessage));
    } finally {
      isExporting.set(false);
    }
  };

  const exportPNG = async (element: HTMLElement) => {
    await handleExport(
      () => exportChartAsPNG(element, filename),
      'PNG'
    );
  };

  const exportSVG = async (element: HTMLElement) => {
    await handleExport(
      () => exportChartAsSVG(element, filename),
      'SVG'
    );
  };

  const copyToClipboard = async (element: HTMLElement) => {
    await handleExport(
      () => copyChartToClipboard(element),
      'Clipboard'
    );
  };

  const print = (element: HTMLElement, title?: string) => {
    try {
      lastError.set(null);
      printChart(element, title || filename);
      onExportSuccess?.('Print');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Print failed';
      lastError.set(errorMessage);
      onExportError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  };

  const exportDataCSV = (
    data: any[],
    columns: Array<{ key: string; label: string }>
  ) => {
    try {
      lastError.set(null);
      exportChartDataAsCSV(data, columns, filename);
      onExportSuccess?.('CSV');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'CSV export failed';
      lastError.set(errorMessage);
      onExportError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  };

  return {
    isExporting: { subscribe: isExporting.subscribe },
    lastError: { subscribe: lastError.subscribe },
    exportPNG,
    exportSVG,
    copyToClipboard,
    print,
    exportDataCSV,
  };
}