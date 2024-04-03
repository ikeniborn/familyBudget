import asyncpg
from asyncpg import PostgresError


class Postgres:
    "Класс работы с базой данных PostgreSQL"

    def __new__(cls, *args, **kwargs):
        return super().__new__(cls)

    def __init__(
        self,
        host: str = "localhost",
        port: int = 5432,
        database: str = "postgres",
        user: str = "postgres",
        password: str = "postgres",
    ) -> None:
        self._host = host
        self._port = port
        self._database = database
        self._user = user
        self._password = password
        self._connection = None

    # async def insert(self, sql: str = None):
    #     try:
    #         connection = await asyncpg.connect(
    #             host=self._host,
    #             port=self._port,
    #             user=self._user,
    #             password=self._password,
    #             database=self._database,
    #         )
    #         transaction = connection.transaction()
    #         await transaction.start()
    #         try:
    #             connection.execute(sql)
    #         except:
    #             await transaction.rollback()
    #             raise
    #         else:
    #             await transaction.commit()
    #         await connection.close()
    #     except PostgresError as e:
    #         print(f"The error '{e}' occurred")

    # def delete(self, sql: str = None):
    #     try:
    #         self.connect()
    #         self._cursor.execute(sql)
    #         self._connection.commit()
    #         self.close()
    #     except Exception as error:
    #         print("Error: %s" % error)
    #         return 1

    async def select(self, sql: str = None):
        try:
            connection = await asyncpg.connect(
                host=self._host,
                port=self._port,
                user=self._user,
                password=self._password,
                database=self._database,
            )
            rows = await connection.fetch(query=sql)
            await connection.close()
            # arr = [dict(r) for r in rows]
            return {"rows": rows}
        except PostgresError as e:
            print(f"The error '{e}' occurred")
