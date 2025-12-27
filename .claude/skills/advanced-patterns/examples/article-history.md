# Article SCD Type 2 History Example

## Models

**Main Table** (SCD Type 1):
- `Article` - Current state only
- Stable PK for fact table FK references

**History Table** (SCD Type 2):
- `ArticleHistory` - Full version history
- Fields: `is_current`, `valid_from`, `valid_to`, `change_type`

## Usage

```python
# Create article → history record
article = Article(name="Food")
session.add(article)
await session.commit()

history = ArticleHistory(
    article_id=article.id,
    name=article.name,  # Copy ALL fields!
    valid_from=datetime.now(UTC),
    is_current=True,
    change_type="CREATE"
)
session.add(history)
```

**Reference**: `backend/app/models/article_history.py`
