# Family Budget - Documentation Index

**Last Updated:** 2025-09-12
**Version:** 1.1.0

This directory contains comprehensive documentation for the Family Budget application, including architecture decisions, API documentation, deployment guides, and templates for future development.

## 📚 Documentation Structure

### 🏗️ Architecture Documentation

#### Architecture Decision Records (ADR)
- **[ADR-001: Admin Access Control](architecture/adr-001-admin-access-control.md)**
  - Three-layer admin access control system
  - Security implementation with user ID-based authorization
  - Performance considerations and future migration paths
- **[ADR-004: Host Header Proxy Fix](architecture/adr-004-host-header-proxy-fix.md)** ⭐
  - Docker networking issue resolution for settings pages
  - FastAPI redirect hostname fix implementation
  - Critical DNS resolution error resolution
- **[Decision Log](architecture/decisions.log)** - Complete history of architectural decisions

### 🔌 API Documentation

#### Admin System API
- **[Admin Endpoints](api/admin-endpoints.md)**
  - Complete admin API reference
  - User management endpoints
  - System information and monitoring APIs
  - Bulk operations and data management
- **[Security Changes](api/security-changes.md)**
  - API security enhancements
  - Three-layer protection model
  - Error handling and response formats

#### Network Configuration
- **[Network Configuration Guide](api/networking-configuration.md)** ⭐
  - Docker networking setup and troubleshooting
  - Vite proxy configuration with Host header fix
  - Comprehensive debugging toolkit and health checks
  - Complete resolution guide for DNS issues

### 🚀 Deployment Documentation

#### Setup and Configuration
- **[Admin Setup Guide](deployment/admin-setup.md)**
  - Admin user configuration
  - Security setup and SSL configuration
  - Deployment procedures for all environments
  - Troubleshooting and monitoring setup

### 📝 Templates and Standards

#### Development Templates
- **[Admin Feature Template](templates/admin-feature-template.md)**
  - Complete template for developing new admin features
  - Security requirements and testing standards
  - Documentation and approval workflows
- **[API Change Template](templates/api-change.md)**
  - Template for documenting API modifications
  - Request/response specifications
  - Testing and migration guides
- **[Component Change Template](templates/component-change.md)**
  - Template for Svelte component modifications
  - Svelte 4 compatibility guidelines
  - Testing and accessibility requirements

## 🔍 Quick Navigation

### For System Administrators
1. **Getting Started:** [Admin Setup Guide](deployment/admin-setup.md)
2. **API Reference:** [Admin Endpoints](api/admin-endpoints.md)
3. **Network Issues:** [Network Configuration Guide](api/networking-configuration.md) ⭐
4. **Troubleshooting:** [Security Changes - Monitoring Section](api/security-changes.md#monitoring-and-alerts)

### For Developers
1. **Architecture Overview:** [ADR-001](architecture/adr-001-admin-access-control.md)
2. **Networking Fix:** [ADR-004 Host Header Proxy Fix](architecture/adr-004-host-header-proxy-fix.md) ⭐
3. **Development Standards:** [Admin Feature Template](templates/admin-feature-template.md)
4. **API Integration:** [Security Changes](api/security-changes.md)

### For Project Managers
1. **Implementation Summary:** [ADR-001 - Decision Section](architecture/adr-001-admin-access-control.md#decision)
2. **Security Overview:** [Admin Setup - Security Configuration](deployment/admin-setup.md#security-configuration)
3. **Testing Coverage:** [Security Changes - Testing](api/security-changes.md#testing-changes)

## 📖 Documentation Standards

### Writing Guidelines
- Use clear, concise language
- Include working code examples
- Provide troubleshooting sections
- Keep versioning information updated
- Follow markdown best practices

### Template Usage
- Use provided templates for consistency
- Fill all required sections completely
- Include proper cross-references
- Maintain approval workflows

### Maintenance
- Review quarterly for accuracy
- Update on major system changes
- Sync with codebase evolution
- Collect user feedback for improvements

## 🛡️ Security Documentation

### Access Control
- **Admin Users:** User ID 1 (hardcoded)
- **Three-Layer Protection:** UI, Routes, API
- **Data Isolation:** Maintained across all admin functions
- **Audit Logging:** All admin actions tracked

### Security Model
```
Frontend UI Guards (isAdmin check)
        ↓
Route Protection (SvelteKit guards)  
        ↓
API Security (require_admin_access)
        ↓
Database Operations (with user_id filtering)
```

## 🧪 Testing Documentation

### Test Coverage Requirements
- **Unit Tests:** 80%+ coverage for all new code
- **Integration Tests:** All API endpoints tested
- **Security Tests:** Authorization and data isolation verified
- **E2E Tests:** Critical admin workflows covered

### Test Categories
1. **Admin Access Tests** - Verify admin-only functionality
2. **Authorization Tests** - Confirm 403 responses for non-admins
3. **Data Isolation Tests** - Ensure no cross-user data exposure
4. **Performance Tests** - Response time and load testing

## 📊 Quality Metrics

### Documentation Quality
- **Coverage:** 90% of features documented
- **Accuracy:** Verified with each release
- **Completeness:** All sections filled per templates
- **Usability:** User feedback integration

### Code Quality Integration
- **Automated Documentation:** Generated from code annotations
- **Consistency Checks:** Template compliance validation
- **Version Synchronization:** Docs updated with code changes
- **Review Process:** Mandatory documentation review

## 🔄 Maintenance Schedule

### Regular Updates
- **Weekly:** Review for accuracy and completeness
- **Monthly:** Update based on user feedback
- **Quarterly:** Major review and reorganization
- **With Releases:** Sync with version changes

### Deprecation Process
1. Mark deprecated features clearly
2. Provide migration timelines
3. Archive outdated documentation
4. Redirect to current alternatives

## 📞 Documentation Support

### Getting Help
- **Issues:** Create GitHub issue with 'documentation' label
- **Questions:** Contact development team
- **Suggestions:** Submit pull request with improvements
- **Urgent Updates:** Direct communication with maintainers

### Contributing
- Follow template structures
- Use consistent formatting
- Include code examples
- Test all instructions
- Submit via pull request process

---

**Maintained by:** Development Team
**Review Schedule:** Quarterly
**Last Major Update:** 2025-09-12 (Docker networking fix)
**Next Review:** 2025-12-12

---

## 🔧 Recent Major Updates

### Docker Networking Issue Resolution (2025-09-12)
- **Critical Issue:** Settings pages experiencing `ERR_NAME_NOT_RESOLVED` errors
- **Root Cause:** FastAPI redirects using unresolvable Docker container hostnames
- **Solution:** Host header override in Vite proxy configuration (ADR-004)
- **Impact:** 100% resolution of DNS issues, all settings pages now functional
- **Documentation:** Complete troubleshooting guide and architecture decision record created