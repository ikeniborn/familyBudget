import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/form/Button';
import { Input } from '../common/form/Input';
import { useToast } from '../common/ToastContainer';
import { Link, Unlink, Plus, Search, X } from 'lucide-react';
import type { Nomenclature } from '../../types';
import { productService, nomenclatureService } from '../../services';

interface ProductNomenclatureLinkProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ProductNomenclature {
  product_id: number;
  product_name: string;
  category_name?: string;
  nomenclature_id?: number;
  nomenclature_name?: string;
}

export const ProductNomenclatureLink: React.FC<ProductNomenclatureLinkProps> = ({ 
  onClose
}) => {
  const [products, setProducts] = useState<ProductNomenclature[]>([]);
  const [nomenclatures, setNomenclatures] = useState<Nomenclature[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductNomenclature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');
  const [selectedNomenclature, setSelectedNomenclature] = useState<{ [key: number]: number }>({});
  const [isUpdating, setIsUpdating] = useState(false);
  
  const toast = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, searchTerm, filterLinked]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      const [productsData, nomenclaturesData] = await Promise.all([
        productService.getAll(),
        nomenclatureService.getAll()
      ]);

      // Получаем связи продуктов с номенклатурой
      const productsWithLinks: ProductNomenclature[] = await Promise.all(
        productsData.map(async (product) => {
          try {
            // TODO: Реализовать API endpoint для получения связи продукт-номенклатура
            // const link = await productService.getNomenclatureLink(product.product_id!);
            return {
              product_id: product.product_id!,
              product_name: product.product_name,
              category_name: product.category_name,
              nomenclature_id: undefined, // link?.nomenclature_id
              nomenclature_name: undefined, // link?.nomenclature_name
            };
          } catch (error) {
            return {
              product_id: product.product_id!,
              product_name: product.product_name,
              category_name: product.category_name,
            };
          }
        })
      );

      setProducts(productsWithLinks);
      setNomenclatures(nomenclaturesData);
    } catch (error: any) {
      console.error('Ошибка загрузки данных:', error);
      toast.error('Ошибка', error.message || 'Не удалось загрузить данные');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(product => 
        product.product_name.toLowerCase().includes(searchLower) ||
        product.category_name?.toLowerCase().includes(searchLower) ||
        product.nomenclature_name?.toLowerCase().includes(searchLower)
      );
    }

    if (filterLinked === 'linked') {
      filtered = filtered.filter(product => product.nomenclature_id);
    } else if (filterLinked === 'unlinked') {
      filtered = filtered.filter(product => !product.nomenclature_id);
    }

    setFilteredProducts(filtered);
  };

  const handleLinkProduct = async (productId: number, nomenclatureId: number) => {
    try {
      setIsUpdating(true);
      
      // TODO: Реализовать API endpoint для создания связи
      // await productService.linkToNomenclature(productId, nomenclatureId);
      
      // Обновляем локальное состояние
      setProducts(prev => prev.map(product => {
        if (product.product_id === productId) {
          const nomenclature = nomenclatures.find(n => n.nomenclature_id === nomenclatureId);
          return {
            ...product,
            nomenclature_id: nomenclatureId,
            nomenclature_name: nomenclature?.nomenclature_name
          };
        }
        return product;
      }));
      
      toast.success('Успешно', 'Продукт привязан к номенклатуре');
    } catch (error: any) {
      console.error('Ошибка привязки:', error);
      toast.error('Ошибка', error.message || 'Не удалось привязать продукт');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnlinkProduct = async (productId: number) => {
    try {
      setIsUpdating(true);
      
      // TODO: Реализовать API endpoint для удаления связи
      // await productService.unlinkFromNomenclature(productId);
      
      // Обновляем локальное состояние
      setProducts(prev => prev.map(product => {
        if (product.product_id === productId) {
          return {
            ...product,
            nomenclature_id: undefined,
            nomenclature_name: undefined
          };
        }
        return product;
      }));
      
      toast.success('Успешно', 'Привязка к номенклатуре удалена');
    } catch (error: any) {
      console.error('Ошибка отвязки:', error);
      toast.error('Ошибка', error.message || 'Не удалось отвязать продукт');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateNomenclature = async (productId: number) => {
    const product = products.find(p => p.product_id === productId);
    if (!product) return;

    try {
      setIsUpdating(true);
      
      // TODO: Реализовать API endpoint для создания номенклатуры
      // const newNomenclature = {
      //   nomenclature_name: product.product_name,
      //   bill_name: product.category_name || 'Прочие расходы',
      //   account_name: product.category_name || 'Прочие',
      //   operation_name: 'Расход',
      //   is_fact: true
      // };
      // const created = await nomenclatureService.create(newNomenclature);
      // await productService.linkToNomenclature(productId, created.nomenclature_id);
      
      toast.success('Успешно', 'Создана новая номенклатура и привязан продукт');
      loadData(); // Перезагружаем данные
    } catch (error: any) {
      console.error('Ошибка создания номенклатуры:', error);
      toast.error('Ошибка', error.message || 'Не удалось создать номенклатуру');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBatchLink = async () => {
    const linksToCreate = Object.entries(selectedNomenclature)
      .filter(([_, nomenclatureId]) => nomenclatureId > 0);
    
    if (linksToCreate.length === 0) {
      toast.error('Ошибка', 'Выберите номенклатуру для привязки');
      return;
    }

    try {
      setIsUpdating(true);
      
      await Promise.all(
        linksToCreate.map(([productId, nomenclatureId]) => 
          handleLinkProduct(parseInt(productId), nomenclatureId)
        )
      );
      
      setSelectedNomenclature({});
      toast.success('Успешно', `Привязано ${linksToCreate.length} продуктов`);
    } catch (error: any) {
      console.error('Ошибка массовой привязки:', error);
      toast.error('Ошибка', error.message || 'Не удалось выполнить массовую привязку');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card title="Привязка к номенклатуре" className="w-full max-w-6xl">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Загрузка данных...</span>
          </div>
        </Card>
      </div>
    );
  }

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
            <span>Привязка продуктов к номенклатуре</span>
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
        className="w-full max-w-6xl max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-6">
          {/* Фильтры */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Поиск продуктов..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={filterLinked}
              onChange={(e) => setFilterLinked(e.target.value as 'all' | 'linked' | 'unlinked')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="all">Все продукты</option>
              <option value="linked">Привязанные</option>
              <option value="unlinked">Не привязанные</option>
            </select>

            <div className="flex gap-2">
              <Button
                onClick={handleBatchLink}
                disabled={isUpdating || Object.keys(selectedNomenclature).length === 0}
                className="flex-1"
              >
                <Link className="h-4 w-4 mr-1" />
                Привязать выбранные
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Закрыть
              </Button>
            </div>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{products.length}</div>
              <div className="text-sm text-blue-600">Всего продуктов</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {products.filter(p => p.nomenclature_id).length}
              </div>
              <div className="text-sm text-green-600">Привязано</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {products.filter(p => !p.nomenclature_id).length}
              </div>
              <div className="text-sm text-orange-600">Не привязано</div>
            </div>
          </div>

          {/* Таблица продуктов */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Продукт
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Категория
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Текущая номенклатура
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Выбрать номенклатуру
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.product_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {product.product_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.category_name || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {product.nomenclature_name ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Link className="h-3 w-3 mr-1" />
                          {product.nomenclature_name}
                        </span>
                      ) : (
                        <span className="text-gray-400">Не привязан</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={selectedNomenclature[product.product_id] || ''}
                        onChange={(e) => setSelectedNomenclature(prev => ({
                          ...prev,
                          [product.product_id]: parseInt(e.target.value) || 0
                        }))}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm min-w-[200px]"
                      >
                        <option value="">Выберите номенклатуру</option>
                        {nomenclatures.map(nom => (
                          <option key={nom.nomenclature_id} value={nom.nomenclature_id}>
                            {nom.nomenclature_name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {product.nomenclature_id ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleUnlinkProduct(product.product_id)}
                            disabled={isUpdating}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Unlink className="h-4 w-4" />
                          </Button>
                        ) : (
                          <>
                            {selectedNomenclature[product.product_id] && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleLinkProduct(
                                  product.product_id, 
                                  selectedNomenclature[product.product_id]
                                )}
                                disabled={isUpdating}
                              >
                                <Link className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleCreateNomenclature(product.product_id)}
                              disabled={isUpdating}
                              title="Создать новую номенклатуру"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500">Нет продуктов, соответствующих фильтрам</div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};