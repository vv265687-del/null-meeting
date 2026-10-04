import hashlib
import hmac
import secrets

from datetime import datetime, timedelta

from jose import jwt


# =========================================================
# JWT SETTINGS
# =========================================================

SECRET_KEY = "PROJECT_X_SECRET_KEY_CHANGE_THIS_LATER_123456789"

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60


# =========================================================
# PASSWORD HASH
# =========================================================

def hash_password(password: str) -> str:

    salt = secrets.token_bytes(16)

    iterations = 310000

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations
    )

    return (
        f"pbkdf2_sha256$"
        f"{iterations}$"
        f"{salt.hex()}$"
        f"{password_hash.hex()}"
    )


# =========================================================
# PASSWORD VERIFY
# =========================================================

def verify_password(
    password: str,
    stored_password: str
) -> bool:

    try:

        algorithm, iterations, salt_hex, hash_hex = (
            stored_password.split("$")
        )

        if algorithm != "pbkdf2_sha256":
            return False

        salt = bytes.fromhex(salt_hex)

        expected_hash = bytes.fromhex(hash_hex)

        actual_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            int(iterations)
        )

        return hmac.compare_digest(
            actual_hash,
            expected_hash
        )

    except Exception:

        return False


# =========================================================
# CREATE JWT TOKEN
# =========================================================

def create_access_token(data: dict):

    payload = data.copy()

    expire = datetime.utcnow() + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload["exp"] = expire

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return token