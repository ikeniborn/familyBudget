# API Change Documentation Template

**API Endpoint:** [METHOD /api/path/endpoint]  
**Date:** [YYYY-MM-DD]  
**Developer:** [Developer Name]  
**Change Type:** [New Endpoint/Modification/Deprecation/Breaking Change]  
**Version:** [API Version]

## Change Summary

### What Changed
[Brief description of the API change]

### Why Changed
[Business justification, bug fix, security improvement, etc.]

### Impact Level
- [ ] **Low** - Backward compatible, optional features
- [ ] **Medium** - New features, non-breaking changes
- [ ] **High** - Breaking changes, security updates

## Endpoint Details

### Endpoint Information
```
Method: [GET/POST/PUT/DELETE/PATCH]
Path: /api/v1/[endpoint-path]
Authentication: [Required/Optional/Admin Only]
Rate Limit: [X requests/minute]
```

### Security Requirements
- [ ] Authentication required: `Depends(get_current_user)`
- [ ] Admin access required: `Depends(require_admin_access)`
- [ ] User data isolation enforced
- [ ] Input validation implemented
- [ ] SQL injection prevention verified

## Request/Response Specification

### Request Parameters

#### Path Parameters
```typescript
{
  "param1": {
    "type": "integer",
    "required": true,
    "description": "User ID",
    "example": 123
  }
}
```

#### Query Parameters
```typescript
{
  "limit": {
    "type": "integer",
    "required": false,
    "default": 10,
    "description": "Number of items to return",
    "example": 25
  },
  "offset": {
    "type": "integer", 
    "required": false,
    "default": 0,
    "description": "Number of items to skip",
    "example": 50
  }
}
```

#### Request Body
```json
{
  "field1": "string (required)",
  "field2": 123,
  "field3": {
    "nested_field": "optional string"
  },
  "field4": ["array", "of", "strings"]
}
```

### Response Format

#### Success Response (200/201)
```json
{
  "success": true,
  "data": {
    "id": 123,
    "field1": "response value",
    "field2": 456,
    "created_at": "2024-09-08T14:30:00Z",
    "updated_at": "2024-09-08T14:30:00Z"
  },
  "total": 100,
  "page": 1,
  "limit": 10
}
```

#### Error Responses

**400 Bad Request**
```json
{
  "success": false,
  "error": "Invalid input data",
  "details": {
    "field1": ["This field is required"],
    "field2": ["Must be a positive integer"]
  }
}
```

**401 Unauthorized**
```json
{
  "detail": "Not authenticated"
}
```

**403 Forbidden (Admin endpoints only)**
```json
{
  "detail": "Admin access required"
}
```

**404 Not Found**
```json
{
  "success": false,
  "error": "Resource not found"
}
```

**422 Validation Error**
```json
{
  "detail": [
    {
      "loc": ["body", "field1"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Implementation

### Backend Implementation

#### Route Definition
```python
# app/api/v1/endpoints/[module].py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.security import get_current_user, require_admin_access
from app.db.database import get_db
from app.schemas.[module] import [Schema]Request, [Schema]Response
from app.models.[module] import [Model]

router = APIRouter()

@router.[method]("/[endpoint-path]")
async def [function_name](
    # Path parameters
    param1: int,
    
    # Query parameters  
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    
    # Request body (for POST/PUT)
    request_data: [Schema]Request = None,
    
    # Dependencies
    current_user = Depends(get_current_user),  # or require_admin_access
    db: Session = Depends(get_db)
) -> [Schema]Response:
    """
    [Endpoint description]
    
    Args:
        param1: [Parameter description]
        limit: Number of items to return
        offset: Number of items to skip
        request_data: Request payload
        current_user: Authenticated user
        db: Database session
    
    Returns:
        [Schema]Response: [Response description]
    
    Raises:
        HTTPException: 400 if invalid input
        HTTPException: 403 if not authorized (admin endpoints)
        HTTPException: 404 if resource not found
        HTTPException: 500 if server error
    """
    try:
        # Input validation
        if request_data and not request_data.field1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="field1 is required"
            )
        
        # Business logic
        # Ensure data isolation for non-admin endpoints
        query = db.query([Model]).filter([Model].user_id == current_user.id)
        
        # Execute query with pagination
        total = query.count()
        items = query.offset(offset).limit(limit).all()
        
        # Return response
        return {
            "success": True,
            "data": items,
            "total": total,
            "page": (offset // limit) + 1,
            "limit": limit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in [function_name]: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )
```

#### Schema Definitions
```python
# app/schemas/[module].py
from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime

class [Schema]Request(BaseModel):
    field1: str = Field(..., min_length=1, max_length=100)
    field2: Optional[int] = Field(None, ge=0)
    field3: Optional[List[str]] = None
    
    @validator('field1')
    def validate_field1(cls, v):
        if not v.strip():
            raise ValueError('field1 cannot be empty')
        return v.strip()
    
    class Config:
        schema_extra = {
            "example": {
                "field1": "example value",
                "field2": 123,
                "field3": ["item1", "item2"]
            }
        }

class [Schema]Response(BaseModel):
    id: int
    field1: str
    field2: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "id": 123,
                "field1": "response value", 
                "field2": 456,
                "created_at": "2024-09-08T14:30:00Z",
                "updated_at": "2024-09-08T14:30:00Z"
            }
        }
```

#### Database Model Updates (if needed)
```python
# app/models/[module].py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base_class import Base

class [Model](Base):
    __tablename__ = "[table_name]"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("t_d_user.id"), nullable=False, index=True)
    field1 = Column(String(100), nullable=False)
    field2 = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Ensure data isolation
    __table_args__ = (
        {"comment": "User-specific data with proper isolation"}
    )
```

### Frontend Integration

#### Service Implementation
```typescript
// src/lib/services/[module]Service.ts
import { apiClient } from './apiClient';
import type { [Type]Request, [Type]Response } from '$lib/types';

export class [Module]Service {
  private basePath = '/[module]';

  async create[Entity](data: [Type]Request): Promise<[Type]Response> {
    try {
      const response = await apiClient.post(`${this.basePath}/`, data);
      return response.data.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async get[Entity](id: number): Promise<[Type]Response> {
    try {
      const response = await apiClient.get(`${this.basePath}/${id}`);
      return response.data.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async list[Entities](params?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{
    data: [Type]Response[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const response = await apiClient.get(`${this.basePath}/`, { params });
      return response.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async update[Entity](id: number, data: Partial<[Type]Request>): Promise<[Type]Response> {
    try {
      const response = await apiClient.put(`${this.basePath}/${id}`, data);
      return response.data.data;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async delete[Entity](id: number): Promise<void> {
    try {
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private handleError(error: any): void {
    if (error.response?.status === 403) {
      throw new Error('Admin access required');
    } else if (error.response?.status === 404) {
      throw new Error('Resource not found');
    } else if (error.response?.status === 422) {
      const details = error.response.data.detail;
      const messages = details.map((d: any) => d.msg).join(', ');
      throw new Error(`Validation error: ${messages}`);
    }
    // Let other errors bubble up
  }
}

export const [module]Service = new [Module]Service();
```

#### Type Definitions
```typescript
// src/lib/types/[module].ts
export interface [Type]Request {
  field1: string;
  field2?: number;
  field3?: string[];
}

export interface [Type]Response {
  id: number;
  field1: string;
  field2: number | null;
  created_at: string;
  updated_at: string;
}

export interface [Type]ListResponse {
  data: [Type]Response[];
  total: number;
  page: number;
  limit: number;
}
```

## Testing Strategy

### Unit Tests

#### Backend Tests
```python
# tests/test_[module]_api.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

class Test[Module]API:
    def test_create_[entity]_success(self, user_client):
        """Test successful [entity] creation"""
        data = {
            "field1": "test value",
            "field2": 123
        }
        response = user_client.post("/api/v1/[endpoint]/", json=data)
        
        assert response.status_code == 201
        json_data = response.json()
        assert json_data["success"] is True
        assert json_data["data"]["field1"] == "test value"

    def test_create_[entity]_validation_error(self, user_client):
        """Test validation error on invalid input"""
        data = {
            "field2": 123
            # field1 missing (required)
        }
        response = user_client.post("/api/v1/[endpoint]/", json=data)
        
        assert response.status_code == 422
        detail = response.json()["detail"]
        assert any(error["loc"] == ["body", "field1"] for error in detail)

    def test_get_[entity]_not_found(self, user_client):
        """Test 404 for non-existent [entity]"""
        response = user_client.get("/api/v1/[endpoint]/99999")
        
        assert response.status_code == 404
        assert "not found" in response.json()["error"].lower()

    def test_admin_only_endpoint_requires_admin(self, user_client, admin_client):
        """Test admin-only endpoint access control"""
        # Regular user should get 403
        response = user_client.get("/api/v1/admin/[endpoint]/")
        assert response.status_code == 403
        
        # Admin user should succeed
        response = admin_client.get("/api/v1/admin/[endpoint]/")
        assert response.status_code == 200

    def test_data_isolation(self, user_client, user2_client, db_session):
        """Test that users can only access their own data"""
        # User 1 creates data
        data = {"field1": "user1 data"}
        response = user_client.post("/api/v1/[endpoint]/", json=data)
        entity_id = response.json()["data"]["id"]
        
        # User 2 should not be able to access user 1's data
        response = user2_client.get(f"/api/v1/[endpoint]/{entity_id}")
        assert response.status_code == 404
```

#### Frontend Tests
```typescript
// tests/[module]Service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { [module]Service } from '../src/lib/services/[module]Service';
import * as apiClient from '../src/lib/services/apiClient';

vi.mock('../src/lib/services/apiClient');

describe('[Module]Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create [entity] successfully', async () => {
    const mockData = { field1: 'test', field2: 123 };
    const mockResponse = { data: { data: { id: 1, ...mockData } } };
    
    vi.mocked(apiClient.apiClient.post).mockResolvedValue(mockResponse);
    
    const result = await [module]Service.create[Entity](mockData);
    
    expect(apiClient.apiClient.post).toHaveBeenCalledWith('/[module]/', mockData);
    expect(result).toEqual({ id: 1, ...mockData });
  });

  it('should handle 403 errors gracefully', async () => {
    const mockError = {
      response: { status: 403, data: { detail: 'Admin access required' } }
    };
    
    vi.mocked(apiClient.apiClient.get).mockRejectedValue(mockError);
    
    await expect([module]Service.get[Entity](1)).rejects.toThrow('Admin access required');
  });

  it('should handle validation errors', async () => {
    const mockError = {
      response: { 
        status: 422, 
        data: { 
          detail: [
            { loc: ['body', 'field1'], msg: 'field required' }
          ] 
        } 
      }
    };
    
    vi.mocked(apiClient.apiClient.post).mockRejectedValue(mockError);
    
    await expect([module]Service.create[Entity]({})).rejects.toThrow('Validation error: field required');
  });
});
```

### Integration Tests
```python
# tests/integration/test_[module]_workflow.py
def test_complete_[module]_workflow(user_client, db_session):
    """Test complete CRUD workflow for [module]"""
    # 1. Create
    create_data = {"field1": "integration test", "field2": 100}
    create_response = user_client.post("/api/v1/[endpoint]/", json=create_data)
    assert create_response.status_code == 201
    entity_id = create_response.json()["data"]["id"]
    
    # 2. Read
    get_response = user_client.get(f"/api/v1/[endpoint]/{entity_id}")
    assert get_response.status_code == 200
    assert get_response.json()["data"]["field1"] == "integration test"
    
    # 3. Update
    update_data = {"field1": "updated value"}
    update_response = user_client.put(f"/api/v1/[endpoint]/{entity_id}", json=update_data)
    assert update_response.status_code == 200
    assert update_response.json()["data"]["field1"] == "updated value"
    
    # 4. Delete
    delete_response = user_client.delete(f"/api/v1/[endpoint]/{entity_id}")
    assert delete_response.status_code == 204
    
    # 5. Verify deletion
    get_deleted = user_client.get(f"/api/v1/[endpoint]/{entity_id}")
    assert get_deleted.status_code == 404
```

### Performance Tests
```python
# tests/performance/test_[module]_performance.py
import time
import pytest

def test_[endpoint]_response_time(user_client):
    """Test that [endpoint] responds within acceptable time"""
    start_time = time.time()
    response = user_client.get("/api/v1/[endpoint]/")
    end_time = time.time()
    
    assert response.status_code == 200
    assert (end_time - start_time) < 2.0  # 2 second limit

def test_[endpoint]_bulk_performance(user_client, db_session):
    """Test performance with large datasets"""
    # Create test data
    # ... create 1000+ records ...
    
    start_time = time.time()
    response = user_client.get("/api/v1/[endpoint]/?limit=100")
    end_time = time.time()
    
    assert response.status_code == 200
    assert (end_time - start_time) < 5.0  # 5 second limit for large datasets
```

## Migration Guide

### Breaking Changes
[List any breaking changes and how to migrate]

#### Before (v1.0)
```json
{
  "old_field_name": "value",
  "deprecated_field": 123
}
```

#### After (v1.1)
```json
{
  "new_field_name": "value",
  "enhanced_field": {
    "value": 123,
    "metadata": "additional info"
  }
}
```

### Client Migration Steps
1. Update API client to handle new response format
2. Update error handling for new status codes
3. Test with new validation rules
4. Update UI to display new fields

## Documentation Updates

### OpenAPI/Swagger
- [ ] OpenAPI specification updated
- [ ] Request/response examples added
- [ ] Error responses documented
- [ ] Rate limiting information included

### API Documentation
- [ ] Endpoint added to API docs
- [ ] Usage examples provided
- [ ] Integration guide updated
- [ ] Troubleshooting section added

## Security Considerations

### Data Protection
- [ ] Input sanitization implemented
- [ ] SQL injection prevention verified
- [ ] XSS prevention implemented
- [ ] CSRF protection enabled

### Access Control
- [ ] Authentication requirements documented
- [ ] Authorization logic implemented
- [ ] Data isolation enforced
- [ ] Admin access properly protected

### Audit Logging
```python
# Log format for admin actions
{
  "timestamp": "2024-09-08T14:30:00Z",
  "user_id": 1,
  "endpoint": "/api/v1/admin/[endpoint]/",
  "method": "POST",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0...",
  "request_data": {"field1": "value"},
  "response_code": 201,
  "duration_ms": 45
}
```

## Monitoring and Alerts

### Metrics to Track
- [ ] Request count by endpoint
- [ ] Response time percentiles
- [ ] Error rate by status code
- [ ] Admin access frequency
- [ ] Data volume processed

### Alert Configuration
```yaml
# monitoring/alerts/[module]-api-alerts.yml
- alert: [Module]APIHighErrorRate
  expr: rate([module]_api_errors_total[5m]) > 0.01
  for: 2m
  annotations:
    summary: High error rate for [module] API

- alert: [Module]APISlowResponse
  expr: histogram_quantile(0.95, [module]_api_duration_seconds) > 2
  for: 1m
  annotations:
    summary: Slow response time for [module] API
```

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Database migrations prepared
- [ ] Documentation updated
- [ ] Security review completed
- [ ] Performance benchmarks met

### Deployment Steps
1. [ ] Deploy database migrations
2. [ ] Deploy backend changes
3. [ ] Deploy frontend changes
4. [ ] Update load balancer configuration
5. [ ] Verify endpoint functionality

### Post-Deployment
- [ ] Endpoint responding correctly
- [ ] Monitoring metrics showing expected values
- [ ] No error spikes in logs
- [ ] Client integrations working
- [ ] Documentation accessible

## Rollback Plan

### Rollback Triggers
- [ ] Error rate > 5%
- [ ] Response time > 5 seconds
- [ ] Data integrity issues
- [ ] Security vulnerabilities discovered

### Rollback Steps
1. [ ] Revert API changes
2. [ ] Rollback database migrations (if safe)
3. [ ] Update client applications
4. [ ] Verify system stability

## Changelog

### Version History
**v1.1.0 (2024-09-08)**
- Added new [endpoint] functionality
- Enhanced validation logic
- Improved error handling
- Added admin access controls

**v1.0.0 (2024-09-01)**
- Initial API implementation

## References

### Internal Documentation
- [API Standards](/docs/api/standards.md)
- [Security Guidelines](/docs/api/security-guidelines.md)
- [Testing Standards](/docs/quality/testing-standards.md)

### External Resources
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Pydantic Documentation](https://pydantic-docs.helpmanual.io/)
- [HTTP Status Codes](https://httpstatuses.com/)
- [REST API Best Practices](https://restfulapi.net/)

## Approval

### Sign-off Required
- [ ] API Developer: [Name] - [Date]
- [ ] Security Reviewer: [Name] - [Date]
- [ ] QA Engineer: [Name] - [Date]
- [ ] Product Owner: [Name] - [Date]

---

**Template Version:** 1.0.0  
**Last Updated:** 2024-09-08  
**Maintained by:** Backend Team