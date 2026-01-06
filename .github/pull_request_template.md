## Description
<!-- Describe your changes in detail -->

## Type of Change
<!-- Mark relevant items with [x] -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Refactoring (no functional changes, code restructuring)
- [ ] Documentation update
- [ ] Test improvements
- [ ] Performance optimization
- [ ] Build/CI changes

## Testing
<!-- Mark completed items with [x] -->

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated (if applicable)
- [ ] All tests passing locally (`npm test`)
- [ ] Code coverage maintained/improved

## Code Quality Checklist
<!-- Mark completed items with [x] -->

- [ ] TypeScript type check passes (`npm run type-check`)
- [ ] No TypeScript errors or warnings
- [ ] Coverage thresholds met (`npm run test:coverage`)
- [ ] No `console.log` in production code (use `debugLog()` or `logAPI`)
- [ ] Build succeeds (`npm run build`)
- [ ] Pre-commit hook passes

## Conventional Commits
<!-- Ensure PR title follows conventional commits format -->

PR title follows format: `<type>(<scope>): <description>`

Examples:
- `feat(lists): add autocomplete for product names`
- `fix(offline): prevent duplicate sync queue entries`
- `refactor(state): extract ListsState from monolithic file`
- `test(integration): add multi-tab coordination tests`
- `docs(architecture): update testing infrastructure guide`

## Related Issues
<!-- Link related issues using #issue_number -->

Closes #
Relates to #

## Screenshots/Videos
<!-- Add screenshots or screen recordings for UI changes -->

## Deployment Notes
<!-- Any special deployment considerations? -->

- [ ] Database migrations required
- [ ] Environment variables added/changed
- [ ] Configuration changes required
- [ ] No deployment considerations

## Reviewer Notes
<!-- Anything reviewers should pay special attention to? -->

---

<!-- Auto-populated by GitHub Actions -->
**CI/CD Status:**
- Type Check: ⏳
- Unit Tests: ⏳
- Build: ⏳
- Coverage: ⏳
