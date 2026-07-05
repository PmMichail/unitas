import subprocess
import tempfile
import os
import logging

logger = logging.getLogger(__name__)

NODE_SCRIPT = os.path.join(os.path.dirname(__file__), '../dps-nodejs/sign.js')


def sign_with_jkurwa(jks_data: bytes, jks_password: str) -> str:
    """
    Sign EDRPOU with DSTU 4145-2002 using jkurwa Node.js library.

    Args:
        jks_data: raw bytes of the JKS file
        jks_password: plaintext password for the JKS

    Returns:
        base64-encoded CAdES-BES signature string (Authorization header value)

    Raises:
        Exception on signing failure
    """
    script_path = os.path.abspath(NODE_SCRIPT)
    if not os.path.exists(script_path):
        raise Exception(f"jkurwa sign.js not found at {script_path}")

    with tempfile.NamedTemporaryFile(suffix='.jks', delete=False) as tmp:
        tmp.write(jks_data)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            ['node', script_path, tmp_path, jks_password],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            err = result.stderr.strip() or "unknown error"
            logger.error(f"[JKURWA] sign.js exited {result.returncode}: {err}")
            raise Exception(f"jkurwa signing failed: {err}")

        signature = result.stdout.strip()
        if not signature:
            raise Exception("jkurwa returned empty signature")

        logger.info(f"[JKURWA] Signature created, length={len(signature)}")
        return signature
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def test_jks(jks_data: bytes, jks_password: str) -> dict:
    """
    Test that a JKS file can be loaded and signed with.
    Returns {'ok': True, 'edrpou': '...', 'name': '...'} or raises.
    """
    try:
        sig = sign_with_jkurwa(jks_data, jks_password)
        return {'ok': True, 'signature_length': len(sig)}
    except Exception as e:
        raise Exception(f"JKS перевірка не вдалась: {str(e)}")
