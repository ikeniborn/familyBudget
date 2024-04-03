import os
from numpy import void
import streamlit as st
import google.oauth2.credentials
import google_auth_oauthlib.flow
import flask
# import googleapiclient.discovery

from dotenv import load_dotenv

load_dotenv(".env")

CLIENT_SECRETS_FILE = "/usr/src/app/secrets/client_secret.json"
SCOPES = ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"]
REDIRECT_URL = "https://localhost:8501"


def google_auth():
    if "auth" not in st.session_state:
        flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(
            CLIENT_SECRETS_FILE, scopes=SCOPES,redirect_uri = REDIRECT_URL
        )
        
        authorization_url, state = flow.authorization_url(
            # Recommended, enable offline access so that you can refresh an access token without
            # re-prompting the user for permission. Recommended for web server apps.
            access_type="offline",
            # Optional, enable incremental authorization. Recommended as a best practice.
            include_granted_scopes="true",
            # Recommended, state value can increase your assurance that an incoming connection is the result
            # of an authentication request.
            state=st.session_state.state,
            # Optional, if your application knows which user is trying to authenticate, it can use this
            # parameter to provide a hint to the Google Authentication Server.
            login_hint=st.session_state.email,
            # Optional, set prompt to 'consent' will prompt the user for consent
            prompt="consent",
            code_challenge_method="S256",
        )
        auth_code = st.query_params.get("code")
        # auth_state = st.query_params.get("state")
        # st.write('auth_code',auth_code)
        st.write('auth_code',auth_code)
        st.write('auth_state',state)
        st.write(authorization_url)
        return authorization_url
        # flow.redirect_uri = flask.url_for('', _external=True)
        # authorization_response = flask.request.url
        # flow.fetch_token(authorization_response=authorization_response)
        # credentials = flow.credentials
        # if "credentials" not in st.session_state:
        #   if "token" not in st.session_state.credentials:
        #     st.session_state.credentials.token = credentials.token
        #   if "refresh_token" not in st.session_state.credentials:
        #     st.session_state.credentials.refresh_token = credentials.refresh_token
        #   if "token_uri" not in st.session_state.credentials:
        #     st.session_state.credentials.token_uri = credentials.token_uri
        #   if "client_id" not in st.session_state.credentials:
        #     st.session_state.credentials.client_id = credentials.client_id
        #   if "client_secret" not in st.session_state.credentials:
        #     st.session_state.credentials.client_secret = credentials.client_secret
        #   if "scopes" not in st.session_state.credentials:
        #     st.session_state.credentials.scopes = credentials.scopes
        
        # st.rerun()
        

    # authorization_url, state = flow.authorization_url(
    #     # Recommended, enable offline access so that you can refresh an access token without
    #     # re-prompting the user for permission. Recommended for web server apps.
    #     access_type='offline',
    #     # Optional, enable incremental authorization. Recommended as a best practice.
    #     include_granted_scopes='true',
    #     # Recommended, state value can increase your assurance that an incoming connection is the result
    #     # of an authentication request.
    #     state=sample_passthrough_value,
    #     # Optional, if your application knows which user is trying to authenticate, it can use this
    #     # parameter to provide a hint to the Google Authentication Server.
    #     login_hint='hint@example.com',
    #     # Optional, set prompt to 'consent' will prompt the user for consent
    #     prompt='consent')

    # async def get_authorization_url(client: GoogleOAuth2, redirect_uri: str):
    #     authorization_url = await client.get_authorization_url(redirect_uri, scope=SCOPE, extras_params={"prompt": "consent", "access_type": "offline"})
    #     return authorization_url

    # async def get_access_token(client: GoogleOAuth2, redirect_uri: str, code: str):
    #     token = await client.get_access_token(code, redirect_uri)
    #     return token

    # async def get_email(client: GoogleOAuth2, token: str):
    #     user_id, user_email = await client.get_id_email(token)
    #     return user_id, user_email

    # def get_login_str():
    #     client: GoogleOAuth2 = GoogleOAuth2(CLIENT_ID, CLIENT_SECRET)
    #     authorization_url = asyncio.run(get_authorization_url(client, REDIRECT_URL))
    #     return f"""{authorization_url}"""

    # def display_user() -> void:
    #     client: GoogleOAuth2 = GoogleOAuth2(CLIENT_ID, CLIENT_SECRET)
    #     # get the code from the url
    #     code = st.query_params["code"]
    #     token = asyncio.run(get_access_token(client, REDIRECT_URL, code))
    #     st.write(token)
    #     user_id, user_email = asyncio.run(get_email(client, token["access_token"]))
    #     st.write(user_id)
    #     st.write(f"You're logged in as {user_email} and id is {user_id}")
