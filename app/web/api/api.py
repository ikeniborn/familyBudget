from fastapi import FastAPI
from pydantic import BaseModel, EmailStr
from utils.postgres import Postgres
import os
from datetime import datetime
import uuid

app = FastAPI()

connection = Postgres(
    host=os.getenv("POSTGRES_HOST"),
    database=os.getenv("BUDGET_POSTGRES_DB"),
    user=os.getenv("BUDGET_POSTGRES_USER"),
    password=os.getenv("BUDGET_POSTGRES_PASSWORD"),
)


class Row(BaseModel):
    registry_key: uuid.UUID
    operation_dttm: datetime
    period_key: uuid.UUID
    financial_center_key: uuid.UUID
    cost_center_key: uuid.UUID
    nomenclature_key: uuid.UUID
    cost_sum: float
    comment_description: uuid.UUID
    row_type_key: uuid.UUID
    key: uuid.UUID
    created_dttm: datetime
    updated_dttm: datetime


@app.get("/budget")
async def get_budget(financial_center_key: str = None, period_key: str = None):
    return await connection.select(
        f"""
              SELECT
                t2.row_type_name AS "Тип",
                t1.operation_name AS "Операция",
                sum(t0.cost_sum) AS "Сумма"
              FROM
                t_f_registry t0
              join t_d_nomenclature t1 using(nomenclature_key)
              join t_d_row_type t2 using(row_type_key)
              WHERE
                t0.financial_center_key = \'{financial_center_key}\'
                AND t0.period_key = \'{period_key}\'
              GROUP BY 
                t2.row_type_name,
                t1.operation_name
              ORDER BY
                t2.row_type_name,
                t1.operation_name
                """
    )


@app.get("/users")
async def get_users():
    return await connection.select(
        f"""
        select 
          user_key, 
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
          user_key,
          user_name,
          user_email
        from
          t_d_user
        where
          user_key in ('{key}')
      """
    )


@app.get("/periods")
async def get_periods():
    return await connection.select(
        f"""
      select
        period_key,
        period_dt,
        period_ru_name
      from
        t_d_period
      order by
        period_dt
      """
    )


@app.get("/periods/{key}")
async def get_period(key: str):
    return await connection.select(
        f"""
        select
          period_key,
          period_dt,
          period_ru_name
        from
          t_d_period
        where
          period_key in ('{key}')
      """
    )


@app.get("/financial_centers")
async def get_financial_centers():
    return await connection.select(
        f"""
      select
        financial_center_key,
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
          financial_center_key,
          financial_center_name
        from
          t_d_financial_center
        where
          financial_center_key in ('{key}')
      """
    )


@app.get("/cost_centers")
async def get_cost_centers():
    return await connection.select(
        f"""
        select
          cost_center_key,
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
          cost_center_key,
          cost_center_name
        from
          t_d_cost_center
        where
          cost_center_key in ('{key}')
      """
    )


@app.get("/nomenclatures")
async def get_nomenclatures():
    return await connection.select(
        f"""
        select
          nomenclature_key,
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
          bill_name,
          account_name,
          nomenclature_name
      """
    )


@app.get("/nomenclatures/{key}")
async def get_nomenclature(key: str):
    return await connection.select(
        f"""
        select
          nomenclature_key,
          nomenclature_name,
          account_name,
          bill_name,
          operation_name,
          is_budget,
          is_fact
        from
          t_d_nomenclature
        where
          nomenclature_key in ('{key}')
      """
    )


@app.get("/row_types")
async def get_row_types():
    return await connection.select(
        f"""
        select
          row_type_key,
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
          row_type_key,
          row_type_name
        from
          t_d_row_type
        where
          row_type_key in ('{key}')
      """
    )
