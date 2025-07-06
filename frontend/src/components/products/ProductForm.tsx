import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card } from '../common/Card';
import { Input } from '../common/form/Input';
import { Select } from '../common/form/Select';
import { Button } from '../common/form/Button';
import { TextArea } from '../common/form/TextArea';
import { useToast } from '../common/ToastContainer';
import type { Product } from '../../types';

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
      const url = product 
        ? `/api/products/${product.product_id}` 
        : '/api/products';
      
      const method = product ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        toast.success('Успешно', product ? 'Продукт обновлен' : 'Продукт добавлен');
        reset();
        onSuccess?.();
      } else {
        const error = await response.json();
        toast.error('Ошибка', error.message || 'Не удалось сохранить продукт');
      }
    } catch (error) {
      console.error('Ошибка при сохранении продукта:', error);
      toast.error('Ошибка', 'Не удалось сохранить продукт');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions = [
    { value: '', label: 'Выберите категорию' },
    { value: 'Продукты питания', label: 'Продукты питания' },
    { value: 'Напитки', label: 'Напитки' },
    { value: 'Бытовая химия', label: 'Бытовая химия' },
    { value: 'Косметика', label: 'Косметика' },
    { value: 'Одежда', label: 'Одежда' },
    { value: 'Электроника', label: 'Электроника' },
    { value: 'Другое', label: 'Другое' },
  ];

  const unitOptions = [
    { value: '', label: 'Выберите единицу' },
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
          <Select
            label="Категория"
            options={categoryOptions}
            {...register('category_name', {
              required: 'Выберите категорию',
            })}
            error={errors.category_name?.message}
          />

          <Select
            label="Единица измерения"
            options={unitOptions}
            {...register('unit_measure', {
              required: 'Выберите единицу измерения',
            })}
            error={errors.unit_measure?.message}
          />
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
            variant="primary"
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