import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { SettingsHome } from './SettingsHome';
import { EnhancedPeriodManager } from '../../components/reference/EnhancedPeriodManager';
import { EnhancedFinancialCenterManager } from '../../components/reference/EnhancedFinancialCenterManager';
import { EnhancedCostCenterManager } from '../../components/reference/EnhancedCostCenterManager';
import { EnhancedNomenclatureManager } from '../../components/reference/EnhancedNomenclatureManager';
import { ProductManager } from '../../components/reference/ProductManager';
import { ImportExportPage } from './ImportExportPage';
import { SecurityPage } from './SecurityPage';
import { UsersPage } from './UsersPage';

const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <Breadcrumbs />
      
      <Routes>
          {/* Home page */}
          <Route index element={<SettingsHome />} />
          
          {/* Reference data routes */}
          <Route path="periods" element={<EnhancedPeriodManager />} />
          <Route path="financial-centers" element={<EnhancedFinancialCenterManager />} />
          <Route path="cost-centers" element={<EnhancedCostCenterManager />} />
          
          {/* Catalog routes */}
          <Route path="nomenclatures" element={<EnhancedNomenclatureManager />} />
          <Route path="products" element={<ProductManager />} />
          
          {/* System routes */}
          <Route path="users" element={<UsersPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="import-export" element={<ImportExportPage />} />
          
          {/* Default redirect to home */}
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
    </div>
  );
};

export default SettingsPage;