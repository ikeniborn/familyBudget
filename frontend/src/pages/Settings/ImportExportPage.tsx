import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { FileText, Upload, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';

export const ImportExportPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-slate-600" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Импорт и Экспорт данных</h1>
          <p className="text-slate-600">Массовое обновление справочников через файлы</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Импорт данных
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Загрузите файл Excel или CSV для массового импорта данных в справочники.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Поддерживаемые форматы:</p>
                    <ul className="list-disc list-inside mt-1">
                      <li>Excel (.xlsx, .xls)</li>
                      <li>CSV (.csv)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Выберите тип данных</label>
              <select className="w-full px-3 py-2 border rounded-lg">
                <option value="">Выберите тип данных</option>
                <option value="periods">Периоды</option>
                <option value="financial-centers">Финансовые центры</option>
                <option value="cost-centers">Центры затрат</option>
                <option value="nomenclatures">Номенклатуры</option>
                <option value="products">Продукты</option>
              </select>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600 mb-2">
                Перетащите файл сюда или нажмите для выбора
              </p>
              <Button variant="outline" size="sm">
                Выбрать файл
              </Button>
            </div>

            <Button className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Начать импорт
            </Button>
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Экспорт данных
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Выберите данные для экспорта в файл.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">Тип данных</label>
              <select className="w-full px-3 py-2 border rounded-lg">
                <option value="">Выберите тип данных</option>
                <option value="periods">Периоды</option>
                <option value="financial-centers">Финансовые центры</option>
                <option value="cost-centers">Центры затрат</option>
                <option value="nomenclatures">Номенклатуры</option>
                <option value="products">Продукты</option>
                <option value="all">Все справочники</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Формат файла</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="format" value="excel" defaultChecked />
                  <span className="text-sm">Excel (.xlsx)</span>
                </label>
                <label className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="format" value="csv" />
                  <span className="text-sm">CSV (.csv)</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Дополнительные опции</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span className="text-sm">Включить заголовки</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" />
                  <span className="text-sm">Только активные записи</span>
                </label>
              </div>
            </div>

            <Button className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Скачать файл
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Templates Section */}
      <Card>
        <CardHeader>
          <CardTitle>Шаблоны для импорта</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Скачайте шаблоны файлов с правильной структурой для импорта данных.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {['Периоды', 'Финансовые центры', 'Центры затрат', 'Номенклатуры', 'Продукты'].map((template) => (
              <Button key={template} variant="outline" size="sm" className="w-full">
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                {template}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};