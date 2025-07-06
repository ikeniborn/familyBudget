import React, { useState } from 'react';
import { Layout } from '../../components/common/Layout';
import { FactForm } from '../../components/fact/FactForm';
import { FactList } from '../../components/fact/FactList';

const FactPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleFactAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Факт</h1>
          <p className="mt-1 text-sm text-gray-600">
            Внесение фактических расходов и доходов
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <FactForm onSuccess={handleFactAdded} />
          </div>
          
          <div>
            <FactList key={refreshKey} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FactPage;