select
	t0.operation_dttm,
	t1.period_ru_name,
	t3.financial_center_name,
	t2.cost_center_name,
	t4.nomenclature_name,
	t4.account_name,
	t4.bill_name,
	t4.operation_name,
	t5.row_type_name,
	t0.cost_sum,
	t0.comment_description,
	t6.user_name,
	t0.created_dttm,
	t0.updated_dttm
from
	public.t_f_registry t0
	left join  public.t_d_period t1 on t0.period_id=t1.period_id
	left join public.t_d_cost_center t2 on t0.cost_center_id=t2.cost_center_id
	left join public.t_d_financial_center t3 on t0.financial_center_id=t3.financial_center_id
	left join public.t_d_nomenclature t4 on t0.nomenclature_id=t4.nomenclature_id
	left join public.t_d_row_type t5 on t0.row_type_id=t5.row_type_id
	left join public.t_d_user t6 on t0.user_id=t6.user_id
order by created_dttm desc;