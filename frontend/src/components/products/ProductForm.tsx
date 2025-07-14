import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card } from '../common/Card';
import { Input } from '../common/form/Input';
import { Button } from '../common/form/Button';
import { TextArea } from '../common/form/TextArea';
import { useToast } from '../common/ToastContainer';
import type { Product } from '../../types';
import { productService, type CreateProductData, type UpdateProductData } from '../../services';

interface ProductFormProps {
  onSuccess?: () => void;
  product?: Product;
  onCancel?: () => void;
}

interface ProductFormData {
  product_name: string;
  category_name: string;
  unit_measure: string;
  barcode?: string;
  description?: string;
  is_active: boolean;
}

export const ProductForm: React.FC<ProductFormProps> = ({ 
  onSuccess, 
  product,
  onCancel 
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProductFormData>({
    defaultValues: product ? {
      product_name: product.product_name,
      category_name: product.category_name || '',
      unit_measure: product.unit_measure || '',
      barcode: product.barcode || '',
      description: product.description || '',
      is_active: product.is_active,
    } : {
      is_active: true,
    },
  });

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    
    try {
      if (product) {
        const updateData: UpdateProductData = {
          product_name: data.product_name,
          category_name: data.category_name,
          unit_measure: data.unit_measure,
          barcode: data.barcode,
          description: data.description,
          is_active: data.is_active,
        };
        await productService.update(product.product_id!, updateData);
        toast.success('Успешно', 'Продукт обновлен');
      } else {
        const createData: CreateProductData = {
          product_name: data.product_name,
          category_name: data.category_name,
          unit_measure: data.unit_measure,
          barcode: data.barcode,
          description: data.description,
          is_active: data.is_active,
        };
        await productService.create(createData);
        toast.success('Успешно', 'Продукт добавлен');
      }
      reset();
      onSuccess?.();
    } catch (error: any) {
      console.error('Ошибка при сохранении продукта:', error);
      toast.error('Ошибка', error.message || 'Не удалось сохранить продукт');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions = [
    { value: 'Продукты питания', label: 'Продукты питания' },
    { value: 'Напитки', label: 'Напитки' },
    { value: 'Бытовая химия', label: 'Бытовая химия' },
    { value: 'Косметика', label: 'Косметика' },
    { value: 'Одежда', label: 'Одежда' },
    { value: 'Электроника', label: 'Электроника' },
    { value: 'Другое', label: 'Другое' },
  ];

  const unitOptions = [
    { value: 'шт', label: 'штуки' },
    { value: 'кг', label: 'килограммы' },
    { value: 'г', label: 'граммы' },
    { value: 'л', label: 'литры' },
    { value: 'мл', label: 'миллилитры' },
    { value: 'упак', label: 'упаковки' },
    { value: 'м', label: 'метры' },
    { value: 'см', label: 'сантиметры' },
  ];

  return (
    <Card title={product ? 'Редактировать продукт' : 'Добавить продукт'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Input
          label="Наименование продукта"
          {...register('product_name', {
            required: 'Наименование обязательно',
          })}
          error={errors.product_name?.message}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Категория <span className="text-red-500">*</span>
            </label>
            <select
              {...register('category_name', {
                required: 'Выберите категорию',
              })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Выберите категорию</option>
              {categoryOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {errors.category_name && (
              <p className="mt-1 text-sm text-red-600">{errors.category_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Единица измерения <span className="text-red-500">*</span>
            </label>
            <select
              {...register('unit_measure', {
                required: 'Выберите единицу измерения',
              })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Выберите единицу</option>
              {unitOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {errors.unit_measure && (
              <p className="mt-1 text-sm text-red-600">{errors.unit_measure.message}</p>
            )}
          </div>
        </div>

        <Input
          label="Штрихкод"
          {...register('barcode')}
          error={errors.barcode?.message}
        />

        <TextArea
          label="Описание"
          rows={3}
          {...register('description')}
          error={errors.description?.message}
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            {...register('is_active')}
            className="rounded border-gray-300"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
            Активный продукт
          </label>
        </div>

        <div className="flex gap-3">
          <Button
            type="submit"
            variant="default"
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting 
              ? 'Сохранение...' 
              : product ? 'Обновить' : 'Добавить'
            }
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel || (() => reset())}
            disabled={isSubmitting}
          >
            {onCancel ? 'Отмена' : 'Очистить'}
          </Button>
        </div>
      </form>
    </Card>
  );
};