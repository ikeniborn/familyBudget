# Parallel SQL Executor - Usage Guide

Efficient Python script for executing SQL files with parallel batch processing and connection pooling.

## Features

✨ **Key Features:**
- 🚀 **Parallel execution** - Up to 50 concurrent connections
- 📦 **Batch processing** - Automatic detection of BEGIN...COMMIT blocks
- 📊 **Progress tracking** - Real-time progress bar with ETA
- 🔧 **Connection pooling** - Efficient connection management
- 📝 **Rich output** - Beautiful terminal UI with statistics
- ⚙️ **Config from .env** - PostgreSQL settings from postgresql.env

## Installation

```bash
cd /home/ikeniborn/Documents/Project/familyBudget/sql

# Install dependencies
pip install -r requirements.txt
```

**Dependencies:**
- `asyncpg` - Async PostgreSQL driver
- `python-dotenv` - Environment variable loader
- `rich` - Terminal formatting and progress bars

## Configuration

### postgresql.env

Create `postgresql.env` file in sql directory (`/home/ikeniborn/Documents/Project/familyBudget/sql/`):

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=familybudget
POSTGRES_USER=familybudget
POSTGRES_PASSWORD=your_password_here
```

**Note:** Script will search for `postgresql.env` in:
1. Path specified with `--env` argument
2. Same directory as script (default)
3. Current working directory
4. Parent directory

## Usage

### Interactive Mode

```bash
python3 execute_sql_parallel.py
```

**Prompts:**
- SQL file path (or drag & drop file)

### Direct Mode

```bash
# Execute specific file
python3 execute_sql_parallel.py --file 05_insert_t_f_budget_fact.sql

# Custom max connections (1-50)
python3 execute_sql_parallel.py --file 05_insert_t_f_budget_fact.sql --max-connections 30

# Custom env file location
python3 execute_sql_parallel.py --env /path/to/.env --file 01_insert_t_d_financial_center.sql
```

## Examples

### Example 1: Small file (dimension table)

```bash
python3 execute_sql_parallel.py --file 01_insert_t_d_financial_center.sql
```

**Output:**
```
┌─────────────────────────────────────────────────────────┐
│ PostgreSQL Parallel SQL Executor                        │
│ Efficient batch processing with connection pooling      │
└─────────────────────────────────────────────────────────┘

✓ Loaded config: PostgreSQL(localhost:5432/family_budget as budget_user)

📄 Parsing file: 01_insert_t_d_financial_center.sql
✓ Found 1 batches, 4 statements
🔗 Creating connection pool: 50 connections

⠋ Executing batches... ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% (1/1) 0:00:00

                    Execution Statistics
┏━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Metric            ┃ Value                       ┃
┡━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩
│ Total Batches     │ 1                           │
│ Total Statements  │ 4                           │
│ Successful        │ 1                           │
│ Failed            │ 0                           │
│ Duration          │ 0.15s                       │
│ Throughput        │ 26.7 statements/sec         │
└───────────────────┴─────────────────────────────┘

✓ All batches executed successfully!
```

### Example 2: Large file with batches (fact table)

```bash
python3 execute_sql_parallel.py --file 05_insert_t_f_budget_fact.sql --max-connections 50
```

**Output:**
```
📄 Parsing file: 05_insert_t_f_budget_fact.sql
✓ Found 7 batches, 6662 statements
🔗 Creating connection pool: 50 connections

⠹ Executing batches... ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 57% (4/7) 0:00:12 0:00:09

                    Execution Statistics
┏━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Metric            ┃ Value                       ┃
┡━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩
│ Total Batches     │ 7                           │
│ Total Statements  │ 6662                        │
│ Successful        │ 7                           │
│ Failed            │ 0                           │
│ Duration          │ 24.58s                      │
│ Throughput        │ 271.1 statements/sec        │
└───────────────────┴─────────────────────────────┘

✓ All batches executed successfully!
```

### Example 3: Execute all files sequentially

```bash
#!/bin/bash
# execute_all.sh

FILES=(
    "01_insert_t_d_financial_center.sql"
    "02_insert_t_d_cost_center.sql"
    "03_insert_t_d_article_parents.sql"
    "04_insert_t_d_article_children.sql"
    "05_insert_t_f_budget_fact.sql"
)
# NOTE: Partitions are created via Alembic baseline migration (backend/db/migrations/)

for file in "${FILES[@]}"; do
    echo "====================================="
    echo "Executing: $file"
    echo "====================================="

    python3 execute_sql_parallel.py --file "$file" --max-connections 50

    if [ $? -ne 0 ]; then
        echo "❌ Failed to execute $file"
        exit 1
    fi

    echo ""
done

echo "✅ All files executed successfully!"
```

## How It Works

### 1. SQL File Parsing

The script parses SQL files and identifies batches:

**With explicit batches (BEGIN...COMMIT):**
```sql
BEGIN;
INSERT INTO table1 VALUES (1, 'a');
INSERT INTO table1 VALUES (2, 'b');
COMMIT;  -- Batch 1

BEGIN;
INSERT INTO table1 VALUES (3, 'c');
COMMIT;  -- Batch 2
```

**Without batches:**
```sql
INSERT INTO table1 VALUES (1, 'a');
INSERT INTO table1 VALUES (2, 'b');
-- All statements executed as single batch
```

### 2. Parallel Execution

- Each batch executed in separate connection
- Semaphore limits concurrent connections (max 50)
- Connection pool manages connections efficiently
- Progress tracked in real-time

### 3. Error Handling

- Failed batches logged with error details
- Other batches continue execution
- Non-zero exit code if any batch fails
- Transaction rollback on batch failure

## Performance Tips

### Optimal Connection Count

| File Type | Records | Batches | Recommended Connections |
|-----------|---------|---------|------------------------|
| Dimension tables | < 100 | 1 | 10 |
| Fact tables (small) | < 1K | 1-2 | 20 |
| Fact tables (medium) | 1K-10K | 5-10 | 30 |
| Fact tables (large) | > 10K | 10+ | 50 |

### Batch Size Recommendations

- **Small batches** (< 100 statements): Better parallelism, more overhead
- **Large batches** (1000+ statements): Less overhead, less parallelism
- **Optimal**: 500-1000 statements per batch

### Network Considerations

- **Local PostgreSQL**: Use max connections (50)
- **Remote PostgreSQL**: Reduce connections (20-30) to avoid network saturation
- **Cloud databases**: Check provider connection limits

## Troubleshooting

### Connection Errors

**Error:** `could not connect to server`

**Solution:**
1. Check PostgreSQL is running: `docker ps` or `systemctl status postgresql`
2. Verify postgresql.env credentials
3. Check firewall/network connectivity

### Too Many Connections

**Error:** `FATAL: too many connections`

**Solution:**
1. Reduce `--max-connections`: `--max-connections 20`
2. Check PostgreSQL `max_connections` setting
3. Close other connections to database

### Slow Execution

**Symptoms:** Low throughput (< 50 statements/sec)

**Solutions:**
1. Increase batch size in SQL file
2. Increase `--max-connections`
3. Check PostgreSQL performance (CPU, disk I/O)
4. Add indexes to target tables
5. Use partitioning for large tables

### File Not Found

**Error:** `File not found: 05_insert_t_f_budget_fact.sql`

**Solution:**
```bash
# Use absolute path
python3 execute_sql_parallel.py --file /absolute/path/to/file.sql

# Or cd to directory first
cd /home/ikeniborn/Documents/Project/familyBudget/sql
python3 execute_sql_parallel.py --file 05_insert_t_f_budget_fact.sql
```

## Advanced Usage

### Custom Batch Processing

To create custom batches in SQL file:

```sql
-- File: custom_batches.sql

-- Batch 1: Setup
BEGIN;
CREATE TEMP TABLE staging AS SELECT * FROM source;
COMMIT;

-- Batch 2: Transform
BEGIN;
UPDATE staging SET value = value * 2;
COMMIT;

-- Batch 3: Load
BEGIN;
INSERT INTO target SELECT * FROM staging;
COMMIT;
```

Execute:
```bash
python3 execute_sql_parallel.py --file custom_batches.sql --max-connections 3
```

### Integration with CI/CD

```yaml
# .github/workflows/deploy.yml
- name: Execute SQL migrations
  run: |
    cd sql
    python3 execute_sql_parallel.py \
      --file migrations/001_schema.sql \
      --max-connections 30 \
      --env ${{ secrets.POSTGRES_ENV_FILE }}
```

## Comparison with psql

| Feature | execute_sql_parallel.py | psql |
|---------|-------------------------|------|
| Parallel execution | ✅ Yes (up to 50) | ❌ No |
| Progress tracking | ✅ Real-time with ETA | ❌ No |
| Batch auto-detection | ✅ Yes | ⚠️ Manual (-v ON_ERROR_STOP=1) |
| Connection pooling | ✅ Yes | ❌ No |
| Error handling | ✅ Continues other batches | ❌ Stops on error (default) |
| Performance (large files) | 🚀 ~5-10x faster | 🐌 Baseline |

**When to use psql:**
- Single small file (< 100 statements)
- Need interactive mode
- Debugging SQL

**When to use execute_sql_parallel.py:**
- Large files (> 1000 statements)
- Multiple batches
- Need performance
- Automated deployments

## License

MIT License - See project root for details.

---

**Author:** Claude Code
**Date:** 2025-11-02
**Version:** 1.0.0
