import { BaseService } from './baseService';
import type { CostCenter } from '../types';

export interface CreateCostCenterData {
  cost_center_name: string;
}

export interface UpdateCostCenterData {
  cost_center_name?: string;
}

class CostCenterService extends BaseService<CostCenter, CreateCostCenterData, UpdateCostCenterData> {
  constructor() {
    super('/cost-centers');
  }
}

export const costCenterService = new CostCenterService();