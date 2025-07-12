import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from '../ui/card';
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';
import { Input } from '../ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Button } from '../ui/button';
import { useToast } from '../common/ToastContainer';
import { 
  periodService, 
  financialCenterService, 
  costCenterService, 
  nomenclatureService,
  registryService,
  type CreateRegistryData 
} from '../../services';
import type { Period, FinancialCenter, CostCenter, Nomenclature } from '../../types';
import { 
  CreditCard, 
  Calendar, 
  Building,
  Tag,
  DollarSign,
  MessageSquare,
  Loader2,
  Check
} from 'lucide-react';

interface FactFormProps {
  onSuccess?: () => void;
}

const formSchema = z.object({
  operation_dttm: z.string().min(1, "Дата операции обязательна"),
  period_id: z.string().min(1, "Выберите период"),
  financial_center_id: z.string().min(1, "Выберите финансовый центр"),
  cost_center_id: z.string().optional(),
  nomenclature_id: z.string().min(1, "Выберите номенклатуру"),
  cost_sum: z.string()
    .min(1, "Сумма обязательна")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Сумма должна быть больше 0"),
  comment_description: z.string().optional(),
  use_cost_center: z.boolean().optional(),
});

type FactFormData = z.infer<typeof formSchema>;

export const FactForm: React.FC<FactFormProps> = ({ onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [financialCenters, setFinancialCenters] = useState<FinancialCenter[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [nomenclatures, setNomenclatures] = useState<Nomenclature[]>([]);
  
  const toast = useToast();
  
  const form = useForm<FactFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      operation_dttm: new Date().toISOString().split('T')[0],
      use_cost_center: false,
      comment_description: "",
    },
  });


  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Загрузка справочников через сервисы
      const [periodsData, fcData, ccData, nomenclatureData] = await Promise.all([
        periodService.getAll(),
        financialCenterService.getAll(),
        costCenterService.getAll(),
        nomenclatureService.getAll(),
      ]);

      setPeriods(periodsData);
      setFinancialCenters(fcData);
      setCostCenters(ccData);
      setNomenclatures(nomenclatureData);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      toast.error('Ошибка', 'Не удалось загрузить справочники');
    }
  };

  const onSubmit = async (data: FactFormData) => {
    setIsSubmitting(true);
    
    try {
      const payload: CreateRegistryData = {
        operation_dttm: data.operation_dttm,
        period_id: parseInt(data.period_id),
        financial_center_id: parseInt(data.financial_center_id),
        cost_center_id: data.use_cost_center && data.cost_center_id ? parseInt(data.cost_center_id) : undefined,
        nomenclature_id: parseInt(data.nomenclature_id),
        cost_sum: parseFloat(data.cost_sum),
        comment_description: data.comment_description,
        row_type_id: 1, // Факт
      };

      await registryService.create(payload);
      toast.success('Успешно', 'Расход добавлен');
      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Ошибка при добавлении расхода:', error);
      toast.error('Ошибка', error instanceof Error ? error.message : 'Не удалось добавить расход');
    } finally {
      setIsSubmitting(false);
    }
  };

  const useCostCenter = form.watch("use_cost_center");

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardTitle className="flex items-center gap-2">
          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-blue-600" />
          </div>
          Добавить операцию
        </CardTitle>
        <CardDescription>
          Внесите информацию о расходе или доходе
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="operation_dttm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Дата операции
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="period_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Период</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите период" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {periods.map(period => (
                          <SelectItem key={period.period_id} value={period.period_id.toString()}>
                            {period.period_ru_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="financial_center_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Финансовый центр
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите финансовый центр" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {financialCenters.map(fc => (
                        <SelectItem key={fc.financial_center_id} value={fc.financial_center_id.toString()}>
                          {fc.financial_center_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nomenclature_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Номенклатура
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите номенклатуру" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {nomenclatures.map(nom => (
                        <SelectItem key={nom.nomenclature_id} value={nom.nomenclature_id.toString()}>
                          {nom.nomenclature_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="use_cost_center"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-medium">
                      Использовать МВЗ
                    </FormLabel>
                    <FormDescription>
                      Добавить место возникновения затрат к операции
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {useCostCenter && (
              <FormField
                control={form.control}
                name="cost_center_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Место возникновения затрат (МВЗ)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите МВЗ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {costCenters.map(cc => (
                          <SelectItem key={cc.cost_center_id} value={cc.cost_center_id.toString()}>
                            {cc.cost_center_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="cost_sum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Сумма
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      placeholder="0.00"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Введите сумму расхода в рублях
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comment_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Комментарий
                  </FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Дополнительная информация о расходе..."
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Опциональное описание операции
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Добавление...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Добавить расход
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => form.reset()}
                disabled={isSubmitting}
              >
                Очистить
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};