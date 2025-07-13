import React from 'react';
import { Layout } from '../../components/common/Layout';
import { ChartSelector } from '../../components/reports/ChartSelector';
import type { ChartType } from '../../components/reports/ChartSelector';

const TestChartSelectorPage: React.FC = () => {
  const [chartType, setChartType] = React.useState<ChartType>('plan_fact_bar');

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Test Chart Selector</h1>
          <p className="text-slate-600">
            Testing only ChartSelector component and ChartType import.
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Chart Selector Test</h2>
          <p className="mb-4">Current chart type: {chartType}</p>
          <ChartSelector
            selectedType={chartType}
            onTypeChange={setChartType}
            reportType="plan_fact"
          />
        </div>
      </div>
    </Layout>
  );
};

export default TestChartSelectorPage;