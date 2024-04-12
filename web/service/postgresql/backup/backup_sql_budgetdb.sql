select
  cost_center_key,
  trim(lower(cost_center_name)) as cost_center_id,
  cost_center_name,
  created_dttm,
  updated_dttm
from
  public.t_d_cost_center;
 
 
SELECT
	period_key,
	trim(lower(period_dttm::VARCHAR)) as period_id,
	period_dttm,
	period_dt,
	period_ru_name,
	created_dttm,
	updated_dttm
FROM
	public.t_d_period;

select
  financial_center_key,
  trim(lower(financial_center_name)) as financial_center_id,
  financial_center_name,
  created_dttm,
  updated_dttm
from
  public.t_d_financial_center;

select
  nomenclature_key,
  trim(lower(nomenclature_name)) as nomenclature_id,
  nomenclature_name,
  account_name,
  bill_name,
  operation_name,
  is_budget,
  is_fact,
  created_dttm,
  updated_dttm
from
  public.t_d_nomenclature;

select
  row_type_key,
  trim(lower(row_type_name)) as row_type_id,
  row_type_name,
  created_dttm,
  updated_dttm
from
  public.t_d_row_type;

select
  user_key,
  trim(lower(user_name)) as user_id,
  user_name,
  trim(lower(user_name)) as user_login,
  user_password,
  user_email,
  created_dttm,
  updated_dttm
from
  public.t_d_user;

select
  registry_key,
  operation_dttm,
  period_key,
  financial_center_key,
  cost_center_key,
  nomenclature_key,
  cost_sum,
  comment_description,
  row_type_key,
  user_key,
  created_dttm,
  updated_dttm
from
  public.t_f_registry;