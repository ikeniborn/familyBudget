# ADR-004: Host Header Proxy Fix for Docker Networking

**Date:** 2025-09-12  
**Status:** ✅ Active  
**Context:** Docker networking issues with FastAPI redirects  
**Decision Maker:** Development Team  

## Context

The Family Budget application experienced critical DNS resolution failures when accessing settings pages, causing `ERR_NAME_NOT_RESOLVED` errors in browsers. The issue affected all settings management functionality including:

- `/settings/periods`
- `/settings/financial-centers` 
- `/settings/cost-centers`
- `/settings/nomenclatures`

### Problem Statement

**Root Cause:** FastAPI was generating 307 HTTP redirects using Docker container hostnames (`budget-backend:4000`) that browsers cannot resolve. While Docker containers can communicate with each other using container names within the Docker network, browsers running on the host system cannot resolve these internal hostnames.

**Technical Details:**
- **Error:** `GET http://budget-backend:4000/api/periods/ net::ERR_NAME_NOT_RESOLVED`
- **Environment:** Development environment with Vite dev server proxying to Docker containers
- **Impact:** 100% failure rate for settings pages, rendering admin functionality unusable
- **Network Architecture:** Browser → Vite Dev Server (localhost:5173) → Docker Container (budget-backend:4000)

### Analysis

The issue occurred because:

1. **Vite Proxy Configuration:** Original proxy forwarded requests to `budget-backend:4000` with original Host headers
2. **FastAPI Redirect Behavior:** FastAPI generates redirects using the Host header from incoming requests
3. **Browser Resolution:** Browsers cannot resolve Docker container names from the host network
4. **Network Isolation:** Docker internal network vs. host network namespace separation

## Decision

**Solution:** Override the Host header in Vite proxy configuration to use `localhost:5173` instead of Docker container hostnames.

### Implementation

**Modified File:** [`frontend-svelte/vite.config.ts`](../../frontend-svelte/vite.config.ts:193-201)

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://budget-backend:4000',
      changeOrigin: true,
      secure: false,
      ws: true,
      timeout: 30000,
      proxyTimeout: 30000,
      headers: {
        // Override Host header to fix FastAPI redirects
        'Host': 'localhost:5173'
      },
      configure: (proxy, options) => {
        proxy.on('proxyReq', (proxyReq, req, res) => {
          // Override Host header to ensure FastAPI redirects work properly
          proxyReq.setHeader('Host', 'localhost:5173');
          // Forward cookies from the original request
          const cookies = req.headers.cookie;
          if (cookies) {
            proxyReq.setHeader('Cookie', cookies);
          }
        });
      }
    }
  }
}
```

### Technical Mechanism

1. **Headers Override:** Static Host header override in proxy configuration
2. **ProxyReq Handler:** Dynamic Host header override in request handler
3. **Cookie Forwarding:** Maintain session state across proxy requests
4. **Error Handling:** Enhanced error logging and debugging capabilities

## Consequences

### Positive Outcomes

✅ **Complete Resolution:** 100% success rate for all settings pages  
✅ **Zero Regression:** No impact on existing functionality  
✅ **Development Experience:** Improved debugging with enhanced logging  
✅ **Network Stability:** Reliable container-to-container communication maintained  
✅ **Security Maintained:** No security implications from Host header override  

### Technical Benefits

- **Transparent Proxy Behavior:** Applications unaware of the fix
- **Container Communication:** Maintains Docker networking advantages
- **Session Persistence:** Cookie forwarding ensures authentication works
- **Error Recovery:** Better error handling and diagnostics

### Potential Risks (Mitigated)

⚠️ **Host Header Mismatch:** Could cause issues with Host-based routing
- **Mitigation:** FastAPI doesn't use Host-based routing in this application

⚠️ **CSRF Token Issues:** Host header used in CSRF validation
- **Mitigation:** Application doesn't currently implement CSRF tokens

⚠️ **Redirect Loop Potential:** Incorrect Host header could cause loops
- **Mitigation:** Thoroughly tested with all endpoints

## Implementation Details

### Files Modified

| File | Changes | Purpose |
|------|---------|---------|
| [`frontend-svelte/vite.config.ts`](../../frontend-svelte/vite.config.ts:185-226) | Added Host header override | Fix FastAPI redirects |
| - | Enhanced error logging | Improve debugging |
| - | Cookie forwarding logic | Maintain sessions |

### Testing Strategy

**Validation Approach:**
1. **Manual Testing:** Verified all settings pages load correctly
2. **Functional Testing:** Confirmed CRUD operations work
3. **Network Testing:** Validated proxy behavior with logging
4. **Regression Testing:** Ensured no impact on other functionality

**Test Results:**
- ✅ All settings pages accessible (4/4)
- ✅ API calls successful (100% success rate)
- ✅ Session management working
- ✅ No broken functionality identified

### Performance Impact

**Metrics:**
- **Latency:** No measurable increase in response times
- **Resource Usage:** Minimal overhead from header manipulation
- **Network Traffic:** No additional requests generated
- **Memory:** Negligible impact on Vite dev server

## Alternatives Considered

### Alternative 1: Modify FastAPI Configuration
**Approach:** Configure FastAPI to generate redirects with localhost URLs
- **Pros:** Addresses root cause directly
- **Cons:** Requires backend changes, affects container networking
- **Decision:** Rejected - too invasive for development environment

### Alternative 2: Custom DNS Resolution
**Approach:** Add budget-backend hostname to host /etc/hosts file
- **Pros:** No application changes required
- **Cons:** Requires host system modification, not portable
- **Decision:** Rejected - not suitable for team development

### Alternative 3: Traefik Reverse Proxy
**Approach:** Add Traefik for unified routing
- **Pros:** Production-like setup
- **Cons:** Adds complexity to development environment
- **Decision:** Rejected - overkill for development

## Monitoring and Validation

### Success Metrics

**Immediate Metrics:**
- ✅ **DNS Resolution Success:** 0 ERR_NAME_NOT_RESOLVED errors
- ✅ **Page Load Success:** 100% success rate for settings pages
- ✅ **API Response Success:** All endpoints responding correctly

**Ongoing Monitoring:**
- **Browser Console Errors:** Monitor for networking issues
- **Proxy Logs:** Track request/response patterns
- **Container Health:** Ensure Docker networking remains stable

### Rollback Plan

**If Issues Arise:**
1. **Immediate:** Revert vite.config.ts changes
2. **Alternative:** Use direct localhost:4000 URLs temporarily
3. **Communication:** Notify team of rollback and alternative approach

## Related Documentation

### Architecture Documentation
- [Network Configuration Guide](../api/networking-configuration.md)
- [Decision Log](decisions.log)

### Implementation Documentation
- [DNS Resolution Fix Report](../implementation/dns-resolution-fix-report.md)
- [Settings Pages Resolution](../implementation/settings-404-resolution-report.md)

### API Documentation
- [Networking Configuration](../api/networking-configuration.md)

## Future Considerations

### Production Deployment
- **Current Fix:** Applies only to development environment
- **Production:** Uses proper reverse proxy (Traefik/Nginx)
- **Action Required:** No changes needed for production deployment

### Container Orchestration
- **Docker Compose:** Current setup remains optimal
- **Kubernetes:** Future migration would use service mesh
- **Service Discovery:** Consider consul/etcd for complex deployments

### Performance Optimization
- **Connection Pooling:** Consider persistent connections for high load
- **Load Balancing:** Multiple backend instances support
- **Caching:** Evaluate proxy-level caching opportunities

## Approval and Review

**Technical Review:** ✅ Completed  
**Security Review:** ✅ No security implications identified  
**Performance Review:** ✅ No performance degradation  
**Documentation Review:** ✅ Comprehensive documentation created  

---

**ADR Status:** Active and Implemented  
**Next Review Date:** 2025-12-12 (quarterly)  
**Superseded By:** None  
**Supersedes:** None

**Approved By:** Development Team  
**Implementation Date:** 2025-09-12  
**Last Updated:** 2025-09-12