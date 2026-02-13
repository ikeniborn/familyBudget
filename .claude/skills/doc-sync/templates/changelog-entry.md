# Template for auto-generating changelog entries in docs/architecture/README.md
# Used by doc-sync to document architectural changes

# Variables:
# {date} - Date in YYYY-MM-DD format
# {commit_subject} - Git commit subject line
# {commit_body} - Git commit body (optional)
# {changed_files} - List of changed code files
# {updated_docs} - List of updated documentation files
# {api_endpoints} - List of affected API endpoints
# {database_tables} - List of affected database tables
# {frontend_modules} - List of affected frontend modules
# {significance} - Change significance (MINOR, MAJOR, BREAKING)

### {date}: {commit_subject} {significance_badge}

- **Change:** {commit_body}
- **Significance:** {significance}
- **Modified files:**
{changed_files_list}
- **Updated documentation:**
{updated_docs_list}
- **Components affected:**
{components_affected}

{migration_notes}

---

# Example output:

### 2026-02-09: Add article search endpoint ⭐ MAJOR

- **Change:** Implemented full-text search for articles with query parameter filtering
- **Significance:** MAJOR
- **Modified files:**
  - backend/app/api/v1/endpoints/articles.py
  - backend/app/services/article_service.py
  - backend/tests/api/test_articles_search.py
- **Updated documentation:**
  - docs/architecture/endpoints/articles.yaml
  - docs/architecture/functionality/budget-management.yaml
- **Components affected:**
  - API endpoints: GET /api/v1/articles/search
  - Frontend modules: articleManager, searchWidget
  - Services: ArticleService.search()

**Migration notes:**
- No breaking changes
- New optional query parameter 'q' for search
- Backward compatible with existing /articles endpoint

---

# Significance badges:
# - "🔧 MINOR" - Bug fixes, small improvements
# - "⭐ MAJOR" - New features, significant changes
# - "⚠️ BREAKING" - Breaking changes, requires migration
