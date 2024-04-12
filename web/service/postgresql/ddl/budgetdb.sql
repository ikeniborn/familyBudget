DROP TABLE if EXISTS public.t_f_registry CASCADE;

DROP TABLE if EXISTS public.t_d_cost_center CASCADE;

DROP TABLE if EXISTS public.t_d_financial_center CASCADE;

DROP TABLE if EXISTS public.t_d_nomenclature CASCADE;

DROP TABLE if EXISTS public.t_d_period CASCADE;

DROP TABLE if EXISTS public.t_d_row_type CASCADE;

DROP TABLE if EXISTS public.t_d_user CASCADE;

-- public.t_d_cost_center definition
CREATE TABLE if not EXISTS public.t_d_cost_center (
  cost_center_key uuid NOT NULL PRIMARY KEY,
  cost_center_id varchar NOT NULL,
  cost_center_name varchar NOT NULL,
  created_dttm timestamp NOT NULL DEFAULT now(),
  updated_dttm timestamp NOT NULL DEFAULT now()
);

-- public.t_d_financial_center definition
CREATE TABLE if not EXISTS public.t_d_financial_center (
  financial_center_key uuid NOT NULL PRIMARY KEY,
  financial_center_id varchar NOT NULL,
  financial_center_name varchar NOT NULL,
  created_dttm timestamp NOT NULL DEFAULT now(),
  updated_dttm timestamp NOT NULL DEFAULT now()
);

-- public.t_d_nomenclature definition
CREATE TABLE if not EXISTS public.t_d_nomenclature (
  nomenclature_key uuid NOT NULL PRIMARY KEY,
  nomenclature_id varchar NOT NULL,
  nomenclature_name varchar NOT NULL,
  account_name varchar NOT NULL,
  bill_name varchar NOT NULL,
  operation_name varchar NOT NULL,
  is_budget bool NOT NULL DEFAULT false,
  is_fact bool NOT NULL DEFAULT false,
  created_dttm timestamp NOT NULL DEFAULT now(),
  updated_dttm timestamp NOT NULL DEFAULT now()
);

-- public.t_d_period definition
CREATE TABLE if not EXISTS public.t_d_period (
  period_key uuid NOT NULL PRIMARY KEY,
  period_id varchar NOT NULL,
  period_dttm timestamp NOT NULL DEFAULT now(),
  period_dt date NOT NULL,
  period_ru_name varchar NOT NULL,
  created_dttm timestamp NOT NULL DEFAULT now(),
  updated_dttm timestamp NOT NULL DEFAULT now()
);

-- public.t_d_row_type definition
CREATE TABLE if not EXISTS public.t_d_row_type (
  row_type_key uuid NOT NULL PRIMARY KEY,
  row_type_id varchar NOT NULL,
  row_type_name varchar NOT NULL,
  created_dttm timestamp NOT NULL DEFAULT now(),
  updated_dttm timestamp NOT NULL DEFAULT now()
);

-- public.t_d_user definition
CREATE TABLE if not EXISTS public.t_d_user (
  user_key uuid NOT NULL PRIMARY KEY,
  user_id varchar NOT NULL,
  user_name varchar NOT NULL,
  user_login varchar NOT NULL,
  user_password varchar NOT NULL,
  user_email varchar NULL,
  user_google_email varchar NULL,
  user_telegram_nickname varchar NULL,
  user_telegram_id BIGINT NULL,
  created_dttm timestamp NOT NULL DEFAULT now(),
  updated_dttm timestamp NOT NULL DEFAULT now()
);

-- public.t_f_registry definition
CREATE TABLE if not EXISTS public.t_f_registry (
  registry_key uuid NOT NULL,
  operation_dttm timestamp NOT NULL,
  period_key uuid NOT NULL REFERENCES t_d_period (period_key),
  financial_center_key uuid NOT NULL REFERENCES t_d_financial_center (financial_center_key),
  cost_center_key uuid NOT NULL REFERENCES t_d_cost_center (cost_center_key),
  nomenclature_key uuid NOT NULL REFERENCES t_d_nomenclature (nomenclature_key),
  cost_sum numeric(12, 2) NOT NULL,
  comment_description varchar NOT NULL,
  row_type_key uuid NOT NULL REFERENCES t_d_row_type (row_type_key),
  user_key uuid NOT NULL REFERENCES t_d_user (user_key),
  created_dttm timestamp NOT NULL DEFAULT now(),
  updated_dttm timestamp NOT NULL DEFAULT now(),
  CONSTRAINT t_f_registry_pkey PRIMARY KEY (registry_key,operation_dttm)
) 
PARTITION BY range (operation_dttm) ;

create index idx_t_f_registry_operation_dttm on public.t_f_registry using btree (operation_dttm);

-- партиции/секции
create table t_f_registry_2023_and_earlier partition of public.t_f_registry for values from ('-infinity'::date) to ('2023-01-01'::date);
create table t_f_registry_2024 partition of public.t_f_registry for values from ('2023-01-01'::date) to ('2024-01-01'::date);
create table t_f_registry_2025 partition of public.t_f_registry for values from ('2024-01-01'::date) to ('2025-01-01'::date);
create table t_f_registry_2026 partition of public.t_f_registry for values from ('2025-01-01'::date) to ('2026-01-01'::date);
create table t_f_registry_2027 partition of public.t_f_registry for values from ('2026-01-01'::date) to ('2027-01-01'::date);
create table t_f_registry_2028 partition of public.t_f_registry for values from ('2027-01-01'::date) to ('2028-01-01'::date);
create table t_f_registry_2029 partition of public.t_f_registry for values from ('2028-01-01'::date) to ('2029-01-01'::date);
create table t_f_registry_2030 partition of public.t_f_registry for values from ('2029-01-01'::date) to ('2030-01-01'::date);

-- уникальный индекс по id для каждой секции
--create unique index idx_t_f_registry_2023_and_earlier_registry_key on public.t_f_registry_2023_and_earlier using btree (registry_key);
--create unique index idx_t_f_registry_2024_registry_key on public.t_f_registry_2024 using btree (registry_key);
--create unique index idx_t_f_registry_2025_registry_key on public.t_f_registry_2025 using btree (registry_key);
--create unique index idx_t_f_registry_2026_registry_key on public.t_f_registry_2026 using btree (registry_key);



