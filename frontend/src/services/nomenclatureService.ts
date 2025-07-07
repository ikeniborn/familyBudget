import { BaseService } from './baseService';
import type { Nomenclature } from '../types';

export interface CreateNomenclatureData {
  nomenclature_name: string;
  bill_name: string;
  account_name: string;
  operation_name: string;
  is_fact: boolean;
}

export interface UpdateNomenclatureData {
  nomenclature_name?: string;
  bill_name?: string;
  account_name?: string;
  operation_name?: string;
  is_fact?: boolean;
}

class NomenclatureService extends BaseService<Nomenclature, CreateNomenclatureData, UpdateNomenclatureData> {
  constructor() {
    super('/nomenclatures');
  }
}

export const nomenclatureService = new NomenclatureService();