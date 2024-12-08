insert into
  public.t_d_period (
    period_key,
    period_id,
    period_dttm,
    period_dt,
    period_ru_name,
    created_dttm,
    updated_dttm
  )
values
(
    md5(trim(lower('2025-01-01 00:00:00'))) :: UUID,
    '2025-01-01 00:00:00',
    '2025-01-01 00:00:00',
    '2025-01-01',
    'янв 2025',
    now(),
    now()
  );