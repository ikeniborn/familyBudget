import React, { useMemo } from 'react';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ChartContainer } from '../core/ChartContainer';
import { ChartTheme } from '../utils/ChartTheme';

interface BudgetGaugeProps {
  currentValue: number;
  maxValue: number;
  title?: string;
  subtitle?: string;
  height?: number;
  className?: string;
  showLabel?: boolean;
  showPercentage?: boolean;
  thresholds?: {
    good: number;     // 0-good: green
    warning: number;  // good-warning: yellow
    danger: number;   // warning-danger: red
  };
  animated?: boolean;
  loading?: boolean;
  error?: string | null;
}

export const BudgetGauge: React.FC<BudgetGaugeProps> = ({
  currentValue,
  maxValue,
  title = 'Использование бюджета',
  subtitle,
  height = ChartTheme.sizes.dashboard.height,
  className = '',
  showLabel = true,
  showPercentage = true,
  thresholds = {
    good: 70,
    warning: 85,
    danger: 100,
  },
  animated = true,
  loading = false,
  error = null,
}) => {
  // Calculate percentage and color
  const { percentage, color, status } = useMemo(() => {
    const pct = maxValue > 0 ? (currentValue / maxValue) * 100 : 0;
    
    let gaugeColor: string;
    let gaugeStatus: 'good' | 'warning' | 'danger';
    
    if (pct <= thresholds.good) {
      gaugeColor = '#10B981'; // Green
      gaugeStatus = 'good';
    } else if (pct <= thresholds.warning) {
      gaugeColor = '#F59E0B'; // Yellow/Amber
      gaugeStatus = 'warning';
    } else {
      gaugeColor = '#EF4444'; // Red
      gaugeStatus = 'danger';
    }
    
    return {
      percentage: Math.min(pct, 100),
      color: gaugeColor,
      status: gaugeStatus,
    };
  }, [currentValue, maxValue, thresholds]);

  // Prepare data for RadialBarChart
  const chartData = useMemo(() => [
    {
      name: 'usage',
      value: percentage,
      fill: color,
    },
  ], [percentage, color]);

  // Status messages
  const statusConfig = {
    good: {
      message: 'В пределах нормы',
      icon: '✅',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
    },
    warning: {
      message: 'Приближается к лимиту',
      icon: '⚠️',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
    },
    danger: {
      message: 'Превышен лимит',
      icon: '🚨',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
    },
  };

  const currentStatus = statusConfig[status];

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      height={height}
      className={className}
      loading={loading}
      error={error}
      exportable={true}
    >
      <div className="flex flex-col items-center justify-center h-full">
        {/* Radial Gauge */}
        <div className="relative w-full max-w-xs">
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="85%"
              data={chartData}
              startAngle={180}
              endAngle={0}
            >
              <RadialBar
                dataKey="value"
                cornerRadius={8}
                fill={color}
                background={{ fill: '#E5E7EB' }}
                isAnimationActive={animated}
                animationDuration={1000}
                animationEasing="ease-out"
              />
            </RadialBarChart>
          </ResponsiveContainer>
          
          {/* Center Label */}
          {showLabel && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-center">
                {showPercentage && (
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {percentage.toFixed(1)}%
                  </div>
                )}
                <div className="text-sm text-gray-600">
                  {ChartTheme.formatters.currency(currentValue)}
                </div>
                <div className="text-xs text-gray-500">
                  из {ChartTheme.formatters.currency(maxValue)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Indicator */}
        <div className={`mt-4 px-3 py-2 rounded-lg ${currentStatus.bgColor} ${currentStatus.textColor} text-center`}>
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">{currentStatus.icon}</span>
            <span className="text-sm font-medium">{currentStatus.message}</span>
          </div>
        </div>

        {/* Threshold Indicators */}
        <div className="mt-4 w-full max-w-xs">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>0%</span>
            <span>{thresholds.good}%</span>
            <span>{thresholds.warning}%</span>
            <span>100%</span>
          </div>
          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
            {/* Good zone */}
            <div
              className="absolute top-0 left-0 h-full bg-green-500"
              style={{ width: `${thresholds.good}%` }}
            />
            {/* Warning zone */}
            <div
              className="absolute top-0 h-full bg-yellow-500"
              style={{
                left: `${thresholds.good}%`,
                width: `${thresholds.warning - thresholds.good}%`,
              }}
            />
            {/* Danger zone */}
            <div
              className="absolute top-0 h-full bg-red-500"
              style={{
                left: `${thresholds.warning}%`,
                width: `${100 - thresholds.warning}%`,
              }}
            />
            {/* Current position indicator */}
            <div
              className="absolute top-0 w-1 h-full bg-gray-900 transition-all duration-1000"
              style={{ left: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="mt-4 grid grid-cols-2 gap-4 w-full max-w-xs text-center">
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-xs text-gray-500">Остаток</div>
            <div className="text-sm font-medium text-gray-900">
              {ChartTheme.formatters.currency(Math.max(0, maxValue - currentValue))}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-xs text-gray-500">
              {percentage > 100 ? 'Превышение' : 'До лимита'}
            </div>
            <div className="text-sm font-medium text-gray-900">
              {percentage > 100 
                ? ChartTheme.formatters.currency(currentValue - maxValue)
                : `${(100 - percentage).toFixed(1)}%`
              }
            </div>
          </div>
        </div>
      </div>
    </ChartContainer>
  );
};

// Compact version for dashboards
export const BudgetGaugeCompact: React.FC<Omit<BudgetGaugeProps, 'height'>> = (props) => {
  return (
    <BudgetGauge
      {...props}
      height={180}
      showLabel={true}
      showPercentage={true}
    />
  );
};

// KPI Card wrapper
export const BudgetGaugeKPI: React.FC<BudgetGaugeProps & {
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
}> = ({
  trend,
  trendValue,
  ...props
}) => {
  const trendIcon = {
    up: '↗️',
    down: '↘️',
    stable: '➡️',
  };

  const trendColor = {
    up: 'text-red-600',
    down: 'text-green-600',
    stable: 'text-gray-600',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      {/* Header with trend */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{props.title}</h3>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${trendColor[trend]}`}>
            <span>{trendIcon[trend]}</span>
            {trendValue && <span>{trendValue > 0 ? '+' : ''}{trendValue}%</span>}
          </div>
        )}
      </div>

      {/* Gauge */}
      <BudgetGaugeCompact {...props} title="" />
    </div>
  );
};

export default BudgetGauge;