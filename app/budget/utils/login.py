import streamlit as st
from .auth_client import AuthClient


def show_login_form():
    """Display login form and handle authentication."""
    st.title("🔐 Login")
    
    with st.form("login_form"):
        username = st.text_input("Username")
        password = st.text_input("Password", type="password")
        submitted = st.form_submit_button("Login")
        
        if submitted:
            if username and password:
                token = AuthClient.login(username, password)
                if token:
                    st.success("Login successful!")
                    st.experimental_rerun()
                else:
                    st.error("Invalid username or password")
            else:
                st.error("Please enter both username and password")


def require_authentication():
    """
    Decorator to require authentication for a page.
    
    Usage:
        @require_authentication()
        def my_page():
            st.write("This page requires authentication")
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            if not AuthClient.is_authenticated():
                show_login_form()
                st.stop()
            else:
                # Show logout button in sidebar
                with st.sidebar:
                    if st.button("🚪 Logout"):
                        AuthClient.logout()
                        st.experimental_rerun()
                    st.write(f"👤 Logged in as: {st.session_state.get('username', 'Unknown')}")
                    st.divider()
                
                # Run the actual page function
                return func(*args, **kwargs)
        return wrapper
    return decorator