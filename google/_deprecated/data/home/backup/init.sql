CREATE TABLE t_f_registry (
  registry_key UUID PRIMARY KEY,
  operation_dttm TIMESTAMP NOT NULL,
  period_key UUID NOT NULL,
  financial_center_key UUID NOT NULL,
  cost_center_key UUID NOT NULL,
  nomenclature_key UUID NOT NULL,
  cost_sum DECIMAL(12, 2) NOT NULL,
  comment_description VARCHAR NOT NULL,
  row_type_key UUID NOT NULL,
  user_key UUID NOT NULL,
  created_dttm TIMESTAMP NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE t_d_period (
  period_key UUID PRIMARY KEY,
  period_dttm TIMESTAMP NOT NULL DEFAULT now(),
  period_dt DATE NOT NULL,
  period_ru_name VARCHAR NOT NULL,
  created_dttm TIMESTAMP NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE t_d_user (
  user_key UUID PRIMARY KEY,
  user_name VARCHAR NOT NULL,
  user_password VARCHAR NOT NULL,
  user_email VARCHAR,
  created_dttm TIMESTAMP NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE t_d_financial_center (
  financial_center_key UUID PRIMARY KEY,
  financial_center_name VARCHAR NOT NULL,
  created_dttm TIMESTAMP NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE t_d_row_type (
  row_type_key UUID PRIMARY KEY,
  row_type_name VARCHAR NOT NULL,
  created_dttm TIMESTAMP NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE t_d_cost_center (
  cost_center_key UUID PRIMARY KEY,
  cost_center_name VARCHAR NOT NULL,
  created_dttm TIMESTAMP NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE t_d_nomenclature (
  nomenclature_key UUID PRIMARY KEY,
  nomenclature_name VARCHAR NOT NULL,
  account_name VARCHAR NOT NULL,
  bill_name VARCHAR NOT NULL,
  operation_name VARCHAR NOT NULL,
  is_budget BOOLEAN NOT NULL DEFAULT False,
  is_fact BOOLEAN NOT NULL DEFAULT False,
  created_dttm TIMESTAMP NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP NOT NULL DEFAULT now()
);