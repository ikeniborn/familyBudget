"""
Locust load testing for Family Budget API - TASK-016/TASK-017
Performance Goals: API response < 500ms (p95), Throughput > 100 req/sec
"""
import random
from locust import HttpUser, task, between
from datetime import date, timedelta

class BudgetUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        self.token = "test_token"
        self.headers = {"Cookie": f"access_token={self.token}"}
    
    @task(60)
    def view_facts(self):
        self.client.get("/api/v1/facts?limit=50", headers=self.headers)
    
    @task(20)
    def create_fact(self):
        data = {
            "article_id": random.randint(1, 10),
            "fact_date": date.today().isoformat(),
            "amount": str(round(random.uniform(10, 500), 2)),
            "record_type": "fact"
        }
        self.client.post("/api/v1/facts", json=data, headers=self.headers)
    
    @task(10)
    def view_analytics(self):
        self.client.get("/api/v1/analytics/waterfall?period=year", headers=self.headers)
    
    @task(5)
    def view_articles(self):
        self.client.get("/api/v1/articles", headers=self.headers)
