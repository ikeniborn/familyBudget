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

drop TABLE if EXISTS public.t_dm_flow CASCADE;

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
  is_active BOOLEAN DEFAULT False,
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

CREATE TABLE if not EXISTS public.t_f_symbol_prices (
  start_dttm TIMESTAMP without time zone NOT NULL,
  end_dttm TIMESTAMP without time zone NOT NULL,
  symbol_key UUID NOT NULL REFERENCES t_d_symbols (symbol_key),
  high FLOAT,
  low FLOAT,
  max FLOAT,
  min FLOAT,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

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
  operation_key UUID DEFAULT gen_random_uuid(),
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
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
  CONSTRAINT t_f_operations_pkey PRIMARY KEY (operation_key,account_out_key)
)PARTITION BY LIST (account_out_key) ;

create index idx_t_f_operations_account_out_key on public.t_f_operations using btree (account_out_key);



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
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now()
);

CREATE TABLE if not EXISTS public.t_dm_flow (
  account_key UUID NOT NULL REFERENCES t_d_accounts (account_key),
  portfolio_key UUID NOT NULL REFERENCES t_d_portfolios (portfolio_key),
  contractor_key UUID NOT NULL REFERENCES t_d_contractors (contractor_key),
  symbol_key UUID NOT NULL REFERENCES t_d_symbols (symbol_key),
  quantity_invest FLOAT,
  quantity_overflow FLOAT,
  quantity_rest FLOAT,
  quantity_lock FLOAT,
  quantity_rebalance FLOAT,
  price_rest FLOAT,
  price_last FLOAT,
  cost_invest FLOAT,
  cost_rest FLOAT,
  cost_last FLOAT,
  cost_lock FLOAT,
  cost_total FLOAT,
  cost_realized FLOAT,
  cost_unrealized FLOAT,
  pnl_realized FLOAT,
  pnl_unrealized FLOAT,
  pnl_total FLOAT,
  created_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  updated_dttm TIMESTAMP without time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (
    account_key,
    portfolio_key,
    contractor_key,
    symbol_key
  )
);
