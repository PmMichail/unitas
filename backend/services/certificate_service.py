import os
import hashlib
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.backends import default_backend
from asn1crypto import cms, pem
import asn1crypto.pdf as pdf

class CertificateService:
    @staticmethod
    def verify_cades_signature(p7m_path: str, original_data: bytes = None):
        """
        Verifies CAdES signature (.p7m file or data).
        Returns (is_valid: bool, signer_cert: x509.Certificate, signed_data: bytes)
        """
        import subprocess
        import tempfile
        try:
            with open(p7m_path, 'rb') as f:
                p7m_data = f.read()
            # Parse CMS (CAdES) structure using asn1crypto
            if pem.detect(p7m_data):
                _, _, p7m_data = pem.unarmor(p7m_data)
            content_info = cms.ContentInfo.load(p7m_data)
            signed_data = content_info['content']
            signer_infos = signed_data['signer_infos']
            certificates = signed_data['certificates']
            if not signer_infos or not certificates:
                return False, None, None
            # Find signer certificate
            signer_info = signer_infos[0]
            issuer_and_serial = signer_info['sid'].chosen
            signer_cert = None
            for cert in certificates:
                chosen_cert = cert.chosen
                if chosen_cert['tbs_certificate']['issuer'] == issuer_and_serial['issuer'] and \
                   chosen_cert['tbs_certificate']['serial_number'] == issuer_and_serial['serial_number']:
                    signer_cert = chosen_cert
                    break
            if not signer_cert:
                return False, None, None
            signer_cert_pyca = x509.load_der_x509_certificate(signer_cert.dump(), default_backend())
            
            # Write p7m data to temp file for OpenSSL
            with tempfile.NamedTemporaryFile(delete=False, suffix=".p7m") as tmp_in:
                tmp_in.write(p7m_data)
                tmp_in_path = tmp_in.name
                
            tmp_out_path = tmp_in_path + ".out"
            tmp_content_path = None
            
            if original_data is not None:
                with tempfile.NamedTemporaryFile(delete=False) as tmp_content:
                    tmp_content.write(original_data)
                    tmp_content_path = tmp_content.name
                    
            try:
                cmd = ["openssl", "cms", "-verify", "-inform", "DER", "-in", tmp_in_path, "-noverify", "-binary"]
                if tmp_content_path:
                    cmd.extend(["-content", tmp_content_path])
                else:
                    cmd.extend(["-out", tmp_out_path])
                    
                subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                
                if tmp_content_path:
                    signed_data_bytes = original_data
                else:
                    with open(tmp_out_path, 'rb') as f_out:
                        signed_data_bytes = f_out.read()
                        
                return True, signer_cert_pyca, signed_data_bytes
                
            except subprocess.CalledProcessError as err:
                print(f"OpenSSL verification failed: {err.stderr.decode('utf-8')}")
                return False, None, None
            finally:
                if os.path.exists(tmp_in_path):
                    os.remove(tmp_in_path)
                if os.path.exists(tmp_out_path):
                    os.remove(tmp_out_path)
                if tmp_content_path and os.path.exists(tmp_content_path):
                    os.remove(tmp_content_path)
                    
        except Exception as e:
            print(f"Verification error: {e}")
            return False, None, None

    @staticmethod
    def is_pdf_signed(file_path: str) -> bool:
        """Checks if PDF has embedded PAdES signature"""
        try:
            with open(file_path, 'rb') as f:
                pdf_data = f.read()
            pdf_obj = pdf.PDF.load(pdf_data)
            return hasattr(pdf_obj, 'signature_fields') and len(pdf_obj.signature_fields) > 0
        except:
            return False
