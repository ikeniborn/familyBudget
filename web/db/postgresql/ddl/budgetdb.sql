DROP TABLE if EXISTS public.t_f_registry CASCADE;

DROP TABLE if EXISTS public.t_d_cost_center CASCADE;

DROP TABLE if EXISTS public.t_d_financial_center CASCADE;

DROP TABLE if EXISTS public.t_d_nomenclature CASCADE;

DROP TABLE if EXISTS public.t_d_period CASCADE;

DROP TABLE if EXISTS public.t_d_row_type CASCADE;

DROP TABLE if EXISTS public.t_d_user CASCADE;

-- public.t_d_cost_center definition
CREATE TABLE public.t_d_cost_center (
  cost_center_id bigint NOT NULL,
  cost_center_name varchar NOT NULL,
  created_dttm timestamp DEFAULT now() NOT NULL,
  updated_dttm timestamp DEFAULT now() NOT NULL,
  CONSTRAINT t_d_cost_center_cost_center_name_unique UNIQUE (cost_center_name),
  CONSTRAINT t_d_cost_center_pk PRIMARY KEY (cost_center_id)
);

CREATE SEQUENCE t_d_cost_center_cost_center_id_seq as BIGINT INCREMENT BY 1 MINVALUE 1 START 1 CACHE 1 NO CYCLE OWNED BY t_d_cost_center.cost_center_id;

-- public.t_d_financial_center definition
CREATE TABLE public.t_d_financial_center (
  financial_center_id bigint NOT NULL,
  financial_center_name varchar NOT NULL,
  created_dttm timestamp DEFAULT now() NOT NULL,
  updated_dttm timestamp DEFAULT now() NOT NULL,
  CONSTRAINT t_d_financial_center_financial_center_name_unique UNIQUE (financial_center_name),
  CONSTRAINT t_d_financial_center_pk PRIMARY KEY (financial_center_id)
);

CREATE SEQUENCE t_d_financial_center_financial_center_id_seq as BIGINT INCREMENT BY 1 MINVALUE 1 START 1 CACHE 1 NO CYCLE OWNED BY t_d_financial_center.financial_center_id;

-- public.t_d_nomenclature definition
CREATE TABLE public.t_d_nomenclature (
  nomenclature_id bigint NOT NULL,
  nomenclature_name varchar NOT NULL,
  account_name varchar NOT NULL,
  bill_name varchar NOT NULL,
  operation_name varchar NOT NULL,
  is_budget bool DEFAULT false NOT NULL,
  is_fact bool DEFAULT false NOT NULL,
  created_dttm timestamp DEFAULT now() NOT NULL,
  updated_dttm timestamp DEFAULT now() NOT NULL,
  CONSTRAINT t_d_nomenclature_nomenclature_name_unique UNIQUE (nomenclature_name),
  CONSTRAINT t_d_nomenclature_pk PRIMARY KEY (nomenclature_id)
);

CREATE SEQUENCE t_d_nomenclature_nomenclature_id_seq as bigint INCREMENT BY 1 MINVALUE 1 START 1 CACHE 1 NO CYCLE OWNED BY t_d_nomenclature.nomenclature_id;

-- public.t_d_period definition
CREATE TABLE public.t_d_period (
  period_id bigint NOT NULL,
  period_dttm timestamp NOT NULL,
  period_dt date NOT NULL,
  period_ru_name varchar NOT NULL,
  created_dttm timestamp DEFAULT now() NOT NULL,
  updated_dttm timestamp DEFAULT now() NOT NULL,
  CONSTRAINT t_d_period_period_ru_name_unique UNIQUE (period_ru_name),
  CONSTRAINT t_d_period_pk PRIMARY KEY (period_id)
);

CREATE SEQUENCE t_d_period_period_id_seq as bigint INCREMENT BY 1 MINVALUE 1 START 1 CACHE 1 NO CYCLE OWNED BY t_d_period.period_id;

-- public.t_d_row_type definition
CREATE TABLE public.t_d_row_type (
  row_type_id bigint NOT NULL,
  row_type_name varchar NOT NULL,
  created_dttm timestamp DEFAULT now() NOT NULL,
  updated_dttm timestamp DEFAULT now() NOT NULL,
  CONSTRAINT t_d_row_type_row_type_name_unique UNIQUE (row_type_name),
  CONSTRAINT t_d_row_type_pk PRIMARY KEY (row_type_id)
);

CREATE SEQUENCE t_d_row_type_row_type_id_seq as bigint INCREMENT BY 1 MINVALUE 1 START 1 CACHE 1 NO CYCLE OWNED BY t_d_row_type.row_type_id;

-- public.t_d_user definition
CREATE TABLE public.t_d_user (
  user_id bigint NOT NULL,
  user_name varchar NOT NULL,
  user_login varchar NOT NULL,
  user_password varchar NOT NULL,
  user_email varchar NULL,
  user_google_email varchar NULL,
  user_telegram_nickname varchar NULL,
  user_telegram_id BIGINT NULL,
  created_dttm timestamp DEFAULT now() NOT NULL,
  updated_dttm timestamp DEFAULT now() NOT NULL,
  CONSTRAINT t_d_user_user_login_unique UNIQUE (user_login),
  CONSTRAINT t_d_user_pk PRIMARY KEY (user_id)
);

CREATE SEQUENCE t_d_user_user_id_seq as bigint INCREMENT BY 1 MINVALUE 1 START 1 CACHE 1 NO CYCLE OWNED BY t_d_user.user_id;

-- public.t_f_registry definition
CREATE TABLE if not EXISTS public.t_f_registry (
  registry_id BIGINT NOT NULL,
  operation_dttm timestamp NOT NULL,
  period_id bigint NOT NULL REFERENCES t_d_period (period_id),
  financial_center_id bigint NOT NULL REFERENCES t_d_financial_center (financial_center_id),
  cost_center_id bigint NOT NULL REFERENCES t_d_cost_center (cost_center_id),
  nomenclature_id bigint NOT NULL REFERENCES t_d_nomenclature (nomenclature_id),
  cost_sum numeric(12, 2) NOT NULL,
  comment_description varchar NOT NULL,
  row_type_id bigint NOT NULL REFERENCES t_d_row_type (row_type_id),
  user_id bigint NOT NULL REFERENCES t_d_user (user_id),
  created_dttm timestamp NOT NULL DEFAULT now(),
  updated_dttm timestamp NOT NULL DEFAULT now(),
  CONSTRAINT t_f_registry_pk PRIMARY KEY (registry_id, operation_dttm)
) PARTITION BY range (operation_dttm);

CREATE SEQUENCE t_f_registry_registry_id_seq as bigint INCREMENT BY 1 MINVALUE 1 START 1 CACHE 1 NO CYCLE OWNED BY t_d_user.user_id;

create index t_f_registry_operation_dttm_index on public.t_f_registry using btree (operation_dttm);

-- партиции/секции
create table t_f_registry_2023_and_earlier partition of public.t_f_registry for
values
from
  ('-infinity' :: date) to ('2023-01-01' :: date);

create table t_f_registry_2024 partition of public.t_f_registry for
values
from
  ('2023-01-01' :: date) to ('2024-01-01' :: date);

create table t_f_registry_2025 partition of public.t_f_registry for
values
from
  ('2024-01-01' :: date) to ('2025-01-01' :: date);

create table t_f_registry_2026 partition of public.t_f_registry for
values
from
  ('2025-01-01' :: date) to ('2026-01-01' :: date);

create table t_f_registry_2027 partition of public.t_f_registry for
values
from
  ('2026-01-01' :: date) to ('2027-01-01' :: date);

create table t_f_registry_2028 partition of public.t_f_registry for
values
from
  ('2027-01-01' :: date) to ('2028-01-01' :: date);

create table t_f_registry_2029 partition of public.t_f_registry for
values
from
  ('2028-01-01' :: date) to ('2029-01-01' :: date);

create table t_f_registry_2030 partition of public.t_f_registry for
values
from
  ('2029-01-01' :: date) to ('2030-01-01' :: date);

-- уникальный индекс по id для каждой секции
--create unique index idx_t_f_registry_2023_and_earlier_registry_id on public.t_f_registry_2023_and_earlier using btree (registry_id);
--create unique index idx_t_f_registry_2024_registry_id on public.t_f_registry_2024 using btree (registry_id);
--create unique index idx_t_f_registry_2025_registry_id on public.t_f_registry_2025 using btree (registry_id);
--create unique index idx_t_f_registry_2026_registry_id on public.t_f_registry_2026 using btree (registry_id);