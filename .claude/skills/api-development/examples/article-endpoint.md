# Article Endpoint Example

Real implementation from `backend/app/api/v1/endpoints/articles.py`.

## Key Features

1. **Shared References Architecture** - All users see all articles
2. **Hierarchical Structure** - parent_id + Closure Table
3. **SCD Type 1** - In-place updates (main table)
4. **History Tracking** - SCD Type 2 (history table)
5. **Caching** - Redis cache invalidation

## Endpoint Patterns

### CREATE (POST /articles)
```python
@router.post("", response_model=ArticleResponse, status_code=201)
async def create_article(
    article_data: ArticleCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> Article:
    # Validate parent exists
    if article_data.parent_id:
        parent_stmt = select(Article).where(Article.id == article_data.parent_id)
        parent = (await session.execute(parent_stmt)).scalar_one_or_none()
        if not parent:
            raise HTTPException(404, f"Parent article not found")

    # Create article
    article = Article(**article_data.model_dump(), user_id=get_user_id_for_create(current_user))
    session.add(article)
    await session.commit()
    await session.refresh(article)

    # Create history
    await create_initial_history(session, article, "CREATE")

    # Invalidate cache
    await cache_service.invalidate_articles()

    return article
```

### LIST (GET /articles)
```python
@router.get("", response_model=ArticleListResponse)
async def list_articles(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    type_filter: str | None = Query(None, alias="type"),
    include_inactive: bool = Query(False),
) -> ArticleListResponse:
    # ✅ CORRECT - Shared Budget: NO user_id filtering
    stmt = select(Article)

    # Filter by type
    if type_filter:
        stmt = stmt.where(Article.type == type_filter)

    # Filter inactive
    if not include_inactive:
        stmt = stmt.where(Article.is_active == True)

    # Count + Pagination
    count_stmt = select(func.count()).select_from(Article)
    total = (await session.execute(count_stmt)).scalar()

    stmt = stmt.limit(limit).offset(offset)
    articles = (await session.execute(stmt)).scalars().all()

    return ArticleListResponse(items=articles, total=total, limit=limit, offset=offset)
```

### UPDATE (PUT /articles/{id})
```python
@router.put("/{id}", response_model=ArticleResponse)
async def update_article(
    id: int,
    article_data: ArticleUpdate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> Article:
    # Admin check (optional for shared references)
    # if not current_user.is_admin:
    #     raise HTTPException(403, "Only admins can update articles")

    # Get existing article
    stmt = select(Article).where(Article.id == id)
    article = (await session.execute(stmt)).scalar_one_or_none()
    if not article:
        raise HTTPException(404, f"Article {id} not found")

    # Update (SCD Type 1 - in-place)
    update_data = article_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(article, key, value)

    await session.commit()
    await session.refresh(article)

    # Create history
    await update_article_profile(session, article, "UPDATE")

    # Invalidate cache
    await cache_service.invalidate_articles()

    return article
```

### DELETE (DELETE /articles/{id})
```python
@router.delete("/{id}", status_code=204)
async def delete_article(
    id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> None:
    # Get article
    stmt = select(Article).where(Article.id == id)
    article = (await session.execute(stmt)).scalar_one_or_none()
    if not article:
        raise HTTPException(404, f"Article {id} not found")

    # ✅ CRITICAL - Add await!
    await session.delete(article)
    await session.commit()

    # Create history
    await update_article_profile(session, article, "DELETE")

    # Invalidate cache
    await cache_service.invalidate_articles()
```

## Key Takeaways

1. **NO user_id filtering** - Shared Budget model
2. **Admin checks optional** - Shared references allow all users
3. **Always await async methods** - Prevent RuntimeWarning
4. **History tracking** - Create/Update/Delete all tracked
5. **Cache invalidation** - Clear cache after changes
6. **Validation** - Check parent exists, FK constraints
