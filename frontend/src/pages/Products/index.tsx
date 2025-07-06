import React, { useState } from 'react';
import { Layout } from '../../components/common/Layout';
import { ProductForm } from '../../components/products/ProductForm';
import { ProductList } from '../../components/products/ProductList';
import { Button } from '../../components/common/form/Button';
import type { Product } from '../../types';

const ProductsPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Список продуктов</h1>
            <p className="mt-1 text-sm text-gray-600">
              Справочник товаров и цен
            </p>
          </div>
          {!showForm && (
            <Button variant="primary" onClick={handleAddProduct}>
              Добавить продукт
            </Button>
          )}
        </div>

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
      </div>
    </Layout>
  );
};

export default ProductsPage;