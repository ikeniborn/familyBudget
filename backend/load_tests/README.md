# Load Testing Suite

Performance and load testing for Family Budget Application (EPIC-005).

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements_loadtest.txt

# 2. Configure environment (if not already done)
cp ../../.env .env

# 3. Verify setup
locust --version

# 4. Run interactive mode (recommended for first time)
./run_load_tests.sh interactive
# Open http://localhost:8089 in browser

# 5. Run automated test
./run_load_tests.sh api-mixed
```

## Test Scenarios

| Test | Command | Duration | Users | Purpose |
|------|---------|----------|-------|---------|
| **API Read-Heavy** | `./run_load_tests.sh api-read` | 5 min | 50 | Test read performance |
| **API Mixed** | `./run_load_tests.sh api-mixed` | 5 min | 50 | Realistic workload |
| **API Write-Heavy** | `./run_load_tests.sh api-write` | 5 min | 30 | Test write performance |
| **API Stress** | `./run_load_tests.sh api-stress` | 5 min | 100 | Find breaking point |
| **Database Load** | `./run_load_tests.sh database` | 5 min | N/A | Database performance |
| **Database Burst** | `./run_load_tests.sh database-burst` | <1 min | N/A | Handle traffic spikes |

## Files

- `locustfile.py` - Main Locust configuration with user classes
- `database_loadtest.py` - Direct database load testing
- `run_load_tests.sh` - Automated test runner script
- `requirements_loadtest.txt` - Python dependencies
- `results/` - Test results (CSV + HTML reports)

## Key Metrics

**Response Time Targets:**
- p95 < 500ms (normal load)
- p95 < 1000ms (stress load)

**Throughput Targets:**
- 100 req/sec sustained
- 99% success rate

**Database Targets:**
- Query p95 < 50ms
- 100 QPS sustained

## Custom Configuration

```bash
# Custom user count and duration
./run_load_tests.sh --users 100 --duration 600 api-mixed

# Use environment variables
LOAD_TEST_USERS=100 LOAD_TEST_DURATION=600 ./run_load_tests.sh api-read

# Custom host
./run_load_tests.sh --host http://production-server.com api-stress
```

## Results

After each test, results are saved to `results/` directory:

- `*_stats.csv` - Request statistics
- `*_failures.csv` - Failed requests
- `*_stats_history.csv` - Time-series data
- `*.html` - HTML report with charts

**View results:**
```bash
# Open HTML report
open results/api_mixed.html

# Analyze CSV data
python3 -c "import pandas as pd; print(pd.read_csv('results/api_mixed_stats.csv'))"
```

## Troubleshooting

**Issue: Locust not installed**
```bash
pip install -r requirements_loadtest.txt
```

**Issue: Connection refused**
```bash
# Check backend is running
docker ps | grep backend

# Check host configuration
./run_load_tests.sh --host http://localhost:8000 api-read
```

**Issue: High error rate**
```bash
# Check backend logs
docker logs familybudget-backend --tail 100

# Check database connections
docker exec familybudget-postgres psql -U familybudget -d familybudget \
    -c "SELECT count(*) FROM pg_stat_activity;"
```

## Documentation

See `docs/LOAD_TESTING_GUIDE.md` for comprehensive documentation.

## Tasks

- [x] TASK-016: Setup Load Testing Framework
- [ ] TASK-017: API Performance Testing
- [ ] TASK-018: Database Load Testing
- [ ] TASK-019: Telegram Bot Load Testing
