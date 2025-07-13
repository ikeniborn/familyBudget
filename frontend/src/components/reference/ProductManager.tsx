import React, { useState, useEffect, useMemo } from 'react';
import { CRUDTable, CRUDField } from './CRUDTable';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import { useAuthStore } from '../../stores/authStore';
import { apiClient } from '../../api/client';
import {
  Package,
  Search,
  Barcode,
  Tags,
  TrendingUp,
  TrendingDown,
  Image,
  AlertCircle,
  History,
  DollarSign,
  Calendar,
  Filter,
  Camera,
  Upload,
} from 'lucide-react';

interface Product {
  id: number;
  product_id: number;
  product_name: string;
  product_description?: string;
  barcode?: string;
  unit?: string;
  category_ids?: number[];
  images?: string[];
  is_active?: boolean;
  user_id: number;
  created_at?: string;
  updated_at?: string;
  // Calculated fields
  current_price?: number;
  price_trend?: 'up' | 'down' | 'stable';
  price_history?: PriceHistory[];
  last_purchase_date?: string;
  purchase_count?: number;
}

interface PriceHistory {
  id: number;
  product_id: number;
  price: number;
  store?: string;
  date: string;
  created_at: string;
}

interface Nomenclature {
  nomenclature_id: number;
  nomenclature_name: string;
  nomenclature_type: 'INCOME' | 'EXPENSE';
}

export const ProductManager: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [nomenclatures, setNomenclatures] = useState<Nomenclature[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [priceFilter, setPriceFilter] = useState<'all' | 'increased' | 'decreased'>('all');
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const { user } = useAuthStore();

  // Fetch nomenclatures for category linking
  const fetchNomenclatures = async () => {
    if (!user?.user_id) return;
    
    try {
      const response = await apiClient.get(`/nomenclatures?user_id=${user.user_id}`);
      // Filter only expense categories for products
      const expenseCategories = response.data.filter((n: any) => n.nomenclature_type === 'EXPENSE');
      setNomenclatures(expenseCategories);
    } catch (error) {
      console.error('Failed to fetch nomenclatures:', error);
    }
  };

  // Filter products based on search and price filter
  const filteredProducts = useMemo(() => {
    let filtered = products;
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.product_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode?.includes(searchTerm)
      );
    }
    
    // Price filter
    if (priceFilter !== 'all') {
      filtered = filtered.filter(p => {
        if (priceFilter === 'increased') return p.price_trend === 'up';
        if (priceFilter === 'decreased') return p.price_trend === 'down';
        return true;
      });
    }
    
    return filtered;
  }, [products, searchTerm, priceFilter]);

  // Define fields for CRUD table
  const fields: CRUDField<Product>[] = [
    {
      key: 'product_name',
      label: 'Название продукта',
      type: 'text',
      required: true,
      width: 'w-96',
      renderCell: (value, item) => (
        <div className="flex items-center gap-2">
          {item.images && item.images.length > 0 ? (
            <img 
              src={item.images[0]} 
              alt={value} 
              className="w-8 h-8 rounded object-cover"
            />
          ) : (
            <Package className="h-5 w-5 text-gray-400" />
          )}
          <div>
            <div className="font-medium">{value}</div>
            {item.barcode && (
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Barcode className="h-3 w-3" />
                {item.barcode}
              </div>
            )}
          </div>
          {item.price_trend && (
            <Badge 
              variant={item.price_trend === 'up' ? 'destructive' : item.price_trend === 'down' ? 'default' : 'secondary'}
              className="ml-2"
            >
              {item.price_trend === 'up' ? <TrendingUp className="h-3 w-3" /> : 
               item.price_trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
            </Badge>
          )}
        </div>
      ),
      validation: (value) => {
        if (!value || value.trim().length < 2) {
          return 'Название должно содержать минимум 2 символа';
        }
        if (value.trim().length > 200) {
          return 'Название не должно превышать 200 символов';
        }
        return null;
      },
    },
    {
      key: 'product_description',
      label: 'Описание',
      type: 'text',
      width: 'w-96',
      renderCell: (value) => (
        <span className="text-gray-600 text-sm">
          {value || '-'}
        </span>
      ),
    },
    {
      key: 'barcode',
      label: 'Штрихкод',
      type: 'text',
      width: 'w-40',
      renderCell: (value) => value ? (
        <div className="flex items-center gap-1 font-mono text-sm">
          <Barcode className="h-4 w-4 text-gray-400" />
          {value}
        </div>
      ) : '-',
      renderEdit: (value, onChange) => (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 h-8 px-2 border rounded"
            placeholder="1234567890123"
          />
          <button
            onClick={() => {
              // Simulate barcode scanner
              toast({
                title: 'Сканер штрихкода',
                description: 'Функция сканирования будет доступна в мобильном приложении',
              });
            }}
            className="p-1.5 hover:bg-gray-100 rounded"
            title="Сканировать"
          >
            <Camera className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      ),
    },
    {
      key: 'unit',
      label: 'Ед. изм.',
      type: 'select',
      width: 'w-24',
      options: [
        { value: 'шт', label: 'шт' },
        { value: 'кг', label: 'кг' },
        { value: 'л', label: 'л' },
        { value: 'г', label: 'г' },
        { value: 'мл', label: 'мл' },
        { value: 'уп', label: 'уп' },
        { value: 'м', label: 'м' },
        { value: 'м²', label: 'м²' },
      ],
      renderCell: (value) => value || 'шт',
    },
    {
      key: 'current_price',
      label: 'Текущая цена',
      type: 'number',
      width: 'w-32',
      sortable: true,
      renderCell: (value, item) => {
        if (!value) return '-';
        
        return (
          <div className="text-right">
            <div className="font-medium">
              {value.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
            </div>
            {item.last_purchase_date && (
              <div className="text-xs text-gray-500">
                {new Date(item.last_purchase_date).toLocaleDateString('ru-RU')}
              </div>
            )}
          </div>
        );
      },
      renderEdit: () => null, // Read-only, managed through price history
    },
    {
      key: 'category_ids',
      label: 'Категории',
      type: 'custom',
      width: 'w-64',
      renderCell: (value: number[] | undefined, item) => {
        if (!value || value.length === 0) {
          return <span className="text-gray-500">Не назначено</span>;
        }
        
        return (
          <div className="flex flex-wrap gap-1">
            {value.map(catId => {
              const cat = nomenclatures.find(n => n.nomenclature_id === catId);
              return cat ? (
                <Badge key={catId} variant="secondary" className="text-xs">
                  <Tags className="h-3 w-3 mr-1" />
                  {cat.nomenclature_name}
                </Badge>
              ) : null;
            })}
          </div>
        );
      },
      renderEdit: (value, onChange) => (
        <div className="space-y-2">
          <div className="text-sm font-medium mb-1">Выберите категории:</div>
          <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
            {nomenclatures.map(nom => (
              <label key={nom.nomenclature_id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value?.includes(nom.nomenclature_id) || false}
                  onChange={(e) => {
                    const currentIds = value || [];
                    if (e.target.checked) {
                      onChange([...currentIds, nom.nomenclature_id]);
                    } else {
                      onChange(currentIds.filter(id => id !== nom.nomenclature_id));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">{nom.nomenclature_name}</span>
              </label>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'purchase_count',
      label: 'Покупок',
      type: 'number',
      width: 'w-24',
      sortable: true,
      renderCell: (value) => value ? (
        <Badge variant="outline">{value}</Badge>
      ) : '-',
      renderEdit: () => null, // Read-only
    },
    {
      key: 'images',
      label: 'Фото',
      type: 'custom',
      width: 'w-32',
      renderCell: (value: string[] | undefined) => {
        if (!value || value.length === 0) {
          return <Image className="h-4 w-4 text-gray-400" />;
        }
        
        return (
          <div className="flex items-center gap-1">
            <Image className="h-4 w-4 text-gray-600" />
            <span className="text-sm text-gray-600">{value.length} фото</span>
          </div>
        );
      },
      renderEdit: (value, onChange) => (
        <div className="space-y-2">
          <button
            onClick={() => {
              toast({
                title: 'Загрузка изображений',
                description: 'Функция будет доступна в следующей версии',
              });
            }}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-2 text-sm"
          >
            <Upload className="h-4 w-4" />
            Загрузить фото
          </button>
          {value && value.length > 0 && (
            <div className="text-xs text-gray-600">
              Загружено: {value.length} фото
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'is_active',
      label: 'Статус',
      type: 'boolean',
      width: 'w-32',
      renderCell: (value) => value ? (
        <Badge variant="default">Активен</Badge>
      ) : (
        <Badge variant="secondary">Неактивен</Badge>
      ),
    },
  ];

  // Fetch products
  const fetchProducts = async () => {
    if (!user?.user_id) return;
    
    try {
      setLoading(true);
      
      // Fetch nomenclatures first
      await fetchNomenclatures();
      
      // In a real implementation, this would fetch from /products endpoint
      // For now, simulate with sample data
      const sampleProducts: Product[] = [
        {
          id: 1,
          product_id: 1,
          product_name: 'Молоко Простоквашино 3.2%',
          product_description: 'Молоко пастеризованное',
          barcode: '4607004890123',
          unit: 'л',
          category_ids: [],
          current_price: 89.99,
          price_trend: 'up',
          last_purchase_date: '2024-01-15',
          purchase_count: 12,
          is_active: true,
          user_id: user.user_id,
          created_at: '2024-01-01T10:00:00Z',
        },
        {
          id: 2,
          product_id: 2,
          product_name: 'Хлеб Дарницкий',
          product_description: 'Хлеб ржано-пшеничный',
          barcode: '4607004890456',
          unit: 'шт',
          category_ids: [],
          current_price: 45.50,
          price_trend: 'stable',
          last_purchase_date: '2024-01-18',
          purchase_count: 24,
          is_active: true,
          user_id: user.user_id,
          created_at: '2024-01-01T10:00:00Z',
        },
      ];
      
      setProducts(sampleProducts);
      
      // Fetch price history for each product
      await fetchPriceHistory(sampleProducts);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить продукты',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch price history
  const fetchPriceHistory = async (productList: Product[]) => {
    // In a real implementation, this would fetch from API
    // For now, generate sample history
    const updatedProducts = productList.map(product => {
      const history: PriceHistory[] = [];
      let currentPrice = product.current_price || 100;
      
      // Generate 5 historical prices
      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (i * 7)); // Weekly history
        
        const variation = (Math.random() - 0.5) * 10; // ±5 rubles
        currentPrice = Math.max(10, currentPrice + variation);
        
        history.push({
          id: i + 1,
          product_id: product.product_id,
          price: currentPrice,
          store: ['Магнит', 'Пятерочка', 'Перекресток', 'Ашан'][Math.floor(Math.random() * 4)],
          date: date.toISOString().split('T')[0],
          created_at: date.toISOString(),
        });
      }
      
      // Determine price trend
      const oldPrice = history[history.length - 1].price;
      const newPrice = history[0].price;
      const trend = newPrice > oldPrice ? 'up' : newPrice < oldPrice ? 'down' : 'stable';
      
      return {
        ...product,
        price_history: history.reverse(), // Oldest first
        price_trend: trend,
      };
    });
    
    setProducts(updatedProducts);
  };

  useEffect(() => {
    fetchProducts();
  }, [user]);

  // Add product
  const handleAdd = async (data: Omit<Product, 'id'>) => {
    if (!user?.user_id) return;
    
    const newProduct = {
      ...data,
      user_id: user.user_id,
      is_active: data.is_active !== false,
      category_ids: data.category_ids || [],
    };

    try {
      // In real implementation: await apiClient.post('/products', newProduct);
      const tempProduct: Product = {
        ...newProduct,
        id: Date.now(),
        product_id: Date.now(),
        created_at: new Date().toISOString(),
        purchase_count: 0,
      };
      
      setProducts([...products, tempProduct]);
      
      toast({
        title: 'Успешно',
        description: 'Продукт добавлен в каталог',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось добавить продукт');
    }
  };

  // Update product
  const handleUpdate = async (id: number, data: Partial<Product>) => {
    try {
      // In real implementation: await apiClient.put(`/products/${id}`, data);
      setProducts(products.map(p => 
        p.product_id === id ? { ...p, ...data } : p
      ));
      
      toast({
        title: 'Успешно',
        description: 'Продукт обновлен',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось обновить продукт');
    }
  };

  // Delete product
  const handleDelete = async (id: number) => {
    const product = products.find(p => p.product_id === id);
    
    if (product && product.purchase_count && product.purchase_count > 0) {
      const confirmed = window.confirm(
        `Продукт "${product.product_name}" был куплен ${product.purchase_count} раз. Вы уверены, что хотите удалить его?`
      );
      
      if (!confirmed) {
        throw new Error('Удаление отменено');
      }
    }

    try {
      // In real implementation: await apiClient.delete(`/products/${id}`);
      setProducts(products.filter(p => p.product_id !== id));
      
      toast({
        title: 'Успешно',
        description: 'Продукт удален',
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить продукт');
    }
  };

  // Bulk delete
  const handleBulkDelete = async (ids: number[]) => {
    try {
      // In real implementation: await Promise.all(ids.map(id => apiClient.delete(`/products/${id}`)));
      setProducts(products.filter(p => !ids.includes(p.product_id)));
      
      toast({
        title: 'Успешно',
        description: `Удалено продуктов: ${ids.length}`,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Не удалось удалить продукты');
    }
  };

  // Add price to product
  const handleAddPrice = async (productId: number, price: number, store?: string) => {
    try {
      const newPrice: PriceHistory = {
        id: Date.now(),
        product_id: productId,
        price,
        store: store || 'Не указан',
        date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      };
      
      setProducts(products.map(p => {
        if (p.product_id === productId) {
          const history = [...(p.price_history || []), newPrice];
          const oldPrice = p.current_price || price;
          const trend = price > oldPrice ? 'up' : price < oldPrice ? 'down' : 'stable';
          
          return {
            ...p,
            current_price: price,
            price_history: history,
            price_trend: trend,
            last_purchase_date: newPrice.date,
          };
        }
        return p;
      }));
      
      toast({
        title: 'Успешно',
        description: 'Цена добавлена',
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось добавить цену',
        variant: 'destructive',
      });
    }
  };

  // Price history modal
  const PriceHistoryModal = () => {
    if (!selectedProduct || !showPriceHistory) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <History className="h-5 w-5" />
              История цен: {selectedProduct.product_name}
            </h3>
            <button
              onClick={() => {
                setShowPriceHistory(false);
                setSelectedProduct(null);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          {/* Add new price form */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h4 className="font-medium mb-3">Добавить новую цену</h4>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const price = Number(formData.get('price'));
                const store = formData.get('store') as string;
                
                if (price > 0) {
                  handleAddPrice(selectedProduct.product_id, price, store);
                  e.currentTarget.reset();
                }
              }}
              className="flex gap-2"
            >
              <input
                name="price"
                type="number"
                step="0.01"
                placeholder="Цена"
                className="flex-1 px-3 py-2 border rounded"
                required
              />
              <input
                name="store"
                type="text"
                placeholder="Магазин"
                className="flex-1 px-3 py-2 border rounded"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Добавить
              </button>
            </form>
          </div>
          
          {/* Price history table */}
          <div className="space-y-2">
            {selectedProduct.price_history && selectedProduct.price_history.length > 0 ? (
              selectedProduct.price_history.map((price, index) => (
                <div key={price.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium">
                        {price.price.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(price.date).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                    {price.store && (
                      <Badge variant="secondary">{price.store}</Badge>
                    )}
                  </div>
                  {index > 0 && (
                    <div className="text-sm">
                      {(() => {
                        const prevPrice = selectedProduct.price_history![index - 1].price;
                        const diff = price.price - prevPrice;
                        const percent = (diff / prevPrice) * 100;
                        
                        return (
                          <span className={diff > 0 ? 'text-red-600' : diff < 0 ? 'text-green-600' : 'text-gray-500'}>
                            {diff > 0 ? '↑' : diff < 0 ? '↓' : '='} {Math.abs(percent).toFixed(1)}%
                          </span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">
                Нет истории цен для этого продукта
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Custom actions
  const customActions = (item: Product) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setSelectedProduct(item);
        setShowPriceHistory(true);
      }}
      className="p-1 hover:bg-gray-100 rounded"
      title="История цен"
    >
      <History className="h-4 w-4 text-gray-500" />
    </button>
  );

  // Export products
  const handleExport = () => {
    const csvContent = [
      ['ID', 'Название', 'Описание', 'Штрихкод', 'Ед.изм.', 'Текущая цена', 'Категории', 'Покупок', 'Статус'].join(','),
      ...filteredProducts.map(p => {
        const categories = p.category_ids?.map(id => {
          const cat = nomenclatures.find(n => n.nomenclature_id === id);
          return cat?.nomenclature_name || '';
        }).join('; ') || '';
        
        return [
          p.product_id,
          `"${p.product_name}"`,
          `"${p.product_description || ''}"`,
          p.barcode || '',
          p.unit || 'шт',
          p.current_price || '',
          `"${categories}"`,
          p.purchase_count || 0,
          p.is_active ? 'Активен' : 'Неактивен',
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `products_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">Каталог продуктов</p>
              <p>
                Управляйте каталогом продуктов с историей цен. Связывайте продукты с категориями
                для автоматической классификации при создании транзакций.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={barcodeScanning}
              onChange={(e) => setBarcodeScanning(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Сканер штрихкодов</span>
          </label>
        </div>
        
        <div className="mt-4 flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск по названию, описанию или штрихкоду..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          
          {/* Price filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value as any)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="all">Все цены</option>
              <option value="increased">Подорожали</option>
              <option value="decreased">Подешевели</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Barcode scanner info */}
      {barcodeScanning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Barcode className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Сканер штрихкодов</p>
              <p>
                Функция сканирования штрихкодов будет доступна в мобильном приложении.
                Вы сможете быстро добавлять продукты, сканируя их штрихкоды камерой телефона.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <CRUDTable
        title="Продукты и услуги"
        data={filteredProducts}
        fields={fields}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        loading={loading}
        searchable={false} // We have custom search
        exportable={true}
        importable={true}
        onExport={handleExport}
        emptyMessage="Нет добавленных продуктов. Нажмите 'Добавить продукт' для создания нового."
        addButtonText="Добавить продукт"
        customActions={customActions}
      />
      
      {/* Price history modal */}
      <PriceHistoryModal />
    </div>
  );
};