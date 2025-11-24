#!/usr/bin/env python3
"""
Test script to hash a password for a specific user.
"""

import base64
import hashlib
import hmac
import json
from Crypto.Protocol.KDF import scrypt

# Firebase SCRYPT parameters - NEW PROJECT
HASH_KEY = base64.b64decode("OP4uKqYfjf1jFZ0+qWsr29gFlMdKAt30g6IPFyZc2nobI8U94GhqQH+x1L+NSSW9bmtH3aObRR5hif6jCo03mA==")
SALT_SEPARATOR = base64.b64decode("Bw==")
ROUNDS = 8
MEM_COST = 14

def firebase_scrypt(password: str, salt: bytes) -> bytes:
    """Firebase SCRYPT implementation."""
    key_len = 32
    N = 2 ** MEM_COST  # 2^14 = 16384
    r = ROUNDS  # 8
    p = 1
    
    combined_salt = salt + SALT_SEPARATOR
    
    derived_key = scrypt(
        password.encode('utf-8'),
        combined_salt,
        key_len,
        N=N,
        r=r,
        p=p
    )
    
    if len(HASH_KEY) < key_len:
        hash_key_padded = HASH_KEY + b'\x00' * (key_len - len(HASH_KEY))
    else:
        hash_key_padded = HASH_KEY[:key_len]
    
    xored_key = bytes(a ^ b for a, b in zip(derived_key, hash_key_padded))
    return xored_key

def hash_password(password: str, salt_b64: str) -> str:
    """Hash a password using Firebase SCRYPT algorithm."""
    salt = base64.b64decode(salt_b64)
    hashed = firebase_scrypt(password, salt)
    return base64.b64encode(hashed).decode('utf-8')

def main():
    test_password = "IhLennox2006?"
    test_email = "lennoxmann3@gmail.com"
    
    # Load users.json
    with open('users.json', 'r') as f:
        users_data = json.load(f)
    
    print(f"Testing password: {test_password}")
    print(f"Looking for user: {test_email}")
    print("="*80)
    
    found = False
    for user in users_data['users']:
        email = user.get('email', '')
        if email.lower() == test_email.lower():
            found = True
            exported_hash = user.get('passwordHash', '')
            salt = user.get('salt', '')
            uid = user.get('localId', 'N/A')
            
            print(f"✅ Found user: {email}")
            print(f"   UID: {uid}")
            print(f"   Salt: {salt}")
            print(f"   Exported Hash: {exported_hash}")
            print()
            
            if not salt:
                print("❌ No salt found!")
                return
            
            # Hash the test password
            computed_hash = hash_password(test_password, salt)
            
            print(f"   Computed Hash: {computed_hash}")
            print()
            
            if computed_hash == exported_hash:
                print("🎉 MATCH! Password hash matches!")
            else:
                print("❌ NO MATCH - Hashes are different")
                print()
                print("This could mean:")
                print("  1. The password in the export is different")
                print("  2. The SCRYPT implementation doesn't match Firebase exactly")
                print("  3. The export format is incorrect")
                print()
                print("However, if you just created this account, Firebase might")
                print("use a different hash format for newly created accounts vs imported ones.")
    
    if not found:
        print(f"❌ User {test_email} not found in users.json")
        print()
        print("If you just created this account, it might not be in the export yet.")
        print("You may need to:")
        print("  1. Export users again from Firebase")
        print("  2. Or test with an existing user from the export")

if __name__ == "__main__":
    try:
        main()
    except ImportError as e:
        print(f"Error: Missing required library. Install with: pip install pycryptodome")
        print(f"Details: {e}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

