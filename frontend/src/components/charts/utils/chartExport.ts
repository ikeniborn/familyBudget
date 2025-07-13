/**
 * Chart export utilities for PNG and SVG formats
 */

import html2canvas from 'html2canvas';

/**
 * Export chart as PNG image
 */
export async function exportChartAsPNG(
  element: HTMLElement,
  filename: string = 'chart'
): Promise<void> {
  try {
    // Create canvas from element
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2, // Higher quality
      logging: false,
      useCORS: true,
    });

    // Convert to blob
    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error('Failed to create image blob');
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.png`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch (error) {
    console.error('Error exporting chart as PNG:', error);
    throw error;
  }
}

/**
 * Export chart as SVG
 */
export async function exportChartAsSVG(
  element: HTMLElement,
  filename: string = 'chart'
): Promise<void> {
  try {
    // Find SVG element within the container
    const svgElement = element.querySelector('svg');
    if (!svgElement) {
      throw new Error('No SVG element found in chart');
    }

    // Clone SVG to avoid modifying the original
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;
    
    // Add background
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', 'white');
    clonedSvg.insertBefore(rect, clonedSvg.firstChild);

    // Add styles
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
      text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .recharts-cartesian-axis-tick { fill: #6B7280; }
      .recharts-legend-item-text { fill: #374151; }
    `;
    clonedSvg.insertBefore(style, clonedSvg.firstChild);

    // Convert to string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);
    
    // Create blob
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.svg`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting chart as SVG:', error);
    throw error;
  }
}

/**
 * Copy chart as image to clipboard
 */
export async function copyChartToClipboard(element: HTMLElement): Promise<void> {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
    });

    canvas.toBlob(async (blob) => {
      if (!blob) {
        throw new Error('Failed to create image blob');
      }

      try {
        // Use Clipboard API if available
        if (navigator.clipboard && 'write' in navigator.clipboard) {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob
            })
          ]);
        } else {
          throw new Error('Clipboard API not supported');
        }
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        throw err;
      }
    }, 'image/png');
  } catch (error) {
    console.error('Error copying chart to clipboard:', error);
    throw error;
  }
}

/**
 * Print chart
 */
export function printChart(element: HTMLElement, title?: string): void {
  try {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Failed to open print window');
    }

    const styles = Array.from(document.styleSheets)
      .map(styleSheet => {
        try {
          return Array.from(styleSheet.cssRules)
            .map(rule => rule.cssText)
            .join('\n');
        } catch (e) {
          // Handle cross-origin stylesheets
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = styleSheet.href || '';
          return link.outerHTML;
        }
      })
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || 'Chart'}</title>
          <style>
            ${styles}
            @media print {
              body { margin: 0; }
              .chart-container { 
                width: 100%; 
                max-width: 100%;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="chart-container">
            ${element.innerHTML}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  } catch (error) {
    console.error('Error printing chart:', error);
    throw error;
  }
}

/**
 * Get chart data as CSV
 */
export function exportChartDataAsCSV(
  data: any[],
  columns: { key: string; label: string }[],
  filename: string = 'chart-data'
): void {
  try {
    // Create CSV header
    const header = columns.map(col => col.label).join(',');
    
    // Create CSV rows
    const rows = data.map(row => 
      columns.map(col => {
        const value = row[col.key];
        // Escape values containing commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    );
    
    // Combine header and rows
    const csv = [header, ...rows].join('\n');
    
    // Add BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting chart data as CSV:', error);
    throw error;
  }
}

// Install html2canvas if not already installed
// npm install html2canvas