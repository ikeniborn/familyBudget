// Chart export utilities for PNG and SVG formats
import type { Chart } from 'chart.js';

export interface ExportOptions {
  filename?: string;
  backgroundColor?: string;
  quality?: number; // 0.0 to 1.0 for JPEG/WebP
  width?: number;
  height?: number;
}

// Export chart to PNG using canvas toDataURL
export async function exportToPNG(
  chart: Chart | HTMLCanvasElement,
  options: ExportOptions = {}
): Promise<void> {
  const {
    filename = 'chart',
    backgroundColor = '#FFFFFF',
    quality = 0.92,
    width,
    height,
  } = options;

  let canvas: HTMLCanvasElement;

  if (chart instanceof HTMLCanvasElement) {
    canvas = chart;
  } else {
    canvas = chart.canvas;
  }

  // Create a new canvas with background color
  const exportCanvas = document.createElement('canvas');
  const ctx = exportCanvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Set dimensions
  exportCanvas.width = width || canvas.width;
  exportCanvas.height = height || canvas.height;

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  // Draw the chart
  ctx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);

  // Convert to blob and download
  exportCanvas.toBlob((blob) => {
    if (!blob) {
      throw new Error('Could not create blob from canvas');
    }
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 'image/png', quality);
}

// Export chart to SVG (requires chart.js with SVG support or canvas-to-svg conversion)
export async function exportToSVG(
  chart: Chart | HTMLCanvasElement,
  options: ExportOptions = {}
): Promise<void> {
  const {
    filename = 'chart',
    backgroundColor = '#FFFFFF',
    width,
    height,
  } = options;

  let canvas: HTMLCanvasElement;

  if (chart instanceof HTMLCanvasElement) {
    canvas = chart;
  } else {
    canvas = chart.canvas;
  }

  // Since Chart.js doesn't natively support SVG export, we'll convert canvas to SVG
  const canvasWidth = width || canvas.width;
  const canvasHeight = height || canvas.height;

  // Get canvas data URL
  const dataURL = canvas.toDataURL('image/png', 0.95);

  // Create SVG with embedded image
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${canvasWidth}" height="${canvasHeight}" 
     xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink">
  <rect width="100%" height="100%" fill="${backgroundColor}"/>
  <image x="0" y="0" width="${canvasWidth}" height="${canvasHeight}" 
         xlink:href="${dataURL}"/>
</svg>`;

  // Create blob and download
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Main export function that determines format
export async function chartExport(
  chart: Chart | HTMLCanvasElement,
  filename = 'chart',
  format: 'png' | 'svg' = 'png',
  options: Omit<ExportOptions, 'filename'> = {}
): Promise<void> {
  const exportOptions = { ...options, filename };

  switch (format.toLowerCase()) {
    case 'png':
      return exportToPNG(chart, exportOptions);
    case 'svg':
      return exportToSVG(chart, exportOptions);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// Utility to capture chart as base64 data URL
export function chartToDataURL(
  chart: Chart | HTMLCanvasElement,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality = 0.92,
  backgroundColor = '#FFFFFF'
): string {
  let canvas: HTMLCanvasElement;

  if (chart instanceof HTMLCanvasElement) {
    canvas = chart;
  } else {
    canvas = chart.canvas;
  }

  // Create temporary canvas with background
  const tempCanvas = document.createElement('canvas');
  const ctx = tempCanvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // Draw chart
  ctx.drawImage(canvas, 0, 0);

  // Return data URL
  const mimeType = `image/${format}`;
  return tempCanvas.toDataURL(mimeType, quality);
}

// Copy chart to clipboard (modern browsers only)
export async function copyChartToClipboard(
  chart: Chart | HTMLCanvasElement,
  options: ExportOptions = {}
): Promise<void> {
  if (!navigator.clipboard || !window.ClipboardItem) {
    throw new Error('Clipboard API not supported in this browser');
  }

  let canvas: HTMLCanvasElement;

  if (chart instanceof HTMLCanvasElement) {
    canvas = chart;
  } else {
    canvas = chart.canvas;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Could not create blob from canvas'));
        return;
      }

      try {
        const item = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
        resolve();
      } catch (error) {
        reject(error);
      }
    }, 'image/png', options.quality || 0.92);
  });
}

// Print chart
export function printChart(
  chart: Chart | HTMLCanvasElement,
  options: ExportOptions = {}
): void {
  const {
    filename = 'chart',
    backgroundColor = '#FFFFFF',
  } = options;

  let canvas: HTMLCanvasElement;

  if (chart instanceof HTMLCanvasElement) {
    canvas = chart;
  } else {
    canvas = chart.canvas;
  }

  const dataURL = chartToDataURL(canvas, 'png', 0.95, backgroundColor);
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Could not open print window');
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${filename}</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          img {
            max-width: 100%;
            height: auto;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <img src="${dataURL}" alt="${filename}" />
      </body>
    </html>
  `);
  
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}