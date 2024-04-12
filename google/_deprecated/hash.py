from random import SystemRandom
from hmac import compare_digest

_sysrand = SystemRandom()

randbits = _sysrand.getrandbits
choice = _sysrand.choice

def randbelow(exclusive_upper_bound):
    return _sysrand._randbelow(exclusive_upper_bound)

DEFAULT_ENTROPY = 32  # bytes

def token_bytes(nbytes=None):
    if nbytes is None:
        nbytes = DEFAULT_ENTROPY
    return os.urandom(nbytes)

def token_hex(nbytes=None):
    return binascii.hexlify(token_bytes(nbytes)).decode('ascii')

def token_urlsafe(nbytes=None):
    tok = token_bytes(nbytes)
    return base64.urlsafe_b64encode(tok).rstrip(b'=').decode('ascii')