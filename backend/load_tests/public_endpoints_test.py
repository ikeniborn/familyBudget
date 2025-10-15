"""
Public Endpoints Load Test
Tests public/health endpoints without authentication
"""

from locust import HttpUser, task, between
from locust.contrib.fasthttp import FastHttpUser


class PublicEndpointsUser(FastHttpUser):
    """
    Test public endpoints (no authentication required)
    """

    wait_time = between(0.1, 0.5)  # Very short wait time for stress testing

    @task(20)
    def get_health(self):
        """Health check endpoint - highest frequency"""
        self.client.get("/health", name="/health")

    @task(10)
    def get_ping(self):
        """Ping endpoint"""
        self.client.get("/ping", name="/ping")

    @task(5)
    def get_ready(self):
        """Readiness check"""
        self.client.get("/ready", name="/ready")

    @task(3)
    def get_health_detailed(self):
        """Detailed health check"""
        self.client.get("/health/detailed", name="/health/detailed")
