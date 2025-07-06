import React from 'react';
import { Layout } from '../../components/common/Layout';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/form/Button';

const FactPage: React.FC = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Факт</h1>
            <p className="mt-1 text-sm text-gray-600">
              Внесение фактических расходов и доходов
            </p>
          </div>
          <Button variant="primary">
            Добавить запись
          </Button>
        </div>

        <Card>
          <p className="text-gray-500">Функционал будет реализован в следующих фазах</p>
        </Card>
      </div>
    </Layout>
  );
};

export default FactPage;