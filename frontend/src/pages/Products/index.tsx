import React, { useState } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/form/Button';
import { ProductForm } from '../../components/products/ProductForm';
import { ProductList } from '../../components/products/ProductList';
import { ProductNomenclatureLink } from '../../components/products/ProductNomenclatureLink';
import { ProductAnalytics } from '../../components/products/ProductAnalytics';
import { ProductImport } from '../../components/products/ProductImport';
import { Plus, Link, BarChart3, Settings, Upload } from 'lucide-react';
import type { Product } from '../../types';

const ProductsPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showNomenclatureLink, setShowNomenclatureLink] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const handleAddProduct = () => {
    setEditingProduct(undefined);
    setShowForm(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingProduct(undefined);
    setRefreshKey(prev => prev + 1);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingProduct(undefined);
  };

  const handleNomenclatureLinkSuccess = () => {
    setShowNomenclatureLink(false);
    setRefreshKey(prev => prev + 1);
  };

  const handleImportSuccess = () => {
    setShowImport(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
      <div className="space-y-6">
        {/* Заголовок и действия */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Управление продуктами</h1>
            <p className="text-sm text-gray-600 mt-1">
              Справочник продуктов с возможностью импорта и аналитики цен
            </p>
          </div>
          
          {!showForm && (
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setShowImport(true)}
              >
                <Upload className="h-4 w-4 mr-1" />
                Импорт данных
              </Button>
              
              <Button onClick={handleAddProduct}>
                <Plus className="h-4 w-4 mr-1" />
                Добавить продукт
              </Button>
              
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setShowAnalytics(true)}
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                Аналитика
              </Button>
              
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setShowNomenclatureLink(true)}
              >
                <Link className="h-4 w-4 mr-1" />
                Привязка к номенклатуре
              </Button>
            </div>
          )}
        </div>

        {/* Быстрая статистика */}
        {!showForm && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Settings className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-500">Всего продуктов</div>
                    <div className="text-2xl font-bold text-gray-900">0</div>
                  </div>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Link className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-500">Привязано к номенклатуре</div>
                    <div className="text-2xl font-bold text-gray-900">0</div>
                  </div>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-500">С ценами</div>
                    <div className="text-2xl font-bold text-gray-900">0</div>
                  </div>
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Settings className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-500">Активных</div>
                    <div className="text-2xl font-bold text-gray-900">0</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Контент */}
        {showForm ? (
          <div className="max-w-2xl">
            <ProductForm
              product={editingProduct}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
            />
          </div>
        ) : (
          <ProductList 
            onEdit={handleEditProduct}
            refreshKey={refreshKey}
          />
        )}

        {/* Диалоги */}
        {showNomenclatureLink && (
          <ProductNomenclatureLink
            onClose={() => setShowNomenclatureLink(false)}
            onSuccess={handleNomenclatureLinkSuccess}
          />
        )}

        {showAnalytics && (
          <ProductAnalytics
            onClose={() => setShowAnalytics(false)}
          />
        )}

        {showImport && (
          <ProductImport
            onClose={() => setShowImport(false)}
            onSuccess={handleImportSuccess}
          />
        )}
      </div>
  );
};

export default ProductsPage;