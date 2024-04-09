import os
from numpy import void
import streamlit as st
import asyncio

# https://frankie567.github.io/httpx-oauth/oauth2/
from httpx_oauth.clients.google import GoogleOAuth2
import google_auth_oauthlib.flow
from dotenv import load_dotenv

load_dotenv(".env")

CLIENT_ID = os.environ["CLIENT_ID"]
CLIENT_SECRET = os.environ["CLIENT_SECRET"]
REDIRECT_URL = os.environ["REDIRECT_URL"]
SCOPE = os.environ["SCOPE"]


async def get_authorization_url(client: GoogleOAuth2, redirect_uri: str):
    authorization_url = await client.get_authorization_url(redirect_uri, scope=SCOPE, extras_params={"prompt": "consent", "access_type": "offline"})
    return authorization_url


async def get_access_token(client: GoogleOAuth2, redirect_uri: str, code: str):
    token = await client.get_access_token(code, redirect_uri)
    return token


async def get_email(client: GoogleOAuth2, token: str):
    user_id, user_email = await client.get_id_email(token)
    return user_id, user_email


def get_login_str():
    client: GoogleOAuth2 = GoogleOAuth2(CLIENT_ID, CLIENT_SECRET)
    authorization_url = asyncio.run(get_authorization_url(client, REDIRECT_URL))
    return f"""{authorization_url}"""


def display_user() -> void:
    client: GoogleOAuth2 = GoogleOAuth2(CLIENT_ID, CLIENT_SECRET)
    # get the code from the url
    code = st.query_params["code"]
    token = asyncio.run(get_access_token(client, REDIRECT_URL, code))
    st.write(token)
    user_id, user_email = asyncio.run(get_email(client, token["access_token"]))
    st.write(user_id)
    st.write(f"You're logged in as {user_email} and id is {user_id}")
