import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/common/Layout';

const ErrorDebugPage: React.FC = () => {
  const [errors, setErrors] = useState<string[]>([]);
  const [componentStatus, setComponentStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    // Capture console errors
    const originalError = console.error;
    console.error = (...args) => {
      setErrors(prev => [...prev, `${new Date().toLocaleTimeString()}: ${args.join(' ')}`]);
      originalError.apply(console, args);
    };

    // Test each import individually
    const testImports = async () => {
      // Test Layout - already working since we're here
      setComponentStatus(prev => ({ ...prev, layout: 'OK' }));

      // Test useUserPreferences hook
      try {
        const hook = await import('../../hooks/useUserPreferences');
        setComponentStatus(prev => ({ ...prev, useUserPreferences: 'OK' }));
      } catch (err) {
        setComponentStatus(prev => ({ ...prev, useUserPreferences: `ERROR: ${err}` }));
      }

      // Test useToast hook
      try {
        const hook = await import('../../components/common/ToastContainer');
        setComponentStatus(prev => ({ ...prev, useToast: 'OK' }));
      } catch (err) {
        setComponentStatus(prev => ({ ...prev, useToast: `ERROR: ${err}` }));
      }

      // Test reportDataTransformer
      try {
        const transformer = await import('../../services/reportDataTransformer');
        setComponentStatus(prev => ({ ...prev, reportDataTransformer: 'OK' }));
      } catch (err) {
        setComponentStatus(prev => ({ ...prev, reportDataTransformer: `ERROR: ${err}` }));
      }

      // Test ReportFilters
      try {
        const component = await import('../../components/reports/ReportFilters');
        setComponentStatus(prev => ({ ...prev, ReportFilters: 'OK' }));
      } catch (err) {
        setComponentStatus(prev => ({ ...prev, ReportFilters: `ERROR: ${err}` }));
      }

      // Test ViewModeToggle
      try {
        const component = await import('../../components/reports/ViewModeToggle');
        setComponentStatus(prev => ({ ...prev, ViewModeToggle: 'OK' }));
      } catch (err) {
        setComponentStatus(prev => ({ ...prev, ViewModeToggle: `ERROR: ${err}` }));
      }

      // Test BudgetTable
      try {
        const component = await import('../../components/reports/BudgetTable');
        setComponentStatus(prev => ({ ...prev, BudgetTable: 'OK' }));
      } catch (err) {
        setComponentStatus(prev => ({ ...prev, BudgetTable: `ERROR: ${err}` }));
      }

      // Test ChartSelector
      try {
        const component = await import('../../components/reports/ChartSelector');
        setComponentStatus(prev => ({ ...prev, ChartSelector: 'OK' }));
      } catch (err) {
        setComponentStatus(prev => ({ ...prev, ChartSelector: `ERROR: ${err}` }));
      }

      // Test DynamicChartRenderer
      try {
        const component = await import('../../components/reports/DynamicChartRenderer');
        setComponentStatus(prev => ({ ...prev, DynamicChartRenderer: 'OK' }));
      } catch (err) {
        setComponentStatus(prev => ({ ...prev, DynamicChartRenderer: `ERROR: ${err}` }));
      }
    };

    testImports();

    return () => {
      console.error = originalError;
    };
  }, []);

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Error Debug Page</h1>
          <p className="text-slate-600">
            Debugging imports and component loading for reports page.
          </p>
        </div>

        {/* Component Status */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Component Import Status</h2>
          <div className="space-y-2">
            {Object.entries(componentStatus).map(([component, status]) => (
              <div key={component} className="flex justify-between items-center">
                <span className="font-mono">{component}:</span>
                <span className={status === 'OK' ? 'text-green-600' : 'text-red-600 text-sm'}>
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Console Errors */}
        <div className="bg-red-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-red-800">Console Errors</h2>
          {errors.length === 0 ? (
            <p className="text-green-600">No errors captured yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {errors.map((error, index) => (
                <div key={index} className="text-sm font-mono bg-white p-2 rounded border text-red-700">
                  {error}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Browser Info */}
        <div className="bg-blue-50 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">Environment Info</h2>
          <div className="space-y-1 text-sm">
            <p><strong>User Agent:</strong> {navigator.userAgent}</p>
            <p><strong>URL:</strong> {window.location.href}</p>
            <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ErrorDebugPage;