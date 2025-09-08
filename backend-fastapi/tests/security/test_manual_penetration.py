"""
Manual penetration testing script for Period data isolation.

This script performs direct API testing without fixtures to identify
real security vulnerabilities in the running system.
"""
import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Optional


class SecurityPenetrationTester:
    """Manual penetration testing for Period API security."""
    
    def __init__(self, base_url: str = "http://localhost:4000"):
        """Initialize tester with API base URL."""
        self.base_url = base_url
        self.session = requests.Session()
        self.test_results = []
        
    def log_test_result(self, test_name: str, status: str, details: str, severity: str = "INFO"):
        """Log test result with timestamp."""
        result = {
            "timestamp": datetime.now().isoformat(),
            "test_name": test_name,
            "status": status,
            "severity": severity,
            "details": details
        }
        self.test_results.append(result)
        print(f"[{severity}] {test_name}: {status} - {details}")
    
    def test_unauthenticated_access(self):
        """Test access to protected endpoints without authentication."""
        print("\\n=== Testing Unauthenticated Access ===")
        
        endpoints = [
            "/api/periods/",
            "/api/periods/1",
            "/api/admin/periods",
            "/api/admin/users"
        ]
        
        for endpoint in endpoints:
            try:
                response = self.session.get(f"{self.base_url}{endpoint}")
                
                if response.status_code == 401:
                    self.log_test_result(
                        f"Unauthenticated access to {endpoint}",
                        "SECURE",
                        f"Correctly returned 401 Unauthorized",
                        "PASS"
                    )
                elif response.status_code == 200:
                    self.log_test_result(
                        f"Unauthenticated access to {endpoint}",
                        "VULNERABLE",
                        f"Endpoint accessible without authentication! Response: {response.text[:200]}",
                        "CRITICAL"
                    )
                else:
                    self.log_test_result(
                        f"Unauthenticated access to {endpoint}",
                        "UNEXPECTED",
                        f"Unexpected status code: {response.status_code}",
                        "WARNING"
                    )
            except Exception as e:
                self.log_test_result(
                    f"Unauthenticated access to {endpoint}",
                    "ERROR",
                    f"Request failed: {str(e)}",
                    "ERROR"
                )
    
    def test_sql_injection_payloads(self):
        """Test SQL injection vulnerabilities in period endpoints."""
        print("\\n=== Testing SQL Injection ===")
        
        sql_payloads = [
            "1; DROP TABLE t_d_period; --",
            "1' OR '1'='1",
            "1 UNION SELECT * FROM t_d_user",
            "1'; INSERT INTO t_d_period VALUES (999,'HACKED'); --",
            "1 AND (SELECT COUNT(*) FROM t_d_user) > 0",
            "1' OR user_id IN (SELECT user_id FROM t_d_user) --"
        ]
        
        # Test with mock session cookie (simulate authenticated request)
        headers = {
            "Cookie": "connect.sid=test-session-id"
        }
        
        for payload in sql_payloads:
            try:
                # Test in GET parameter
                response = self.session.get(
                    f"{self.base_url}/api/periods/{payload}",
                    headers=headers
                )
                
                if response.status_code == 500:
                    self.log_test_result(
                        f"SQL Injection: {payload[:30]}...",
                        "POTENTIAL_VULNERABILITY",
                        f"Server error (500) - possible SQL injection. Response: {response.text[:100]}",
                        "HIGH"
                    )
                elif response.status_code in [400, 404, 422]:
                    self.log_test_result(
                        f"SQL Injection: {payload[:30]}...",
                        "HANDLED",
                        f"Payload properly handled with status {response.status_code}",
                        "PASS"
                    )
                elif "error" in response.text.lower() or "sql" in response.text.lower():
                    self.log_test_result(
                        f"SQL Injection: {payload[:30]}...",
                        "INFORMATION_DISCLOSURE",
                        f"Potential information disclosure in error message: {response.text[:200]}",
                        "MEDIUM"
                    )
                
            except Exception as e:
                self.log_test_result(
                    f"SQL Injection: {payload[:30]}...",
                    "ERROR",
                    f"Request failed: {str(e)}",
                    "WARNING"
                )
    
    def test_session_manipulation(self):
        """Test session manipulation and authentication bypass."""
        print("\\n=== Testing Session Manipulation ===")
        
        # Test various malicious session cookies
        malicious_sessions = [
            "connect.sid=admin-session",
            "connect.sid=s%3A123.456",  # URL encoded session
            "connect.sid=user_id=1&role=admin",
            "connect.sid=eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4ifQ==",  # Base64 encoded
        ]
        
        for session_cookie in malicious_sessions:
            headers = {"Cookie": session_cookie}
            
            try:
                # Test regular endpoint
                response = self.session.get(f"{self.base_url}/api/periods/", headers=headers)
                
                if response.status_code == 200:
                    self.log_test_result(
                        f"Session manipulation: {session_cookie[:30]}...",
                        "POTENTIAL_VULNERABILITY",
                        f"Session accepted! Response data available: {len(response.text)} chars",
                        "HIGH"
                    )
                elif response.status_code == 401:
                    self.log_test_result(
                        f"Session manipulation: {session_cookie[:30]}...",
                        "SECURE",
                        "Malicious session properly rejected",
                        "PASS"
                    )
                
                # Test admin endpoint
                admin_response = self.session.get(f"{self.base_url}/api/admin/periods", headers=headers)
                
                if admin_response.status_code == 200:
                    self.log_test_result(
                        f"Admin access with manipulated session",
                        "CRITICAL_VULNERABILITY",
                        f"ADMIN ACCESS GRANTED with malicious session: {session_cookie[:50]}",
                        "CRITICAL"
                    )
                
            except Exception as e:
                self.log_test_result(
                    f"Session manipulation: {session_cookie[:30]}...",
                    "ERROR",
                    f"Request failed: {str(e)}",
                    "WARNING"
                )
    
    def test_parameter_tampering(self):
        """Test parameter tampering in POST/PUT requests."""
        print("\\n=== Testing Parameter Tampering ===")
        
        # Mock valid session for testing
        headers = {
            "Content-Type": "application/json",
            "Cookie": "connect.sid=valid-session"
        }
        
        # Test user_id injection in period creation
        malicious_payloads = [
            {
                "period_year": 2024,
                "period_month": 6,
                "period_name": "Test Period",
                "user_id": 999  # Trying to inject different user_id
            },
            {
                "period_year": 2024,
                "period_month": 7,
                "period_name": "Admin Takeover",
                "user_id": 1,
                "role": "admin"  # Trying to inject admin role
            },
            {
                "period_year": 2024,
                "period_month": 8,
                "period_name": "'; DROP TABLE t_d_period; --",
                "user_id": "1 OR 1=1"
            }
        ]
        
        for payload in malicious_payloads:
            try:
                response = self.session.post(
                    f"{self.base_url}/api/periods/",
                    json=payload,
                    headers=headers
                )
                
                if response.status_code == 201:
                    response_data = response.json()
                    
                    # Check if malicious user_id was accepted
                    if response_data.get("user_id") != 1:  # Assuming current user should be 1
                        self.log_test_result(
                            "Parameter tampering - user_id injection",
                            "CRITICAL_VULNERABILITY",
                            f"user_id injection successful! Created with user_id: {response_data.get('user_id')}",
                            "CRITICAL"
                        )
                    else:
                        self.log_test_result(
                            "Parameter tampering - user_id injection",
                            "SECURE",
                            "user_id properly enforced from session",
                            "PASS"
                        )
                
            except Exception as e:
                self.log_test_result(
                    "Parameter tampering test",
                    "ERROR",
                    f"Request failed: {str(e)}",
                    "WARNING"
                )
    
    def test_directory_traversal(self):
        """Test directory traversal and path manipulation."""
        print("\\n=== Testing Directory Traversal ===")
        
        traversal_payloads = [
            "../../../etc/passwd",
            "..\\\\..\\\\..\\\\windows\\\\system32\\\\config\\\\sam",
            "../app/core/config.py",
            "../../../../../../root/.bashrc",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",  # URL encoded
        ]
        
        for payload in traversal_payloads:
            try:
                # Test in period_id parameter
                response = self.session.get(f"{self.base_url}/api/periods/{payload}")
                
                if "root:" in response.text or "password" in response.text.lower() or "config" in response.text:
                    self.log_test_result(
                        f"Directory traversal: {payload}",
                        "CRITICAL_VULNERABILITY",
                        f"File content exposed! Response: {response.text[:100]}",
                        "CRITICAL"
                    )
                elif response.status_code in [400, 404, 422]:
                    self.log_test_result(
                        f"Directory traversal: {payload}",
                        "SECURE",
                        "Traversal payload properly rejected",
                        "PASS"
                    )
                
            except Exception as e:
                self.log_test_result(
                    f"Directory traversal: {payload}",
                    "ERROR",
                    f"Request failed: {str(e)}",
                    "WARNING"
                )
    
    def test_rate_limiting(self):
        """Test rate limiting and DoS protection."""
        print("\\n=== Testing Rate Limiting ===")
        
        start_time = time.time()
        successful_requests = 0
        blocked_requests = 0
        
        # Send rapid requests
        for i in range(50):
            try:
                response = self.session.get(f"{self.base_url}/api/periods/")
                
                if response.status_code == 200:
                    successful_requests += 1
                elif response.status_code == 429:  # Too Many Requests
                    blocked_requests += 1
                
                time.sleep(0.01)  # Very short delay
                
            except Exception:
                pass
        
        end_time = time.time()
        duration = end_time - start_time
        rate = successful_requests / duration
        
        if rate > 100:  # More than 100 requests per second
            self.log_test_result(
                "Rate limiting test",
                "NO_RATE_LIMITING",
                f"High request rate allowed: {rate:.1f} req/sec. Potential DoS vulnerability.",
                "MEDIUM"
            )
        else:
            self.log_test_result(
                "Rate limiting test",
                "RATE_LIMITED",
                f"Request rate controlled: {rate:.1f} req/sec, {blocked_requests} blocked",
                "PASS"
            )
    
    def test_information_disclosure(self):
        """Test for information disclosure in error messages."""
        print("\\n=== Testing Information Disclosure ===")
        
        # Test malformed requests for verbose error messages
        test_requests = [
            ("GET", "/api/periods/abc"),
            ("POST", "/api/periods/", {"invalid": "data"}),
            ("PUT", "/api/periods/1", {"malformed": True}),
            ("DELETE", "/api/periods/nonexistent"),
        ]
        
        for method, endpoint, data in [(r[0], r[1], r[2] if len(r) > 2 else None) for r in test_requests]:
            try:
                if method == "GET":
                    response = self.session.get(f"{self.base_url}{endpoint}")
                elif method == "POST":
                    response = self.session.post(f"{self.base_url}{endpoint}", json=data)
                elif method == "PUT":
                    response = self.session.put(f"{self.base_url}{endpoint}", json=data)
                elif method == "DELETE":
                    response = self.session.delete(f"{self.base_url}{endpoint}")
                
                # Check for sensitive information in error messages
                sensitive_keywords = [
                    "traceback", "exception", "file path", "/app/", "sqlalchemy",
                    "database", "password", "secret", "token", "internal error"
                ]
                
                response_text = response.text.lower()
                
                for keyword in sensitive_keywords:
                    if keyword in response_text:
                        self.log_test_result(
                            f"Information disclosure in {method} {endpoint}",
                            "INFORMATION_LEAK",
                            f"Sensitive keyword '{keyword}' found in error response",
                            "MEDIUM"
                        )
                        break
                
            except Exception as e:
                self.log_test_result(
                    f"Information disclosure test {method} {endpoint}",
                    "ERROR",
                    f"Request failed: {str(e)}",
                    "WARNING"
                )
    
    def generate_report(self) -> str:
        """Generate comprehensive security report."""
        report = []
        report.append("="*80)
        report.append("FAMILY BUDGET SECURITY PENETRATION TEST REPORT")
        report.append("="*80)
        report.append(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append(f"Target: {self.base_url}")
        report.append(f"Total Tests: {len(self.test_results)}")
        report.append("")
        
        # Summary by severity
        severity_counts = {}
        for result in self.test_results:
            severity = result["severity"]
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
        
        report.append("SUMMARY BY SEVERITY:")
        for severity in ["CRITICAL", "HIGH", "MEDIUM", "WARNING", "PASS", "ERROR"]:
            count = severity_counts.get(severity, 0)
            report.append(f"  {severity}: {count}")
        
        report.append("")
        report.append("DETAILED FINDINGS:")
        report.append("-" * 50)
        
        # Group results by severity
        for severity in ["CRITICAL", "HIGH", "MEDIUM", "WARNING"]:
            critical_results = [r for r in self.test_results if r["severity"] == severity]
            
            if critical_results:
                report.append(f"\\n{severity} SEVERITY ISSUES:")
                for result in critical_results:
                    report.append(f"  • {result['test_name']}: {result['status']}")
                    report.append(f"    Details: {result['details']}")
                    report.append(f"    Time: {result['timestamp']}")
                    report.append("")
        
        # Successful tests
        pass_results = [r for r in self.test_results if r["severity"] == "PASS"]
        if pass_results:
            report.append(f"\\nSECURE IMPLEMENTATIONS ({len(pass_results)} tests passed):")
            for result in pass_results:
                report.append(f"  ✓ {result['test_name']}")
        
        return "\\n".join(report)
    
    def run_all_tests(self):
        """Run all penetration tests."""
        print("Starting Security Penetration Testing...")
        print(f"Target: {self.base_url}")
        
        self.test_unauthenticated_access()
        self.test_sql_injection_payloads()
        self.test_session_manipulation()
        self.test_parameter_tampering()
        self.test_directory_traversal()
        self.test_rate_limiting()
        self.test_information_disclosure()
        
        print("\\n" + "="*80)
        print("PENETRATION TESTING COMPLETE")
        print("="*80)
        
        return self.generate_report()


if __name__ == "__main__":
    # Run the penetration tests
    tester = SecurityPenetrationTester()
    report = tester.run_all_tests()
    
    # Save report to file
    with open("/app/security_penetration_report.txt", "w") as f:
        f.write(report)
    
    print("\\nReport saved to /app/security_penetration_report.txt")
    print("\\n" + report)