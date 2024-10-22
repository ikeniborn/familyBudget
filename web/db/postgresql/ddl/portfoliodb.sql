drop TABLE if EXISTS public.t_d_contractors_l_contractor_categories CASCADE;

drop TABLE if EXISTS public.t_d_symbols_l_symbol_tags CASCADE;

drop TABLE if EXISTS public.t_d_symbols_l_ecosystems CASCADE;

drop TABLE if EXISTS public.t_d_symbols_l_blockchains CASCADE;

drop TABLE if EXISTS public.t_d_symbols_l_symbol_categories CASCADE;

drop TABLE if EXISTS public.t_d_symbols_l_symbols_types CASCADE;

drop TABLE if EXISTS public.t_d_contractors_l_services CASCADE;

drop TABLE if EXISTS public.t_d_symbols_l_blockchains CASCADE;

drop TABLE if EXISTS public.t_d_symbol_categories CASCADE;

drop TABLE if EXISTS public.t_d_symbol_types CASCADE;

drop TABLE if EXISTS public.t_d_symbol_tags CASCADE;

drop TABLE if EXISTS public.t_d_timeframes CASCADE;

drop TABLE if EXISTS public.t_d_symbols CASCADE;

drop TABLE if EXISTS public.t_d_contractors CASCADE;

drop TABLE if EXISTS public.t_d_services CASCADE;

drop TABLE if EXISTS public.t_d_opetation_types CASCADE;

drop TABLE if EXISTS public.t_d_directions CASCADE;

drop TABLE if EXISTS public.t_d_accounts CASCADE;

drop TABLE if EXISTS public.t_d_portfolios CASCADE;

drop TABLE if EXISTS public.t_d_ecosystems CASCADE;

drop TABLE if EXISTS public.t_d_blockchains CASCADE;

drop TABLE if EXISTS public.t_d_contractor_categories CASCADE;

drop TABLE if EXISTS public.t_d_contractor_types CASCADE;

drop TABLE if EXISTS public.t_f_operations CASCADE;

drop TABLE if EXISTS public.t_f_transactions CASCADE;

drop TABLE if EXISTS public.t_f_symbol_prices CASCADE;

--drop TABLE if EXISTS public.t_dm_flow CASCADE;
CREATE TABLE if not EXISTS public.t_d_blockchains (
  blockchain_key UUID PRIMARY KEY,
  blockchain_id VARCHAR NOT NULL,
  blockchain_name VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_opetation_types (
  operation_type_key UUID PRIMARY KEY,
  operation_type_id VARCHAR NOT NULL,
  operation_type_name VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_directions (
  direction_key UUID PRIMARY KEY,
  direction_id VARCHAR NOT NULL,
  direction_name VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_accounts (
  account_key UUID PRIMARY KEY,
  account_id VARCHAR NOT NULL,
  account_name VARCHAR,
  telegram_id BIGINT,
  email VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_portfolios (
  portfolio_key UUID PRIMARY KEY,
  account_key UUID NOT NULL REFERENCES t_d_accounts (account_key),
  portfolio_id VARCHAR NOT NULL,
  portfolio_name VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_contractor_types (
  contractor_type_key UUID PRIMARY KEY,
  contractor_type_id VARCHAR NOT NULL,
  contractor_type_name VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_contractors (
  contractor_key UUID PRIMARY KEY,
  contractor_type_key UUID NOT NULL REFERENCES t_d_contractor_types (contractor_type_key),
  contractor_id VARCHAR NOT NULL,
  portfolio_name VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_services (
  service_key UUID PRIMARY KEY,
  service_id VARCHAR NOT NULL,
  service_name VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_contractor_categories (
  contractor_category_key UUID PRIMARY KEY,
  contractor_category_id VARCHAR NOT NULL,
  contractor_category_name VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_contractors_l_contractor_categories (
  contractor_key UUID NOT NULL REFERENCES t_d_contractors (contractor_key),
  contractor_category_key UUID NOT NULL REFERENCES t_d_contractor_categories (contractor_category_key),
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (contractor_key, contractor_category_key)
);

CREATE TABLE if not EXISTS public.t_d_contractors_l_services (
  service_key UUID NOT NULL REFERENCES t_d_services (service_key),
  contractor_key UUID NOT NULL REFERENCES t_d_contractors (contractor_key),
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (service_key, contractor_key)
);

CREATE TABLE if not EXISTS public.t_d_symbols (
  symbol_key UUID PRIMARY KEY,
  symbol_id VARCHAR NOT NULL,
  symbol_name VARCHAR,
  symbol_symbol VARCHAR,
  symbol_full_name VARCHAR,
  symbol_slug VARCHAR,
  symbol_coinmarketcap_id BIGINT,
  symbol_web3space_key UUID,
  is_active BOOLEAN DEFAULT True,
  is_delete BOOLEAN DEFAULT False,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_symbol_types (
  symbol_type_key UUID PRIMARY KEY,
  symbol_type_id VARCHAR NOT NULL,
  symbol_type_ru_name VARCHAR,
  symbol_type_en_name VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_timeframes (
  timeframe_key UUID PRIMARY KEY,
  timeframe_id VARCHAR NOT NULL,
  timeframe_name VARCHAR,
  timeframe_short_name VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_f_symbol_prices (
  symbol_price_dttm TIMESTAMP without time zone NOT NULL,
  symbol_key UUID NOT NULL REFERENCES t_d_symbols (symbol_key),
  timeframe_key UUID NOT NULL REFERENCES t_d_timeframes (timeframe_key),
  symbol_price_high FLOAT,
  symbol_price_open FLOAT,
  symbol_price_close FLOAT,
  symbol_price_low FLOAT,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol_price_dttm, symbol_key, timeframe_key)
);

--PARTITION BY range (operation_dttm) ;
create index idx_t_f_symbol_prices_symbol_price_dttm on public.t_f_symbol_prices using btree (symbol_price_dttm);
create index idx_t_f_symbol_prices_symbol_key on public.t_f_symbol_prices using btree (symbol_key);

CREATE TABLE if not EXISTS public.t_d_symbol_categories (
  symbol_category_key UUID PRIMARY KEY,
  symbol_category_id VARCHAR NOT NULL,
  symbol_category_ru_name VARCHAR,
  symbol_category_en_name VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_symbol_tags (
  symbol_tag_key UUID PRIMARY KEY,
  symbol_tag_id VARCHAR NOT NULL,
  symbol_tag_ru_name VARCHAR,
  symbol_tag_en_name VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_ecosystems(
  ecosystem_key UUID PRIMARY KEY,
  ecosystem_id VARCHAR NOT NULL,
  ecosystem_name VARCHAR,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_d_symbols_l_ecosystems (
  symbol_key UUID NOT NULL REFERENCES t_d_symbols (symbol_key),
  ecosystem_key UUID NOT NULL REFERENCES t_d_ecosystems (ecosystem_key),
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol_key, ecosystem_key)
);

CREATE TABLE if not EXISTS public.t_d_symbols_l_symbol_tags (
  symbol_key UUID NOT NULL REFERENCES t_d_symbols (symbol_key),
  symbol_tag_key UUID NOT NULL REFERENCES t_d_symbol_tags (symbol_tag_key),
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol_key, symbol_tag_key)
);

CREATE TABLE if not EXISTS public.t_d_symbols_l_symbols_types (
  symbol_key UUID NOT NULL REFERENCES t_d_symbols (symbol_key),
  symbol_type_key UUID NOT NULL REFERENCES t_d_symbol_types (symbol_type_key),
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol_key, symbol_type_key)
);

CREATE TABLE if not EXISTS public.t_d_symbols_l_blockchains (
  symbol_key UUID NOT NULL REFERENCES t_d_symbols (symbol_key),
  blockchain_key UUID NOT NULL REFERENCES t_d_blockchains (blockchain_key),
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol_key, blockchain_key)
);

CREATE TABLE if not EXISTS public.t_d_symbols_l_symbol_categories (
  symbol_key UUID NOT NULL REFERENCES t_d_symbols (symbol_key),
  symbol_category_key UUID NOT NULL REFERENCES t_d_symbol_categories (symbol_category_key),
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol_key, symbol_category_key)
);

CREATE TABLE if not EXISTS public.t_f_operations (
  operation_key UUID PRIMARY key DEFAULT gen_random_uuid(),
  operation_dttm TIMESTAMP without time zone NOT NULL,
  operation_type_key UUID NOT NULL REFERENCES t_d_opetation_types (operation_type_key),
  account_out_key UUID NOT NULL REFERENCES t_d_accounts (account_key),
  portfolio_out_key UUID NOT NULL REFERENCES t_d_portfolios (portfolio_key),
  account_in_key UUID REFERENCES t_d_accounts (account_key),
  portfolio_in_key UUID REFERENCES t_d_portfolios (portfolio_key),
  platform_key UUID NOT NULL REFERENCES t_d_contractors (contractor_key),
  service_key UUID NOT NULL REFERENCES t_d_services (service_key),
  sender_key UUID NOT NULL REFERENCES t_d_contractors (contractor_key),
  recipient_key UUID NOT NULL REFERENCES t_d_contractors (contractor_key),
  is_lock BOOLEAN DEFAULT false,
  coin_key UUID NOT NULL REFERENCES t_d_symbols (symbol_key),
  coin_qty FLOAT,
  currency_key UUID REFERENCES t_d_symbols (symbol_key),
  currency_qty FLOAT,
  currency_per_coin FLOAT,
  fee_sender_key UUID REFERENCES t_d_contractors (contractor_key),
  fee_currency_key UUID REFERENCES t_d_symbols (symbol_key),
  fee_qty FLOAT,
  comment VARCHAR,
  md5 UUID NOT NULL,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

--PARTITION BY range (operation_dttm) ;
create index idx_t_f_registry_operation_dttm on public.t_f_operations using btree (operation_dttm);
create index idx_t_f_registry_account_out_key on public.t_f_operations using btree (account_out_key);

--create index idx_t_f_registry_operation_dttm on public.t_f_operations using btree (operation_dttm);
-- партиции/секции
--create table t_f_operations_2020_and_earlier partition of public.t_f_operations for values from ('-infinity'::date) to ('2020-01-01'::date);
--create table t_f_registry_2021 partition of public.t_f_operations for values from ('2020-01-01'::date) to ('2021-01-01'::date);
--create table t_f_registry_2022 partition of public.t_f_operations for values from ('2021-01-01'::date) to ('2022-01-01'::date);
--create table t_f_registry_2023 partition of public.t_f_operations for values from ('2022-01-01'::date) to ('2023-01-01'::date);
--create table t_f_registry_2024 partition of public.t_f_operations for values from ('2023-01-01'::date) to ('2024-01-01'::date);
--create table t_f_registry_2025 partition of public.t_f_operations for values from ('2024-01-01'::date) to ('2025-01-01'::date);
--create table t_f_registry_2026 partition of public.t_f_operations for values from ('2025-01-01'::date) to ('2026-01-01'::date);
--create table t_f_registry_2027 partition of public.t_f_operations for values from ('2026-01-01'::date) to ('2027-01-01'::date);
--create table t_f_registry_2028 partition of public.t_f_operations for values from ('2027-01-01'::date) to ('2028-01-01'::date);
--create table t_f_registry_2029 partition of public.t_f_operations for values from ('2028-01-01'::date) to ('2029-01-01'::date);
--create table t_f_registry_2030 partition of public.t_f_operations for values from ('2029-01-01'::date) to ('2030-01-01'::date);
--
-- уникальный индекс по ключу операции 
--create unique index idx_t_f_operations_2020_and_earlier_operation_key on public.t_f_operations_2020_and_earlier using btree (account_out_key);
--create unique index idx_t_f_registry_2021_operation_key on public.t_f_registry_2021 using btree (account_out_key);
--create unique index idx_t_f_registry_2022_operation_key on public.t_f_registry_2022 using btree (account_out_key);
--create unique index idx_t_f_registry_2023_operation_key on public.t_f_registry_2023 using btree (account_out_key);
--create unique index idx_t_f_registry_2024_operation_key on public.t_f_registry_2024 using btree (account_out_key);
--create unique index idx_t_f_registry_2025_operation_key on public.t_f_registry_2025 using btree (account_out_key);
--create unique index idx_t_f_registry_2026_operation_key on public.t_f_registry_2026 using btree (account_out_key);
--create unique index idx_t_f_registry_2027_operation_key on public.t_f_registry_2027 using btree (account_out_key);
--create unique index idx_t_f_registry_2028_operation_key on public.t_f_registry_2028 using btree (account_out_key);
--create unique index idx_t_f_registry_2029_operation_key on public.t_f_registry_2029 using btree (account_out_key);
--create unique index idx_t_f_registry_2030_operation_key on public.t_f_registry_2030 using btree (account_out_key);
--
-- индекс по акканту в партициях
--create index idx_t_f_operations_2020_and_earlier_account_out_key on public.t_f_operations_2020_and_earlier using btree (account_out_key);
--create index idx_t_f_registry_2021_account_out_key on public.t_f_registry_2021 using btree (account_out_key);
--create index idx_t_f_registry_2022_account_out_key on public.t_f_registry_2022 using btree (account_out_key);
--create index idx_t_f_registry_2023_account_out_key on public.t_f_registry_2023 using btree (account_out_key);
--create index idx_t_f_registry_2024_account_out_key on public.t_f_registry_2024 using btree (account_out_key);
--create index idx_t_f_registry_2025_account_out_key on public.t_f_registry_2025 using btree (account_out_key);
--create index idx_t_f_registry_2026_account_out_key on public.t_f_registry_2026 using btree (account_out_key);
--create index idx_t_f_registry_2027_account_out_key on public.t_f_registry_2027 using btree (account_out_key);
--create index idx_t_f_registry_2028_account_out_key on public.t_f_registry_2028 using btree (account_out_key);
--create index idx_t_f_registry_2029_account_out_key on public.t_f_registry_2029 using btree (account_out_key);
--create index idx_t_f_registry_2030_account_out_key on public.t_f_registry_2030 using btree (account_out_key);

CREATE TABLE if not EXISTS public.t_f_transactions (
  transaction_key UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key UUID NOT NULL REFERENCES t_f_operations (operation_key),
  direction_key UUID NOT NULL REFERENCES t_d_directions (direction_key),
  account_key UUID NOT NULL REFERENCES t_d_accounts (account_key),
  portfolio_key UUID NOT NULL REFERENCES t_d_portfolios (portfolio_key),
  contractor_key UUID NOT NULL REFERENCES t_d_contractors (contractor_key),
  symbol_key UUID NOT NULL REFERENCES t_d_symbols (symbol_key),
  quantity FLOAT,
  price FLOAT,
  cost FLOAT,
  is_deleted BOOLEAN DEFAULT false,
  is_fee BOOLEAN DEFAULT false,
  is_lock BOOLEAN DEFAULT false,
  is_overflow BOOLEAN DEFAULT false,
  is_historical_price BOOLEAN DEFAULT false,
  md5 UUID NOT NULL,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

--PARTITION BY range (operation_dttm) ;
create index idx_t_f_transactions_operation_key on public.t_f_transactions using btree (operation_key);
create index idx_t_f_transactions_account_key on public.t_f_transactions using btree (account_key);
create index idx_t_f_transactions_portfolio_key on public.t_f_transactions using btree (portfolio_key);
create index idx_t_f_transactions_symbol_key on public.t_f_transactions using btree (symbol_key);

--CREATE TABLE if not EXISTS public.t_dm_flow (
--  account_key UUID NOT NULL REFERENCES t_d_accounts (account_key),
--  portfolio_key UUID NOT NULL REFERENCES t_d_portfolios (portfolio_key),
--  contractor_key UUID NOT NULL REFERENCES t_d_contractors (contractor_key),
--  symbol_key UUID NOT NULL REFERENCES t_d_symbols (symbol_key),
--  quantity_invest FLOAT,
--  quantity_overflow FLOAT,
--  quantity_rest FLOAT,
--  quantity_lock FLOAT,
--  quantity_rebalance FLOAT,
--  price_rest FLOAT,
--  price_last FLOAT,
--  cost_invest FLOAT,
--  cost_rest FLOAT,
--  cost_last FLOAT,
--  cost_lock FLOAT,
--  cost_total FLOAT,
--  cost_realized FLOAT,
--  cost_unrealized FLOAT,
--  pnl_realized FLOAT,
--  pnl_unrealized FLOAT,
--  pnl_total FLOAT,
--  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
--  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
--  PRIMARY KEY (
--    account_key,
--    portfolio_key,
--    contractor_key,
--    symbol_key
--  )
--);