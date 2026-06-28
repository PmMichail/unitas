# UAPKI Integration Status

## Completed Tasks

### 1. UAPKI Library Setup
- ✅ Downloaded UAPKI v2.0.12 for Linux x86-64
- ✅ Created base Docker container (uapki:latest) with Ubuntu 22.04
- ✅ Copied UAPKI libraries to /usr/local/lib
- ✅ Ran ldconfig to configure library paths

### 2. C++ Wrapper Development
- ✅ Created C++ wrapper for UAPKI JSON interface
- ✅ Implemented process() and json_free() function calls
- ✅ Added support for multiple tasks (INIT, OPEN, KEYS, SELECT_KEY, SIGN, CLOSE, DEINIT)
- ✅ Built uapki-cpp:latest container with g++ and nlohmann-json3-dev

### 3. UAPKI Testing
- ✅ INIT: Successfully initialized UAPKI with offline mode
- ✅ OPEN: Successfully opened JKS file (test_key.jks, password: Mn290876)
- ✅ KEYS: Successfully retrieved 2 keys from JKS
- ✅ SELECT_KEY: Successfully selected key (F459748823C83B5A838BA9E642AD3AF071D0291C46A45F85B7101D79E3A87B06)
- ✅ SIGN: Successfully signed data (EDRPOU 9883657) with CMS format
- ✅ CLOSE: Successfully closed storage
- ✅ DEINIT: Successfully deinitialized UAPKI

### 4. Signature Details
- Format: CMS (Cryptographic Message Syntax)
- Length: 2372 bytes (base64 encoded)
- Data signed: "OTg4MzY1Nw==" (base64 for "9883657")
- Certificate included: Yes
- Detached data: No

## Current Issues

### DPS OAuth 400 Bad Request
- **Problem**: DPS OAuth endpoint returns 400 Bad Request
- **Endpoint**: https://cabinet.tax.gov.ua/ws/auth/oauth/token
- **Current request format** (corrected):
  ```
  POST /ws/auth/oauth/token
  Content-Type: application/x-www-form-urlencoded
  Accept: application/json
  
  grant_type=password
  username=9883657
  password=<base64_signature>
  ```
- **Tried solutions**:
  - ✅ Corrected OAuth field names (grant_type=password, username=EDRPOU, password=signature)
  - ✅ CMS format signature (works for signing)
  - ✅ detachedData=true/false
  - ❌ CAdES-BES format (fails with CRL_NOT_FOUND)
  - ❌ Different grant_type values (jwt-bearer, password)
- **Likely cause**: DPS expects signature on specific text string, not just EDRPOU "9883657"
- **Next step**: Sniff live DPS cabinet to determine exact signed text

## Files Created

1. `/backend/uapki/Dockerfile` - Base UAPKI container
2. `/backend/uapki/Dockerfile.cpp` - C++ wrapper container
3. `/backend/uapki/Dockerfile.full` - Full DPS test container
4. `/backend/uapki/uapki_json_wrapper.cpp` - C++ wrapper implementation
5. `/backend/uapki/test_sign.json` - UAPKI signing tasks JSON
6. `/backend/uapki/test_dps_full.py` - Full DPS API test script
7. `/backend/uapki/test_key.jks` - Test JKS file (EDRPOU 9883657)

## Key Information

### JKS File Details
- Path: /app/test_key.jks
- Password: Mn290876
- EDRPOU: 9883657
- Algorithm: DSTU 4145
- CA: АЦСК ПриватБанку
- Key ID: F459748823C83B5A838BA9E642AD3AF071D0291C46A45F85B7101D79E3A87B06

### UAPKI Configuration
- Provider: PKCS12
- Mode: RO (read-only)
- Offline: true
- Validation by CRL: false (for CMS format)

## Next Steps

1. **Investigate DPS API signature format requirements**
   - Check if DPS expects CAdES-BES specifically
   - Verify if signature needs additional attributes
   - Check if assertion parameter needs JWT format instead of raw signature

2. **Test with real DPS environment**
   - Verify OAuth endpoint is accessible
   - Check if test certificate is valid for DPS
   - Verify client_id and scope parameters

3. **Alternative approaches**
   - Try different signature formats (PKCS7, CAdES-T)
   - Add timestamp to signature
   - Include additional certificate chain

## Summary

UAPKI integration is **functionally complete** - the library successfully signs data using the provided JKS file. The remaining issue is with DPS OAuth endpoint acceptance of the signature format. This may require:
- DPS API documentation review
- Testing with different signature formats
- Verification of OAuth request parameters
