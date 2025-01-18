from fastapi import FastAPI
from utils.postgres import Postgres
from utils.models import Models
import os

app = FastAPI()

connection = Postgres(
    host=os.getenv("POSTGRES_HOST"),
    database=os.getenv("POSTGRES_DB"),
    user=os.getenv("POSTGRES_USER"),
    password=os.getenv("POSTGRES_PASSWORD"),
)


@app.get("/users")
async def get_users():
    return await connection.select(
        f"""
        select 
          user_id, 
          user_name 
        from 
          t_d_user
      """
    )


@app.get("/users/{key}")
async def get_user(key: str):
    return await connection.select(
        f"""
        select
          user_id,
          user_name,
          user_email
        from
          t_d_user
        where
          user_id in ('{key}')
      """
    )


@app.get("/periods")
async def get_periods(start_date: str = None, end_date: str = None):
    sql = f"""
      select
        period_id,
        period_dt,
        period_ru_name
      from
        t_d_period
      where 
        1=1
      """
    if start_date and end_date:
        sql += f"""and period_dt>='{start_date}'
                  and period_dt<='{end_date}'
              """
    sql += f"""
      order by
        period_dt
      """
    rows_array = await connection.select(sql)
    rows_dict = [Models.Period(period_id=row[0], period_dt=row[1], period_ru_name=row[2]) for row in rows_array]
    return rows_dict


@app.get("/periods/{key}")
async def get_period(key: str):
    rows_array = await connection.select(
        f"""
        select
          period_id,
          period_dt,
          period_ru_name
        from
          t_d_period
        where
          period_id in ('{key}')
      """
    )
    rows_dict = [Models.Period(period_id=row[0], period_dt=row[1], period_ru_name=row[1]) for row in rows_array]
    return rows_dict


@app.get("/financial_centers")
async def get_financial_centers():
    return await connection.select(
        f"""
      select
        financial_center_id,
        financial_center_name
      from
        t_d_financial_center
      """
    )


@app.get("/financial_centers/{key}")
async def get_financial_center(key: str):
    return await connection.select(
        f"""
        select
          financial_center_id,
          financial_center_name
        from
          t_d_financial_center
        where
          financial_center_id in ('{key}')
      """
    )


@app.get("/cost_centers")
async def get_cost_centers():
    return await connection.select(
        f"""
        select
          cost_center_id,
          cost_center_name
        from
          t_d_cost_center
      """
    )


@app.get("/cost_centers/{key}")
async def get_cost_center(key: str):
    return await connection.select(
        f"""
        select
          cost_center_id,
          cost_center_name
        from
          t_d_cost_center
        where
          cost_center_id in ('{key}')
      """
    )


@app.get("/nomenclatures")
async def get_nomenclatures():
    return await connection.select(
        """
        select
          nomenclature_id,
          nomenclature_name,
          account_name,
          bill_name,
          operation_name,
          is_budget,
          is_fact
        from
          t_d_nomenclature
        where 
          is_budget or is_fact
        order by 
          operation_name,
          nomenclature_name
      """
    )


@app.get("/nomenclatures/{key}")
async def get_nomenclature(key: str):
    return await connection.select(
        f"""
        select
          nomenclature_id,
          nomenclature_name,
          account_name,
          bill_name,
          operation_name,
          is_budget,
          is_fact
        from
          t_d_nomenclature
        where
          nomenclature_id in ('{key}')
      """
    )


@app.get("/row_types")
async def get_row_types():
    return await connection.select(
        f"""
        select
          row_type_id,
          row_type_name
        from
          t_d_row_type
      """
    )


@app.get("/row_types/{key}")
async def get_row_type(key: str):
    return await connection.select(
        f"""
        select
          row_type_id,
          row_type_name
        from
          t_d_row_type
        where
          row_type_id in ('{key}')
      """
    )


@app.post("/registry")
async def insert_to_registry(row: Models.Registry):
    await connection.insert(
        sql=f"""
          INSERT INTO t_f_registry (
          registry_id,
          operation_dttm,
          period_id,
          financial_center_id,
          cost_center_id,
          nomenclature_id,
          cost_sum,
          comment_description,
          row_type_id,
          user_id)
          VALUES (
          \'{row.registry_id}\',
          \'{row.operation_dttm}\',
          \'{row.period_id}\',
          \'{row.financial_center_id}\',
          \'{row.cost_center_id}\',
          \'{row.nomenclature_id}\',
          {row.cost_sum},
          \'{row.comment_description}\',
          \'{row.row_type_id}\',
          \'{row.user_id}\'
          );
      """
    )


@app.get("/registry/last_row")
async def get_registry_last_row(row_type_id: str = None, limit_rows: int = 5):
    return await connection.select(
        sql=f"""
        select
          t0.operation_dttm as "Дата операции",
          t1.period_ru_name as "Период",
          t2.financial_center_name as "ЦФО",
          t3.cost_center_name as "МВЗ",
          t4.nomenclature_name as "Номенклатура",
          t0.cost_sum as "Сумма",
          t0.comment_description as "Комментарий"
        from t_f_registry t0
        join t_d_period t1 using(period_id)
        join t_d_financial_center t2 using(financial_center_id)
        join t_d_cost_center t3 using(cost_center_id)
        join t_d_nomenclature t4 using(nomenclature_id)
        where
          t0.row_type_id = \'{row_type_id}\'
        order by
          t0.updated_dttm desc
        limit {limit_rows}
      """
    )


@app.get("/report/budget/row_type_nomenclature")
async def get_report_budget_row_type_nomenclature(
    financial_center_id: str = None, period_id: str = None, nomenclature_id: str = None
):
    sql = f"""
          select
            t4.row_type_name as "Тип",
            t3.nomenclature_name as "Номенклатура",
            sum(cost_sum) as "Сумма"
          from
            t_f_registry t0
          join t_d_financial_center t2 using(financial_center_id)
          join t_d_nomenclature t3 using(nomenclature_id)
          join t_d_row_type t4 using(row_type_id)
          where
            t0.financial_center_id=\'{financial_center_id}\'
            and t0.period_id=\'{period_id}\'
            and t0.nomenclature_id='{nomenclature_id}'
          group by
            t4.row_type_name,
            t3.nomenclature_name
          order by
            t4.row_type_name
      """
    return await connection.select(sql=sql)


@app.get("/report/perfomance/row_type_nomenclature")
async def get_report_perfomance_row_type_nomenclature(
    financial_center_id: str = None, period_id: str = None, nomenclature_id: str = None
):
    sql = f"""
          select
            t4.row_type_name as "Тип",
            t3.nomenclature_name as "Номенклатура",
            sum(cost_sum) as "Сумма"
          from
            t_f_registry t0
          join t_d_financial_center t2 using(financial_center_id)
          join t_d_nomenclature t3 using(nomenclature_id)
          join t_d_row_type t4 using(row_type_id)
          where
            t0.financial_center_id=\'{financial_center_id}\'
            and t0.period_id=\'{period_id}\'
            and t0.nomenclature_id='{nomenclature_id}'
          group by
            t4.row_type_name,
            t3.nomenclature_name
          order by
            t4.row_type_name
      """
    return await connection.select(sql=sql)


@app.get("/report/compare/row_type_nomenclature")
async def get_report_compare_row_type_nomenclature(financial_center_id: str = None, period_id: str = None):
    sql = f"""
          select
            t4.row_type_name as "Тип",
            t3.nomenclature_name as "Номенклатура",
            sum(cost_sum) as "Сумма"
          from
            t_f_registry t0
          join t_d_financial_center t2 using(financial_center_id)
          join t_d_nomenclature t3 using(nomenclature_id)
          join t_d_row_type t4 using(row_type_id)
          where
            t0.financial_center_id=\'{financial_center_id}\'
            and t0.period_id=\'{period_id}\'
          group by
            t4.row_type_name,
            t3.nomenclature_name
          order by
            t4.row_type_name
      """
    return await connection.select(sql=sql)


@app.get("/report/compare/row_type_operation")
async def get_report_compare_row_type_operation(financial_center_id: str = None, period_id: str = None):
    return await connection.select(
        sql=f"""
              SELECT
                t2.row_type_name AS "Тип",
                t1.operation_name AS "Операция",
                sum(t0.cost_sum) AS "Сумма"
              FROM
                t_f_registry t0
              join t_d_nomenclature t1 using(nomenclature_id)
              join t_d_row_type t2 using(row_type_id)
              WHERE
                t0.financial_center_id = \'{financial_center_id}\'
                AND t0.period_id = \'{period_id}\'
              GROUP BY 
                t2.row_type_name,
                t1.operation_name
              ORDER BY
                t2.row_type_name,
                t1.operation_name
                """
    )


@app.get("/report/compare/row_type_bill")
async def get_report_compare_row_type_bill(financial_center_id: str = None, period_id: str = None):
    return await connection.select(
        sql=f"""
              SELECT
                t2.row_type_name AS "Тип",
                t1.bill_name AS "Счет",
                sum(t0.cost_sum) AS "Сумма"
              FROM
                t_f_registry t0
              join t_d_nomenclature t1 using(nomenclature_id)
              join t_d_row_type t2 using(row_type_id)
              WHERE
                t0.financial_center_id = \'{financial_center_id}\'
                AND t0.period_id = \'{period_id}\'
              GROUP BY 
                t2.row_type_name,
                t1.bill_name
              ORDER BY
                t2.row_type_name,
                t1.bill_name
                """
    )


@app.get("/report/compare/row_type_account")
async def get_report_compare_row_type_account(financial_center_id: str = None, period_id: str = None):
    return await connection.select(
        sql=f"""
              SELECT
                t2.row_type_name AS "Тип",
                t1.account_name AS "Статья",
                sum(t0.cost_sum) AS "Сумма"
              FROM
                t_f_registry t0
              join t_d_nomenclature t1 using(nomenclature_id)
              join t_d_row_type t2 using(row_type_id)
              WHERE
                t0.financial_center_id = \'{financial_center_id}\'
                AND t0.period_id = \'{period_id}\'
              GROUP BY row_type_name,
                t1.account_name
              ORDER BY
                t2.row_type_name,
                t1.account_name
                """
    )


@app.get("/report/budget/total")
async def get_report_budget_total(financial_center_id: str = None, period_id: str = None):
    return await connection.select(
        sql=f"""
            SELECT
              sum(t0.cost_sum) AS "Сумма"
            FROM
              t_f_registry t0
            WHERE
              t0.financial_center_id = \'{financial_center_id}\'
            AND t0.period_id = \'{period_id}\'
            AND t0.row_type_id = \'f003e80f-57d7-6757-bd6a-24170e1f75a4\'
            """
    )


@app.get("/report/budget/bill_account")
async def get_report_budget_bill_account(financial_center_id: str = None, period_id: str = None):
    return await connection.select(
        sql=f"""
            SELECT
              t1.bill_name AS "Счет",
              t1.account_name AS "Статья",
              sum(t0.cost_sum) AS "Сумма"
            FROM
              t_f_registry t0
            join t_d_nomenclature t1 using(nomenclature_id) 
            WHERE
              t0.financial_center_id = \'{financial_center_id}\'
              AND t0.period_id = \'{period_id}\'
              AND t0.row_type_id = \'f003e80f-57d7-6757-bd6a-24170e1f75a4\'
            GROUP BY
              t1.bill_name,
              t1.account_name
            ORDER BY
              t1.bill_name,
              t1.account_name
              """
    )
