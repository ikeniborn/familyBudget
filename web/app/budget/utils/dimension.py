import streamlit as st
import polars as pl
from polars import DataFrame


class Dimension:

    def __new__(cls, *args, **kwargs):
        return super().__new__(cls)

    def __init__(self) -> None:
        pass

    class Nomenclatures:
        def __init__(
            self,
            operation: str = None,
            nomenclatures: DataFrame = None,
        ) -> None:
            self._operation = operation
            self._nomenclatures = nomenclatures

        def form(self, operation_id: int = None, row_type_id: int = None) -> object:
            operation_name = self._operation
            t_d_nomenclature = self._nomenclatures
            bill_key = "_".join([str(row_type_id), str(operation_id), "bill_name"])
            account_key = "_".join([str(row_type_id), str(operation_id), "account_name"])
            nomenclature_key = "_".join([str(row_type_id), str(operation_id), "nomenclature_name"])

            col1, col2, col3 = st.columns(3)

            with col1:

                st.radio(
                    "Счет",
                    key=bill_key,
                    options=t_d_nomenclature.lazy()
                    .filter((pl.col("is_fact") == True) & (pl.col("operation_name") == operation_name))
                    .select("bill_name")
                    .group_by("bill_name", maintain_order=True)
                    .n_unique()
                    .sort(pl.col("bill_name"))
                    .collect()["bill_name"]
                    .to_list(),
                    horizontal=False,
                    index=None,
                )

            with col2:
                st.radio(
                    label="Статья",
                    key=account_key,
                    options=t_d_nomenclature.lazy()
                    .filter((pl.col("is_fact") == True) & (pl.col("operation_name") == operation_name) & (pl.col("bill_name") == st.session_state[bill_key]))
                    .select("account_name")
                    .group_by("account_name", maintain_order=True)
                    .n_unique()
                    .sort(pl.col("account_name"))
                    .collect()["account_name"]
                    .to_list(),
                    index=None,
                )

            nomenclature_list = (
                t_d_nomenclature.lazy()
                .filter(
                    (pl.col("is_fact") == True)
                    & (pl.col("operation_name") == operation_name)
                    & (pl.col("bill_name") == st.session_state[bill_key])
                    & (pl.col("account_name") == st.session_state[account_key])
                )
                .select("nomenclature_name")
                .group_by("nomenclature_name", maintain_order=True)
                .n_unique()
                .sort(pl.col("nomenclature_name"))
                .collect()["nomenclature_name"]
                .to_list()
            )

            st.write(nomenclature_list)
            nomenclature_df_count = nomenclature_df.count()

            if nomenclature_df_count["nomenclature_name"][0] > 1:
                # TODO Реализовать проверку на количество записей и автоматический выбор если значение равно 1
                with col3:
                    st.radio(
                        label="Номенклатура*",
                        key=nomenclature_key,
                        options=t_d_nomenclature.lazy()
                        .filter(
                            (pl.col("is_fact") == True)
                            & (pl.col("operation_name") == operation_name)
                            & (pl.col("bill_name") == st.session_state[bill_key])
                            & (pl.col("account_name") == st.session_state[account_key])
                        )
                        .select("nomenclature_name")
                        .group_by("nomenclature_name", maintain_order=True)
                        .n_unique()
                        .sort(pl.col("nomenclature_name"))
                        .collect()["nomenclature_name"]
                        .to_list(),
                        index=None,
                    )
            else:
                st.session_state[nomenclature_key] = _nomenclature_name
            st.write(st.session_state[nomenclature_key])

            if st.session_state[account_key] and st.session_state[nomenclature_key]:
                st.info(f"Статья: {st.session_state[account_key]}, Номенлатура: {st.session_state[nomenclature_key]}")

                nomenclature_id = (
                    t_d_nomenclature.lazy()
                    .select("nomenclature_id", "nomenclature_name")
                    .filter(pl.col("nomenclature_name") == st.session_state[nomenclature_key])
                    .collect()["nomenclature_id"][0]
                )

                if "nomenclature_id" not in st.session_state:
                    st.session_state.nomenclature_id = nomenclature_id
                else:
                    st.session_state.nomenclature_id = nomenclature_id
                if "nomenclature_key" not in st.session_state:
                    st.session_state.nomenclature_key = nomenclature_key
                else:
                    st.session_state.nomenclature_key = nomenclature_key
