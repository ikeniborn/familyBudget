import requests
import streamlit as st
import os
from typing import Optional, Dict, Any

API_URL = os.getenv("API_URL")


class AuthClient:
    """Client for handling JWT authentication with the API."""
    
    @staticmethod
    def login(username: str, password: str) -> Optional[str]:
        """
        Authenticate user and return JWT token.
        
        Args:
            username: User's username
            password: User's password
            
        Returns:
            JWT token if authentication successful, None otherwise
        """
        try:
            response = requests.post(
                f"{API_URL}/token",
                data={
                    "username": username,
                    "password": password,
                },
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("access_token")
                # Store token in session state
                st.session_state["jwt_token"] = token
                st.session_state["username"] = username
                return token
            else:
                return None
                
        except Exception as e:
            st.error(f"Authentication error: {str(e)}")
            return None
    
    @staticmethod
    def logout():
        """Clear authentication token from session."""
        if "jwt_token" in st.session_state:
            del st.session_state["jwt_token"]
        if "username" in st.session_state:
            del st.session_state["username"]
    
    @staticmethod
    def is_authenticated() -> bool:
        """Check if user is authenticated."""
        return "jwt_token" in st.session_state
    
    @staticmethod
    def get_headers() -> Dict[str, str]:
        """Get authorization headers for API requests."""
        if "jwt_token" in st.session_state:
            return {"Authorization": f"Bearer {st.session_state['jwt_token']}"}
        return {}
    
    @staticmethod
    def make_authenticated_request(method: str, url: str, **kwargs) -> requests.Response:
        """
        Make an authenticated request to the API.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            url: API endpoint URL
            **kwargs: Additional arguments for requests
            
        Returns:
            Response object
        """
        headers = kwargs.get("headers", {})
        headers.update(AuthClient.get_headers())
        kwargs["headers"] = headers
        
        response = requests.request(method, url, **kwargs)
        
        # If unauthorized, clear token and redirect to login
        if response.status_code == 401:
            AuthClient.logout()
            st.error("Session expired. Please login again.")
            st.stop()
            
        return response