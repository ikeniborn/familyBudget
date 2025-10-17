# Load Testing Guide

**Project:** Family Budget
**Version:** 4.4.0
**Date:** 2025-10-14
**Tasks:** EPIC-005 (TASK-016 through TASK-019)

---

## Table of Contents

1. [Overview](#overview)
2. [Setup](#setup)
3. [Test Scenarios](#test-scenarios)
4. [Running Tests](#running-tests)
5. [Interpreting Results](#interpreting-results)
6. [Performance Targets](#performance-targets)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers load testing for the Family Budget application using **Locust**, a Python-based load testing framework.

### Test Coverage

**TASK-016:** Load Testing Framework Setup ✅
- Locust configuration
- Test scenarios
- Automated test scripts

**TASK-017:** API Performance Testing
- Read-heavy scenarios
- Write-heavy scenarios
- Mixed workload scenarios
- Stress testing (high load)

**TASK-018:** Database Load Testing
- Direct database queries
- Concurrent connections
- Burst vs sustained load

**TASK-019:** Telegram Bot Load Testing
- Simulated bot interactions
- Concurrent user sessions
- Message handling throughput

---

## Setup

### 1. Install Dependencies

```bash
# Navigate to load tests directory
cd backend/load_tests

# Install requirements
pip install -r requirements_loadtest.txt
```

**Dependencies:**
- `locust==2.20.0` - Load testing framework
- `asyncpg==2.9.9` - PostgreSQL async driver
- `faker==22.0.0` - Test data generation
- `pandas==2.1.4` - Results analysis
- `matplotlib==3.8.2` - Visualization

### 2. Configure Environment

Create or update `.env` file with database credentials:

```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=familybudget
POSTGRES_USER=familybudget
POSTGRES_PASSWORD=your_password_here
```

### 3. Verify Setup

```bash
# Check Locust version
locust --version

# Check dependencies
python3 -c "import asyncpg; print('asyncpg OK')"

# Test script permissions
ls -l run_load_tests.sh
```

---

## Test Scenarios

### Scenario 1: API Read-Heavy Load Test

**Purpose:** Test performance under heavy read load (analytics queries, list views)

**User Class:** `ReadOnlyAPIUser`

**Workload:**
- 15 tasks: Get facts list
- 10 tasks: Get analytics (waterfall, heatmap, category breakdown)
- 5 tasks: Get articles list

**Target Metrics:**
- Users: 50-100
- Response Time p95: < 500ms
- Success Rate: > 99.5%

**Command:**
```bash
./run_load_tests.sh api-read
```

---

### Scenario 2: API Mixed Workload

**Purpose:** Simulate realistic user behavior (reads + occasional writes)

**User Class:** `APIUser`

**Workload:**
- 10 tasks: Health check
- 8 tasks: Get facts list
- 5 tasks: Get articles list
- 3 tasks: Waterfall analytics
- 3 tasks: Heatmap analytics
- 2 tasks: Category breakdown
- 2 tasks: Get financial centers
- 2 tasks: Get cost centers
- 1 task: Create fact (write operation)

**Target Metrics:**
- Users: 50-100
- Response Time p95: < 500ms
- Write Success Rate: > 95%
- Read Success Rate: > 99%

**Command:**
```bash
./run_load_tests.sh api-mixed
```

---

### Scenario 3: API Write-Heavy Load Test

**Purpose:** Test write performance and database transaction handling

**User Class:** `WriteHeavyAPIUser`

**Workload:**
- 10 tasks: Create fact
- 3 tasks: Update fact
- 1 task: Delete fact

**Target Metrics:**
- Users: 30-50 (write operations are more resource-intensive)
- Response Time p95: < 1000ms
- Success Rate: > 95%
- Database integrity maintained

**Command:**
```bash
./run_load_tests.sh api-write
```

---

### Scenario 4: API Stress Test

**Purpose:** Determine system breaking point and maximum capacity

**User Class:** `APIUser`

**Configuration:**
- Users: 100
- Spawn Rate: 20 users/second
- Duration: 5 minutes
- Workload: Mixed read/write

**Target Metrics:**
- Response Time p95: < 1000ms (acceptable under stress)
- Success Rate: > 95%
- No system crashes
- Graceful degradation

**Command:**
```bash
./run_load_tests.sh api-stress
```

---

### Scenario 5: Database Load Test

**Purpose:** Test database performance independent of API layer

**Script:** `database_loadtest.py`

**Workload:**
- Sustained load: 100 queries/second for 5 minutes
- Query mix: 80% reads, 20% writes
- Connection pool: 50 connections
- Query types:
  - Fact list queries (paginated)
  - Analytics aggregations
  - Hierarchy queries

**Target Metrics:**
- Query Time p95: < 50ms
- Success Rate: > 99%
- Connection pool utilization: < 80%

**Command:**
```bash
./run_load_tests.sh database
```

---

### Scenario 6: Database Burst Test

**Purpose:** Test database response to sudden traffic spikes

**Script:** `database_loadtest.py`

**Workload:**
- Burst: 5,000 concurrent queries
- Query mix: 80% reads, 20% writes
- Connection pool: 100 connections

**Target Metrics:**
- Query Time p95: < 100ms
- Success Rate: > 95%
- No connection exhaustion
- Fast recovery after burst

**Command:**
```bash
./run_load_tests.sh database-burst
```

---

## Running Tests

### Basic Usage

```bash
# Navigate to load tests directory
cd backend/load_tests

# Run specific test
./run_load_tests.sh <test-name>

# Available tests:
# - api-read         (Read-heavy API test)
# - api-mixed        (Mixed workload)
# - api-write        (Write-heavy test)
# - api-stress       (Stress test)
# - database         (Database load test)
# - database-burst   (Database burst test)
# - all              (Run all tests sequentially)
# - interactive      (Locust web UI)
```

### Custom Parameters

```bash
# Override default settings
./run_load_tests.sh --users 100 --spawn-rate 20 --duration 600 api-mixed

# Using environment variables
LOAD_TEST_USERS=100 \
LOAD_TEST_SPAWN_RATE=20 \
LOAD_TEST_DURATION=600 \
./run_load_tests.sh api-mixed
```

### Interactive Mode (Recommended for initial testing)

```bash
# Start Locust web UI
./run_load_tests.sh interactive

# Open browser: http://localhost:8089
# Configure test parameters in web UI
# Start/stop tests dynamically
# Monitor real-time metrics
```

### Running All Tests

```bash
# Run complete test suite (takes ~30 minutes)
./run_load_tests.sh all

# Results saved to: backend/load_tests/results/
```

---

## Interpreting Results

### Locust Output Files

After each test, the following files are generated in `results/` directory:

1. **CSV Files:**
   - `*_stats.csv` - Request statistics
   - `*_failures.csv` - Failed requests log
   - `*_stats_history.csv` - Time-series data

2. **HTML Report:**
   - `*.html` - Interactive HTML report with charts

### Key Metrics

#### Response Time

**Good:**
- p50 (median): < 100ms
- p95: < 500ms
- p99: < 1000ms

**Warning:**
- p95: 500-1000ms
- p99: 1000-2000ms

**Critical:**
- p95: > 1000ms
- p99: > 2000ms

#### Requests Per Second (RPS)

**Target:** 100 RPS sustained
- **Good:** > 100 RPS with < 500ms p95
- **Acceptable:** 50-100 RPS with < 1000ms p95
- **Poor:** < 50 RPS or > 1000ms p95

#### Success Rate

**Good:** > 99%
**Acceptable:** 95-99%
**Critical:** < 95%

#### Example Output Analysis

```
=== LOCUST REPORT ===
Total Requests: 50,000
Success Rate: 99.8%
Failures: 100 (0.2%)

Response Times (ms):
  min: 5
  median: 45
  p95: 320
  p99: 650
  max: 1200

RPS: 166.67

✓ All metrics within acceptable range
```

---

## Performance Targets

### API Endpoints

| Endpoint | Expected Load | Target p95 | Critical p95 |
|----------|---------------|------------|--------------|
| `/health` | High | < 10ms | < 50ms |
| `/api/v1/facts` | High | < 100ms | < 500ms |
| `/api/v1/articles` | Medium | < 50ms | < 200ms |
| `/api/v1/analytics/waterfall` | Medium | < 150ms | < 500ms |
| `/api/v1/analytics/heatmap` | Medium | < 100ms | < 400ms |
| `/api/v1/facts` (POST) | Low | < 200ms | < 1000ms |

### Database Queries

| Query Type | Target p95 | Critical p95 |
|------------|------------|--------------|
| Simple SELECT | < 10ms | < 50ms |
| JOIN (2-3 tables) | < 50ms | < 200ms |
| Analytics aggregation | < 100ms | < 500ms |
| Hierarchy query | < 20ms | < 100ms |
| INSERT | < 50ms | < 200ms |

### System Resources

| Resource | Normal | Warning | Critical |
|----------|--------|---------|----------|
| CPU Usage | < 50% | 50-75% | > 75% |
| Memory Usage | < 60% | 60-80% | > 80% |
| Database Connections | < 50 | 50-80 | > 80 |
| Disk I/O Wait | < 10% | 10-20% | > 20% |

---

## Troubleshooting

### Issue 1: High Response Times

**Symptoms:**
- p95 response time > 1000ms
- Slow API endpoints

**Diagnosis:**
```bash
# Check database query performance
docker exec familybudget-postgres psql -U familybudget -d familybudget \
    -c "SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Check slow queries log
docker logs familybudget-backend | grep "slow query"
```

**Solutions:**
1. Run `VACUUM ANALYZE` on tables
2. Review EXPLAIN ANALYZE for slow queries
3. Add missing indexes
4. Increase connection pool size

---

### Issue 2: Connection Errors

**Symptoms:**
- Connection refused errors
- Connection timeout errors

**Diagnosis:**
```bash
# Check backend status
docker ps | grep backend

# Check backend logs
docker logs familybudget-backend --tail 100

# Check connection count
docker exec familybudget-postgres psql -U familybudget -d familybudget \
    -c "SELECT count(*) FROM pg_stat_activity;"
```

**Solutions:**
1. Increase `POSTGRES_MAX_CONNECTIONS` in `.env`
2. Reduce connection pool size in API
3. Implement PgBouncer for connection pooling
4. Add connection retry logic

---

### Issue 3: Failed Requests

**Symptoms:**
- Success rate < 95%
- 500 Internal Server Error responses

**Diagnosis:**
```bash
# Check backend error logs
docker logs familybudget-backend | grep ERROR

# Check database errors
docker logs familybudget-postgres | grep ERROR

# Review failures CSV
cat results/api_mixed_failures.csv
```

**Solutions:**
1. Fix application bugs causing errors
2. Add input validation
3. Improve error handling
4. Add request rate limiting

---

### Issue 4: Memory Leaks

**Symptoms:**
- Memory usage increasing over time
- OOM (Out of Memory) errors

**Diagnosis:**
```bash
# Monitor memory usage during test
docker stats familybudget-backend

# Check for connection leaks
docker exec familybudget-postgres psql -U familybudget -d familybudget \
    -c "SELECT client_addr, count(*) FROM pg_stat_activity GROUP BY client_addr;"
```

**Solutions:**
1. Ensure database connections are properly closed
2. Use context managers for sessions
3. Implement connection timeouts
4. Add memory profiling

---

## Best Practices

### 1. Start Small, Scale Up

```bash
# Start with 10 users
./run_load_tests.sh --users 10 --duration 60 api-mixed

# Gradually increase
./run_load_tests.sh --users 50 --duration 300 api-mixed
./run_load_tests.sh --users 100 --duration 600 api-mixed
```

### 2. Monitor System Resources

Use `docker stats` during tests:
```bash
docker stats familybudget-backend familybudget-postgres
```

### 3. Test Incrementally

1. Test individual endpoints first
2. Then test common workflows
3. Finally run full load tests

### 4. Use Realistic Data

- Use production-like test data
- Simulate real user behavior patterns
- Include edge cases

### 5. Test in Stages

1. **Development:** Local testing with small load
2. **Staging:** Full load tests with production-like data
3. **Production:** Gradual rollout with monitoring

---

## Next Steps

After completing load testing (EPIC-005):

1. **Analyze Results:** Review all test reports
2. **Optimize:** Address any performance bottlenecks
3. **Document:** Update architecture docs with findings
4. **Deploy:** Proceed with production deployment
5. **Monitor:** Set up production monitoring (Prometheus + Grafana)

---

## Additional Resources

**Locust Documentation:**
- Official Docs: https://docs.locust.io/
- Best Practices: https://docs.locust.io/en/stable/writing-a-locustfile.html

**PostgreSQL Performance:**
- pg_stat_statements: https://www.postgresql.org/docs/current/pgstatstatements.html
- Performance Tuning: https://wiki.postgresql.org/wiki/Performance_Optimization

**FastAPI Performance:**
- Async Best Practices: https://fastapi.tiangolo.com/async/
- Deployment: https://fastapi.tiangolo.com/deployment/

---

**Document Created:** 2025-10-14
**Author:** Claude Code Implementation System
**Tasks:** EPIC-005: TASK-016 through TASK-019
