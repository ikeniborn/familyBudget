import React, { useState } from 'react';
import { BudgetForm } from '../../components/budget/BudgetForm';
import { BudgetList } from '../../components/budget/BudgetList';

const BudgetPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleBudgetAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Бюджет</h1>
          <p className="mt-1 text-sm text-gray-600">
            Планирование доходов и расходов
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <BudgetForm onSuccess={handleBudgetAdded} />
          </div>
          
          <div>
            <BudgetList key={refreshKey} />
          </div>
        </div>
      </div>
  );
};

export default BudgetPage;