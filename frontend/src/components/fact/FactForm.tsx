import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Card } from '../common/Card';
import { Input } from '../common/form/Input';
import { Select } from '../common/form/Select';
import { Button } from '../common/form/Button';
import { TextArea } from '../common/form/TextArea';
import { useToast } from '../common/ToastContainer';
import type { Period, FinancialCenter, CostCenter, Nomenclature } from '../../types';

interface FactFormProps {
  onSuccess?: () => void;
}

interface FactFormData {
  operation_dttm: string;
  period_id: string;
  financial_center_id: string;
  cost_center_id: string;
  nomenclature_id: string;
  cost_sum: string;
  comment_description?: string;
  row_type_id: number;
}

export const FactForm: React.FC<FactFormProps> = ({ onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [financialCenters, setFinancialCenters] = useState<FinancialCenter[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [nomenclatures, setNomenclatures] = useState<Nomenclature[]>([]);
  const [showCostCenter, setShowCostCenter] = useState(false);
  
  const toast = useToast();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FactFormData>({
    defaultValues: {
      operation_dttm: new Date().toISOString().split('T')[0],
      row_type_id: 1, // Факт
    },
  });


  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Загрузка справочников
      const [periodsRes, fcRes, ccRes, nomenclatureRes] = await Promise.all([
        fetch('/api/periods'),
        fetch('/api/financial-centers'),
        fetch('/api/cost-centers'),
        fetch('/api/nomenclatures'),
      ]);

      if (periodsRes.ok) {
        const periodsData = await periodsRes.json();
        setPeriods(periodsData);
      }

      if (fcRes.ok) {
        const fcData = await fcRes.json();
        setFinancialCenters(fcData);
      }

      if (ccRes.ok) {
        const ccData = await ccRes.json();
        setCostCenters(ccData);
      }

      if (nomenclatureRes.ok) {
        const nomenclatureData = await nomenclatureRes.json();
        setNomenclatures(nomenclatureData);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      toast.error('Ошибка', 'Не удалось загрузить справочники');
    }
  };

  const onSubmit = async (data: FactFormData) => {
    setIsSubmitting(true);
    
    try {
      const payload = {
        ...data,
        period_id: parseInt(data.period_id),
        financial_center_id: parseInt(data.financial_center_id),
        cost_center_id: showCostCenter ? parseInt(data.cost_center_id) : undefined,
        nomenclature_id: parseInt(data.nomenclature_id),
        cost_sum: parseFloat(data.cost_sum),
        row_type_id: 1, // Факт
      };

      const response = await fetch('/api/registry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success('Успешно', 'Расход добавлен');
        reset();
        onSuccess?.();
      } else {
        const error = await response.json();
        toast.error('Ошибка', error.message || 'Не удалось добавить расход');
      }
    } catch (error) {
      console.error('Ошибка при добавлении расхода:', error);
      toast.error('Ошибка', 'Не удалось добавить расход');
    } finally {
      setIsSubmitting(false);
    }
  };

  const periodOptions = periods.map(period => ({
    value: period.period_id.toString(),
    label: period.period_ru_name,
  }));

  const financialCenterOptions = financialCenters.map(fc => ({
    value: fc.financial_center_id.toString(),
    label: fc.financial_center_name,
  }));

  const costCenterOptions = costCenters.map(cc => ({
    value: cc.cost_center_id.toString(),
    label: cc.cost_center_name,
  }));

  const nomenclatureOptions = nomenclatures.map(nom => ({
    value: nom.nomenclature_id.toString(),
    label: nom.nomenclature_name,
  }));

  return (
    <Card title="Добавить расход" className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Дата операции"
            type="date"
            {...register('operation_dttm', {
              required: 'Дата операции обязательна',
            })}
            error={errors.operation_dttm?.message}
          />
          
          <Select
            label="Период"
            options={periodOptions}
            {...register('period_id', {
              required: 'Выберите период',
            })}
            error={errors.period_id?.message}
          />
        </div>

        <Select
          label="Финансовый центр"
          options={financialCenterOptions}
          {...register('financial_center_id', {
            required: 'Выберите финансовый центр',
          })}
          error={errors.financial_center_id?.message}
        />

        <Select
          label="Номенклатура"
          options={nomenclatureOptions}
          {...register('nomenclature_id', {
            required: 'Выберите номенклатуру',
          })}
          error={errors.nomenclature_id?.message}
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showCostCenter"
            checked={showCostCenter}
            onChange={(e) => setShowCostCenter(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="showCostCenter" className="text-sm font-medium text-gray-700">
            Использовать МВЗ
          </label>
        </div>

        {showCostCenter && (
          <Select
            label="Место возникновения затрат (МВЗ)"
            options={costCenterOptions}
            {...register('cost_center_id', {
              required: showCostCenter ? 'Выберите МВЗ' : false,
            })}
            error={errors.cost_center_id?.message}
          />
        )}

        <Input
          label="Сумма"
          type="number"
          step="0.01"
          min="0"
          {...register('cost_sum', {
            required: 'Сумма обязательна',
            min: { value: 0.01, message: 'Сумма должна быть больше 0' },
          })}
          error={errors.cost_sum?.message}
        />

        <TextArea
          label="Комментарий"
          rows={3}
          {...register('comment_description')}
          error={errors.comment_description?.message}
        />

        <div className="flex gap-3">
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? 'Добавление...' : 'Добавить расход'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => reset()}
            disabled={isSubmitting}
          >
            Очистить
          </Button>
        </div>
      </form>
    </Card>
  );
};