INSERT INTO
  public.t_d_accounts (
    account_key,
    account_id,
    account_name,
    telegram_id,
    email
  )
select
  md5(trim(lower('ikeniborn'))) :: UUID as account_key,
  trim(lower('ikeniborn')) as account_id,
  'ikeniborn' as account_name,
  null as telegram_id,
  null as email;

INSERT INTO
  public.t_d_symbols (
    symbol_key,
    symbol_id,
    symbol_name,
    symbol_symbol,
    symbol_full_name,
    symbol_slug,
    symbol_coinmarketcap_id,
    symbol_web3space_key,
    is_active
  )
select
  md5(trim(lower('bitcoin#btc'))) :: UUID as symbol_key,
  trim(lower('bitcoin#btc')) as symbol_id,
  'Bitcoin' as symbol_name,
  'btc' as symbol_symbol,
  'bitcoin [btc]' as symbol_full_name,
  'bitcoin' as symbol_slug,
  1 symbol_coinmarketcap_id,
  'b460f578-b1ce-950c-287e-dc61d0728e51' symbol_web3space_key,
  true as is_active;

INSERT INTO
  public.t_d_timeframes (
    timeframe_key,
    timeframe_id,
    timeframe_name,
    timeframe_short_name
  );

select
  md5(trim(lower('second'))) :: UUID as timeframe_key,
  trim(lower('second')) as timeframe_id,
  'second' as timeframe_name,
  '1s' as timeframe_short_name