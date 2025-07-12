import React, { useState, useRef } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/form/Button';
import { Input } from '../common/form/Input';
import { useToast } from '../common/ToastContainer';
import { Upload, FileSpreadsheet, X, Download, Globe } from 'lucide-react';
import type { ProductImportData } from '../../types';
import * as XLSX from 'xlsx';

interface ProductImportProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportConfig {
  productNameColumn: string;
  categoryColumn: string;
  unitColumn: string;
  barcodeColumn: string;
  descriptionColumn: string;
  priceColumn: string;
  supplierColumn: string;
}

export const ProductImport: React.FC<ProductImportProps> = ({ onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'sheets'>('file');
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [importConfig, setImportConfig] = useState<ImportConfig>({
    productNameColumn: '',
    categoryColumn: '',
    unitColumn: '',
    barcodeColumn: '',
    descriptionColumn: '',
    priceColumn: '',
    supplierColumn: ''
  });
  const [sheetsUrl, setSheetsUrl] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Ошибка', 'Поддерживаются только файлы Excel (.xlsx, .xls) и CSV');
      return;
    }

    try {
      setIsUploading(true);
      
      if (file.type === 'text/csv') {
        await parseCSVFile(file);
      } else {
        await parseExcelFile(file);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки файла:', error);
      toast.error('Ошибка', error.message || 'Не удалось загрузить файл');
    } finally {
      setIsUploading(false);
    }
  };

  const parseExcelFile = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      throw new Error('Файл пуст');
    }

    const headers = jsonData[0] as string[];
    const rows = jsonData.slice(1);
    
    setAvailableColumns(headers);
    setPreviewData(rows.slice(0, 5).map(row => {
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = (row as any[])[index] || '';
      });
      return obj;
    }));

    // Автоматическое сопоставление колонок
    autoMapColumns(headers);
  };

  const parseCSVFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n');
    
    if (lines.length === 0) {
      throw new Error('Файл пуст');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1, 6).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });

    setAvailableColumns(headers);
    setPreviewData(rows);
    autoMapColumns(headers);
  };

  const autoMapColumns = (headers: string[]) => {
    const mapping: Partial<ImportConfig> = {};
    
    // Простое автоматическое сопоставление по ключевым словам
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase();
      
      if (lowerHeader.includes('название') || lowerHeader.includes('наименование') || lowerHeader.includes('product')) {
        mapping.productNameColumn = header;
      } else if (lowerHeader.includes('категория') || lowerHeader.includes('category')) {
        mapping.categoryColumn = header;
      } else if (lowerHeader.includes('единица') || lowerHeader.includes('unit')) {
        mapping.unitColumn = header;
      } else if (lowerHeader.includes('штрихкод') || lowerHeader.includes('barcode')) {
        mapping.barcodeColumn = header;
      } else if (lowerHeader.includes('описание') || lowerHeader.includes('description')) {
        mapping.descriptionColumn = header;
      } else if (lowerHeader.includes('цена') || lowerHeader.includes('price')) {
        mapping.priceColumn = header;
      } else if (lowerHeader.includes('поставщик') || lowerHeader.includes('магазин') || lowerHeader.includes('supplier')) {
        mapping.supplierColumn = header;
      }
    });

    setImportConfig(prev => ({ ...prev, ...mapping }));
  };

  const handleGoogleSheetsImport = async () => {
    if (!sheetsUrl) {
      toast.error('Ошибка', 'Введите URL Google Sheets');
      return;
    }

    try {
      setIsUploading(true);
      
      // Преобразуем URL в CSV export URL
      const csvUrl = sheetsUrl.replace('/edit#gid=', '/export?format=csv&gid=')
                              .replace('/edit?usp=sharing', '/export?format=csv');
      
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('Не удалось получить данные из Google Sheets');
      }

      const csvText = await response.text();
      const lines = csvText.split('\n');
      
      if (lines.length === 0) {
        throw new Error('Google Sheets пуст');
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const rows = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] || '';
        });
        return obj;
      });

      setAvailableColumns(headers);
      setPreviewData(rows);
      autoMapColumns(headers);
      
      toast.success('Успешно', 'Данные из Google Sheets загружены');
    } catch (error: any) {
      console.error('Ошибка импорта из Google Sheets:', error);
      toast.error('Ошибка', error.message || 'Не удалось импортировать из Google Sheets');
    } finally {
      setIsUploading(false);
    }
  };

  const handleImport = async () => {
    if (!importConfig.productNameColumn) {
      toast.error('Ошибка', 'Выберите колонку с названием продукта');
      return;
    }

    try {
      setIsUploading(true);
      
      // Здесь должна быть логика отправки данных на сервер
      // Пока что просто имитируем успешный импорт
      const importData: ProductImportData[] = previewData.map(row => ({
        product_name: row[importConfig.productNameColumn],
        category_name: importConfig.categoryColumn ? row[importConfig.categoryColumn] : undefined,
        unit_measure: importConfig.unitColumn ? row[importConfig.unitColumn] : undefined,
        barcode: importConfig.barcodeColumn ? row[importConfig.barcodeColumn] : undefined,
        description: importConfig.descriptionColumn ? row[importConfig.descriptionColumn] : undefined,
        price_value: importConfig.priceColumn ? parseFloat(row[importConfig.priceColumn]) || undefined : undefined,
        supplier_name: importConfig.supplierColumn ? row[importConfig.supplierColumn] : undefined,
      }));

      // TODO: Реализовать API endpoint для массового импорта
      console.log('Данные для импорта:', importData);
      
      toast.success('Успешно', `Импортировано ${importData.length} продуктов`);
      onSuccess();
    } catch (error: any) {
      console.error('Ошибка импорта:', error);
      toast.error('Ошибка', error.message || 'Не удалось импортировать данные');
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      ['Наименование продукта', 'Категория', 'Единица измерения', 'Штрихкод', 'Описание', 'Цена', 'Поставщик'],
      ['Молоко Простоквашино 2.5%', 'Молочные продукты', 'л', '4607034170011', 'Молоко пастеризованное', '89.90', 'Пятерочка'],
      ['Хлеб Дарницкий', 'Хлебобулочные', 'шт', '4607012345678', 'Хлеб ржано-пшеничный', '45.00', 'Магнит'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Продукты');
    XLSX.writeFile(wb, 'template_products.xlsx');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card title="Импорт продуктов" className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="space-y-6">
          {/* Кнопка закрытия */}
          <div className="flex justify-between items-center">
            <div className="flex space-x-1">
              <button
                className={`px-4 py-2 rounded-md ${
                  activeTab === 'file' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('file')}
              >
                <FileSpreadsheet className="h-4 w-4 inline mr-1" />
                Файл
              </button>
              <button
                className={`px-4 py-2 rounded-md ${
                  activeTab === 'sheets' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('sheets')}
              >
                <Globe className="h-4 w-4 inline mr-1" />
                Google Sheets
              </button>
            </div>
            
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" />
                Скачать шаблон
              </Button>
              <Button variant="secondary" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Вкладка загрузки файла */}
          {activeTab === 'file' && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Перетащите файл сюда или нажмите для выбора
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Поддерживаются файлы Excel (.xlsx, .xls) и CSV
              </p>
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? 'Загрузка...' : 'Выбрать файл'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* Вкладка Google Sheets */}
          {activeTab === 'sheets' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL Google Sheets
                </label>
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetsUrl}
                  onChange={(e) => setSheetsUrl(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Убедитесь, что таблица доступна для просмотра всем пользователям
                </p>
              </div>
              <Button
                onClick={handleGoogleSheetsImport}
                disabled={isUploading || !sheetsUrl}
              >
                {isUploading ? 'Загрузка...' : 'Загрузить из Google Sheets'}
              </Button>
            </div>
          )}

          {/* Предварительный просмотр и настройка колонок */}
          {previewData.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Настройка соответствия колонок</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Название продукта *
                  </label>
                  <select
                    value={importConfig.productNameColumn}
                    onChange={(e) => setImportConfig(prev => ({ ...prev, productNameColumn: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">Выберите колонку</option>
                    {availableColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Категория
                  </label>
                  <select
                    value={importConfig.categoryColumn}
                    onChange={(e) => setImportConfig(prev => ({ ...prev, categoryColumn: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">Не импортировать</option>
                    {availableColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Единица измерения
                  </label>
                  <select
                    value={importConfig.unitColumn}
                    onChange={(e) => setImportConfig(prev => ({ ...prev, unitColumn: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">Не импортировать</option>
                    {availableColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Цена
                  </label>
                  <select
                    value={importConfig.priceColumn}
                    onChange={(e) => setImportConfig(prev => ({ ...prev, priceColumn: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">Не импортировать</option>
                    {availableColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Поставщик/Магазин
                  </label>
                  <select
                    value={importConfig.supplierColumn}
                    onChange={(e) => setImportConfig(prev => ({ ...prev, supplierColumn: e.target.value }))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  >
                    <option value="">Не импортировать</option>
                    {availableColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Предварительный просмотр */}
              <div>
                <h4 className="text-md font-medium mb-2">Предварительный просмотр (первые 5 строк)</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {availableColumns.map(col => (
                          <th key={col} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border-b">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, index) => (
                        <tr key={index} className="border-b">
                          {availableColumns.map(col => (
                            <td key={col} className="px-4 py-2 text-sm text-gray-900">
                              {row[col] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Кнопки действий */}
              <div className="flex justify-end space-x-2">
                <Button variant="secondary" onClick={onClose}>
                  Отмена
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isUploading || !importConfig.productNameColumn}
                >
                  {isUploading ? 'Импорт...' : 'Импортировать'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};