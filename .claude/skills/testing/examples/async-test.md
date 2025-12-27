# AsyncSession Testing Example

```python
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

@pytest.mark.asyncio
async def test_create_article(async_session: AsyncSession):
    # Create
    article = Article(name="Test")
    async_session.add(article)
    await async_session.commit()  # MUST await!
    
    # Verify
    assert article.id is not None
```

**Reference**: `tests/unit/test_article_service.py`
