import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/form/Button';
import { Input } from '../common/form/Input';
import { useToast } from '../common/ToastContainer';
import { TrendingUp, TrendingDown, Store, BarChart3, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Product } from '../../types';
import { productService } from '../../services';

interface ProductAnalyticsProps {
  onClose: () => void;
}

interface PriceHistory {
  date: string;
  price: number;
  supplier: string;
}

interface ProductStats {
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  priceVariation: number;
  suppliersCount: number;
  lastUpdateDate: string;
}

export const ProductAnalytics: React.FC<ProductAnalyticsProps> = ({ onClose }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [productStats, setProductStats] = useState<ProductStats | null>(null);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [searchTerm, setSearchTerm] = useState('');
  
  const toast = useToast();

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      loadProductAnalytics();
    }
  }, [selectedProductId, dateRange]);

  const loadProducts = async () => {
    try {
      const data = await productService.getAll();
      setProducts(data.filter(p => p.is_active));
    } catch (error: any) {
      console.error('Ошибка загрузки продуктов:', error);
      toast.error('Ошибка', error.message || 'Не удалось загрузить продукты');
    } finally {
      // Loading state handled
    }
  };

  const loadProductAnalytics = async () => {
    try {
      
      // Моковые данные для демонстрации
      const mockPriceHistory: PriceHistory[] = [
        { date: '2024-01-01', price: 85.00, supplier: 'Пятерочка' },
        { date: '2024-01-15', price: 87.50, supplier: 'Магнит' },
        { date: '2024-02-01', price: 89.90, supplier: 'Пятерочка' },
        { date: '2024-02-15', price: 92.00, supplier: 'Ашан' },
        { date: '2024-03-01', price: 88.00, supplier: 'Магнит' },
        { date: '2024-03-15', price: 91.50, supplier: 'Пятерочка' },
      ];
      
      const mockStats: ProductStats = {
        averagePrice: 89.15,
        minPrice: 85.00,
        maxPrice: 92.00,
        priceVariation: 7.82,
        suppliersCount: 3,
        lastUpdateDate: '2024-03-15'
      };
      
      setPriceHistory(mockPriceHistory);
      setProductStats(mockStats);
    } catch (error: any) {
      console.error('Ошибка загрузки аналитики:', error);
      toast.error('Ошибка', error.message || 'Не удалось загрузить аналитику');
    } finally {
      // Loading state handled
    }
  };

  const filteredProducts = products.filter(product => 
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProduct = products.find(p => p.product_id === selectedProductId);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card 
        title={
          <div className="flex items-center justify-between">
            <span>Аналитика по продуктам</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="ml-auto -mr-2"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        }
        className="w-full max-w-7xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Выберите продукт
              </label>
              <div className="space-y-2">
                <Input
                  placeholder="Поиск продуктов..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                  value={selectedProductId || ''}
                  onChange={(e) => setSelectedProductId(parseInt(e.target.value) || null)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Выберите продукт</option>
                  {filteredProducts.map(product => (
                    <option key={product.product_id} value={product.product_id}>
                      {product.product_name} {product.category_name && `(${product.category_name})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Период
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as 'week' | 'month' | 'quarter' | 'year')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
                <option value="quarter">Квартал</option>
                <option value="year">Год</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <Button variant="secondary" onClick={onClose} className="w-full">
                Закрыть
              </Button>
            </div>
          </div>

          {selectedProduct && productStats && (
            <>
              <Card title={`Анализ: ${selectedProduct.product_name}`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <BarChart3 className="h-8 w-8 text-blue-600" />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-blue-600">Средняя цена</div>
                        <div className="text-2xl font-bold text-blue-900">
                          {formatPrice(productStats.averagePrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <TrendingDown className="h-8 w-8 text-green-600" />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-green-600">Мин. цена</div>
                        <div className="text-2xl font-bold text-green-900">
                          {formatPrice(productStats.minPrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <TrendingUp className="h-8 w-8 text-red-600" />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-red-600">Макс. цена</div>
                        <div className="text-2xl font-bold text-red-900">
                          {formatPrice(productStats.maxPrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center">
                      <Store className="h-8 w-8 text-purple-600" />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-purple-600">Поставщиков</div>
                        <div className="text-2xl font-bold text-purple-900">
                          {productStats.suppliersCount}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="История цен">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => formatDate(value)}
                      />
                      <YAxis 
                        tickFormatter={(value) => `${value} ₽`}
                      />
                      <Tooltip 
                        formatter={(value: number) => [formatPrice(value), 'Цена']}
                        labelFormatter={(label) => `Дата: ${formatDate(label)}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}

          {!selectedProduct && (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <div className="text-xl font-medium text-gray-900 mb-2">
                Выберите продукт для анализа
              </div>
              <div className="text-gray-500">
                Выберите продукт из списка выше, чтобы увидеть подробную аналитику по ценам
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};