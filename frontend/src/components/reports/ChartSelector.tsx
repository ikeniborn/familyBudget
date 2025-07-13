import React, { memo } from 'react';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  BarChart2,
  Activity,
  LineChart
} from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

export type ChartType = 
  | 'plan_fact_bar' 
  | 'category_pie' 
  | 'budget_gauge' 
  | 'trend_line' 
  | 'variance_waterfall' 
  | 'composed';

export interface ChartTypeOption {
  value: ChartType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  reportTypes: string[]; // Which report types support this chart
}

const chartTypeOptions: ChartTypeOption[] = [
  {
    value: 'plan_fact_bar',
    label: 'План vs Факт',
    description: 'Сравнение плановых и фактических показателей',
    icon: BarChart3,
    reportTypes: ['plan_fact', 'budget'],
  },
  {
    value: 'category_pie',
    label: 'Распределение по категориям',
    description: 'Круговая диаграмма распределения расходов',
    icon: PieChart,
    reportTypes: ['budget', 'plan_fact'],
  },
  {
    value: 'budget_gauge',
    label: 'Использование бюджета',
    description: 'Круговой индикатор освоения бюджета',
    icon: Activity,
    reportTypes: ['budget'],
  },
  {
    value: 'trend_line',
    label: 'Динамика по времени',
    description: 'Линейный график изменений во времени',
    icon: TrendingUp,
    reportTypes: ['plan_fact'],
  },
  {
    value: 'variance_waterfall',
    label: 'Анализ отклонений',
    description: 'Водопадная диаграмма отклонений',
    icon: BarChart2,
    reportTypes: ['plan_fact'],
  },
  {
    value: 'composed',
    label: 'Комбинированный график',
    description: 'Объединенные бары и линии',
    icon: LineChart,
    reportTypes: ['plan_fact', 'budget'],
  },
];

interface ChartSelectorProps {
  selectedType: ChartType;
  onTypeChange: (type: ChartType) => void;
  reportType: string;
  disabled?: boolean;
  className?: string;
}

export const ChartSelector: React.FC<ChartSelectorProps> = memo(({
  selectedType,
  onTypeChange,
  reportType,
  disabled = false,
  className = '',
}) => {
  // Filter options based on current report type
  const availableOptions = chartTypeOptions.filter(option =>
    option.reportTypes.includes(reportType)
  );

  // Ensure selected type is valid for current report type
  React.useEffect(() => {
    if (!availableOptions.find(option => option.value === selectedType)) {
      // If current selection is not available, select first available option
      if (availableOptions.length > 0) {
        onTypeChange(availableOptions[0].value);
      }
    }
  }, [reportType, selectedType, onTypeChange, availableOptions]);

  return (
    <div className={`space-y-2 ${className}`} data-testid="chart-selector">
      <label className="text-sm font-medium text-gray-700">
        Тип графика
      </label>
      <Select
        value={selectedType}
        onValueChange={onTypeChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Выберите тип графика" />
        </SelectTrigger>
        <SelectContent>
          {availableOptions.map((option) => {
            const IconComponent = option.icon;
            return (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-3 py-1">
                  <IconComponent className="h-4 w-4 text-gray-500" />
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-gray-500">
                      {option.description}
                    </span>
                  </div>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
});

ChartSelector.displayName = 'ChartSelector';

// Export options for external use
export { chartTypeOptions };
export default ChartSelector;