import { BaseService } from './baseService';
import type { FinancialCenter } from '../types';

export interface CreateFinancialCenterData {
  financial_center_name: string;
}

export interface UpdateFinancialCenterData {
  financial_center_name?: string;
}

class FinancialCenterService extends BaseService<FinancialCenter, CreateFinancialCenterData, UpdateFinancialCenterData> {
  constructor() {
    super('/financial_centers');
  }
}

export const financialCenterService = new FinancialCenterService();