import hashlib
import os

JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
BOT_TOKEN_HASH = hashlib.sha256(os.environ["BOT_TOKEN"].encode())
COOKIE_NAME = "ikeniborn-!2YdKDOVLs/=amTzj1X1LR3Q2-0EmYj0OCzxHszuux6i8WrfyVK5AR-jIxVUKMTA0HTIlc3=E5besCmu2PT-h7Gw6AC!R8JbVYgrVAT7Zm29ZF8Oq!=SlEHp1nG2x0QUOwkLw9BBm3wHHmWKUvKCyKvOQJMzONm!XGalJ5dSRcxShggsOJsGw/bSB54n2F51qX6ETWU4UVNqMIq6TV?kH5/y!jHEdv-pTwEg-AAj/7V=M9OuVTA5BO"
