import React, { useState, useEffect } from 'react';

const DynamicImportTestPage: React.FC = () => {
  const [ChartSelector, setChartSelector] = useState<any>(null);
  const [ChartType, setChartType] = useState<any>(null);
  const [chartType, setChartType2] = useState<string>('plan_fact_bar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadComponents = async () => {
      try {
        // Dynamic import to bypass static import issues
        const chartSelectorModule = await import('../../components/reports/ChartSelector');
        setChartSelector(() => chartSelectorModule.ChartSelector);
        setLoading(false);
      } catch (err) {
        setError(`Failed to load ChartSelector: ${err}`);
        setLoading(false);
      }
    };

    loadComponents();
  }, []);

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Dynamic Import Test</h1>
          <p className="text-slate-600">
            Testing dynamic imports to bypass ES module issues.
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          {loading && <p>Loading chart components...</p>}
          {error && <p className="text-red-600">Error: {error}</p>}
          {ChartSelector && (
            <div>
              <p className="text-green-600 mb-4">✅ ChartSelector loaded successfully!</p>
              <p className="mb-4">Current chart type: {chartType}</p>
              <ChartSelector
                selectedType={chartType}
                onTypeChange={setChartType2}
                reportType="plan_fact"
              />
            </div>
          )}
        </div>
    </div>
  );
};

export default DynamicImportTestPage;