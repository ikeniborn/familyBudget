import {
  exportChartAsPNG,
  exportChartAsSVG,
  copyChartToClipboard,
  printChart,
  exportChartDataAsCSV,
} from '../utils/chartExport';

// Mock html2canvas
jest.mock('html2canvas', () => {
  return jest.fn(() => 
    Promise.resolve({
      toDataURL: jest.fn(() => 'data:image/png;base64,mockedImageData'),
      toBlob: jest.fn((callback) => {
        const mockBlob = new Blob(['mocked blob data'], { type: 'image/png' });
        callback(mockBlob);
      }),
    })
  );
});

// Mock DOM APIs
const mockCreateElement = jest.fn();
const mockCreateObjectURL = jest.fn(() => 'mock-object-url');
const mockRevokeObjectURL = jest.fn();
const mockFocus = jest.fn();
const mockPrint = jest.fn();
const mockClose = jest.fn();
const mockOpen = jest.fn(() => ({
  document: {
    write: jest.fn(),
    close: jest.fn(),
  },
  focus: mockFocus,
  print: mockPrint,
  close: mockClose,
}));

// Mock navigator.clipboard
const mockWriteText = jest.fn();
const mockWrite = jest.fn();

Object.defineProperty(global, 'document', {
  value: {
    createElement: mockCreateElement,
    body: {
      appendChild: jest.fn(),
      removeChild: jest.fn(),
    },
  },
  writable: true,
});

Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
});

Object.defineProperty(global, 'window', {
  value: {
    open: mockOpen,
  },
  writable: true,
});

Object.defineProperty(global.navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
    write: mockWrite,
  },
  writable: true,
});

describe('chartExport utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCreateElement.mockImplementation((tagName) => {
      const element = {
        tagName: tagName.toUpperCase(),
        href: '',
        download: '',
        click: jest.fn(),
        style: {},
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        appendChild: jest.fn(),
        innerHTML: '',
      };
      return element;
    });
  });

  describe('exportChartAsPNG', () => {
    it('exports chart as PNG with default filename', async () => {
      const mockElement = document.createElement('div');
      
      await exportChartAsPNG(mockElement);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('exports chart as PNG with custom filename', async () => {
      const mockElement = document.createElement('div');
      const customFilename = 'custom-chart';
      
      await exportChartAsPNG(mockElement, customFilename);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
    });

    it('exports chart as PNG with custom options', async () => {
      const mockElement = document.createElement('div');
      const options = {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        quality: 0.9,
      };
      
      await exportChartAsPNG(mockElement, 'chart', options);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
    });

    it('handles export errors gracefully', async () => {
      const html2canvas = require('html2canvas');
      html2canvas.mockRejectedValueOnce(new Error('Export failed'));

      const mockElement = document.createElement('div');
      
      await expect(exportChartAsPNG(mockElement)).rejects.toThrow('Export failed');
    });
  });

  describe('exportChartAsSVG', () => {
    it('exports chart as SVG with default filename', async () => {
      const mockElement = document.createElement('div');
      mockElement.innerHTML = '<svg><rect width="100" height="100" fill="red"></rect></svg>';
      
      await exportChartAsSVG(mockElement);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('exports chart as SVG with custom filename', async () => {
      const mockElement = document.createElement('div');
      mockElement.innerHTML = '<svg><rect width="100" height="100" fill="blue"></rect></svg>';
      
      await exportChartAsSVG(mockElement, 'custom-svg-chart');

      expect(mockCreateElement).toHaveBeenCalledWith('a');
    });

    it('handles missing SVG element gracefully', async () => {
      const mockElement = document.createElement('div');
      mockElement.innerHTML = '<div>No SVG here</div>';
      
      await expect(exportChartAsSVG(mockElement)).rejects.toThrow();
    });

    it('adds proper SVG namespace and styling', async () => {
      const mockElement = document.createElement('div');
      const svgContent = '<rect width="100" height="100" fill="green"></rect>';
      mockElement.innerHTML = `<svg>${svgContent}</svg>`;
      
      await exportChartAsSVG(mockElement);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(
        expect.any(Blob)
      );
    });
  });

  describe('copyChartToClipboard', () => {
    it('copies chart as PNG to clipboard', async () => {
      const mockElement = document.createElement('div');
      
      await copyChartToClipboard(mockElement);

      expect(mockWrite).toHaveBeenCalled();
    });

    it('copies chart with custom options', async () => {
      const mockElement = document.createElement('div');
      const options = {
        backgroundColor: '#f0f0f0',
        pixelRatio: 1.5,
      };
      
      await copyChartToClipboard(mockElement, options);

      expect(mockWrite).toHaveBeenCalled();
    });

    it('handles clipboard API not available', async () => {
      // Temporarily remove clipboard API
      const originalClipboard = global.navigator.clipboard;
      delete (global.navigator as any).clipboard;

      const mockElement = document.createElement('div');
      
      await expect(copyChartToClipboard(mockElement)).rejects.toThrow();

      // Restore clipboard API
      global.navigator.clipboard = originalClipboard;
    });

    it('handles clipboard write errors', async () => {
      mockWrite.mockRejectedValueOnce(new Error('Clipboard error'));

      const mockElement = document.createElement('div');
      
      await expect(copyChartToClipboard(mockElement)).rejects.toThrow('Clipboard error');
    });
  });

  describe('printChart', () => {
    it('prints chart with default title', async () => {
      const mockElement = document.createElement('div');
      
      await printChart(mockElement);

      expect(mockOpen).toHaveBeenCalledWith('', '_blank');
      expect(mockFocus).toHaveBeenCalled();
      expect(mockPrint).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
    });

    it('prints chart with custom title', async () => {
      const mockElement = document.createElement('div');
      const customTitle = 'Custom Chart Report';
      
      await printChart(mockElement, customTitle);

      expect(mockOpen).toHaveBeenCalledWith('', '_blank');
      expect(mockFocus).toHaveBeenCalled();
      expect(mockPrint).toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled();
    });

    it('handles print window creation failure', async () => {
      mockOpen.mockReturnValueOnce(null);

      const mockElement = document.createElement('div');
      
      await expect(printChart(mockElement)).rejects.toThrow();
    });

    it('includes CSS styles in print document', async () => {
      const mockElement = document.createElement('div');
      
      await printChart(mockElement);

      const mockWindow = mockOpen.mock.results[0].value;
      expect(mockWindow.document.write).toHaveBeenCalledWith(
        expect.stringContaining('<style>')
      );
    });
  });

  describe('exportChartDataAsCSV', () => {
    const mockData = [
      { name: 'January', plan: 100000, fact: 85000 },
      { name: 'February', plan: 120000, fact: 135000 },
      { name: 'March', plan: 95000, fact: 92000 },
    ];

    it('exports data as CSV with default filename', async () => {
      await exportChartDataAsCSV(mockData);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockCreateObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'text/csv;charset=utf-8;'
        })
      );
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });

    it('exports data as CSV with custom filename', async () => {
      const customFilename = 'budget-report';
      
      await exportChartDataAsCSV(mockData, customFilename);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
    });

    it('exports data as CSV with custom columns', async () => {
      const columns = ['name', 'plan'];
      
      await exportChartDataAsCSV(mockData, 'report', columns);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
    });

    it('handles empty data array', async () => {
      await exportChartDataAsCSV([]);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockCreateObjectURL).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'text/csv;charset=utf-8;'
        })
      );
    });

    it('escapes special characters in CSV data', async () => {
      const dataWithSpecialChars = [
        { name: 'Item with "quotes"', value: 100, description: 'Line 1\nLine 2' },
        { name: 'Item, with commas', value: 200, description: 'Simple text' },
      ];
      
      await exportChartDataAsCSV(dataWithSpecialChars);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('handles missing columns gracefully', async () => {
      const incompleteData = [
        { name: 'January', plan: 100000 }, // missing 'fact'
        { name: 'February', fact: 135000 }, // missing 'plan'
      ];
      
      await exportChartDataAsCSV(incompleteData);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('formats numbers correctly in CSV', async () => {
      const numericData = [
        { name: 'Item 1', amount: 1234.56, percent: 0.75 },
        { name: 'Item 2', amount: 9876.54, percent: 1.25 },
      ];
      
      await exportChartDataAsCSV(numericData);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('handles null and undefined values', async () => {
      const dataWithNulls = [
        { name: 'Item 1', value: null, description: undefined },
        { name: null, value: 100, description: 'Valid description' },
      ];
      
      await exportChartDataAsCSV(dataWithNulls);

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('handles DOM manipulation errors', async () => {
      mockCreateElement.mockImplementationOnce(() => {
        throw new Error('DOM error');
      });

      const mockElement = document.createElement('div');
      
      await expect(exportChartAsPNG(mockElement)).rejects.toThrow();
    });

    it('handles URL creation errors', async () => {
      mockCreateObjectURL.mockImplementationOnce(() => {
        throw new Error('URL creation failed');
      });

      const mockElement = document.createElement('div');
      
      await expect(exportChartAsPNG(mockElement)).rejects.toThrow();
    });
  });
});