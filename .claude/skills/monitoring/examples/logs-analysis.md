# Logs Analysis Example

```bash
# Check backend errors
docker compose logs backend | grep -i error

# Monitor live
./logs.sh --follow backend

# Save diagnostics
./logs.sh --save
```

**Reference**: `scripts/logs.sh`
