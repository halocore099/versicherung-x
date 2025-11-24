#!/usr/bin/env python3
"""
Test script to hash a password using Firebase SCRYPT parameters
and compare with exported user hashes.
"""

import base64
import hashlib
import hmac
import json
from Crypto.Protocol.KDF import scrypt

# Firebase SCRYPT parameters - NEW PROJECT (from Firebase Console)
HASH_KEY = base64.b64decode("OP4uKqYfjf1jFZ0+qWsr29gFlMdKAt30g6IPFyZc2nobI8U94GhqQH+x1L+NSSW9bmtH3aObRR5hif6jCo03mA==")
SALT_SEPARATOR = base64.b64decode("Bw==")
ROUNDS = 8
MEM_COST = 14

def firebase_scrypt(password: str, salt: bytes) -> bytes:
    """
    Firebase uses a modified SCRYPT algorithm.
    The password is hashed using SCRYPT with Firebase-specific parameters.
    """
    # Firebase SCRYPT implementation
    # Key length is 32 bytes (256 bits)
    key_len = 32
    
    # Derive key using SCRYPT
    # Firebase uses: scrypt(password, salt + salt_separator, N=2^mem_cost, r=rounds, p=1, dklen=key_len)
    N = 2 ** MEM_COST  # 2^14 = 16384
    r = ROUNDS  # 8
    p = 1  # Parallelization parameter
    
    # Combine salt with salt separator
    combined_salt = salt + SALT_SEPARATOR
    
    # Derive key using SCRYPT
    derived_key = scrypt(
        password.encode('utf-8'),
        combined_salt,
        key_len,
        N=N,
        r=r,
        p=p
    )
    
    # Firebase then XORs the derived key with the hash key
    # and base64 encodes it
    xored_key = bytes(a ^ b for a, b in zip(derived_key, HASH_KEY))
    
    return xored_key

def hash_password(password: str, salt_b64: str) -> str:
    """
    Hash a password using Firebase SCRYPT algorithm.
    Returns base64-encoded hash.
    """
    salt = base64.b64decode(salt_b64)
    hashed = firebase_scrypt(password, salt)
    return base64.b64encode(hashed).decode('utf-8')

def main():
    # Test password
    test_password = "IhLennox2006?"
    
    # Load users.json
    with open('users.json', 'r') as f:
        users_data = json.load(f)
    
    print(f"Testing password: {test_password}")
    print(f"Hash key: {base64.b64encode(HASH_KEY).decode()}")
    print(f"Salt separator: {base64.b64encode(SALT_SEPARATOR).decode()}")
    print(f"Rounds: {ROUNDS}, Mem cost: {MEM_COST}")
    print("\n" + "="*80)
    print("Comparing with exported user hashes...")
    print("="*80 + "\n")
    
    matches = []
    no_matches = []
    
    for user in users_data['users']:
        email = user.get('email', 'N/A')
        exported_hash = user.get('passwordHash', '')
        salt = user.get('salt', '')
        
        if not salt:
            print(f"⚠️  {email}: No salt found, skipping")
            continue
        
        # Hash the test password with this user's salt
        computed_hash = hash_password(test_password, salt)
        
        if computed_hash == exported_hash:
            matches.append({
                'email': email,
                'uid': user.get('localId', 'N/A'),
                'hash': exported_hash
            })
            print(f"✅ MATCH: {email}")
            print(f"   UID: {user.get('localId', 'N/A')}")
            print(f"   Hash: {exported_hash[:50]}...")
        else:
            no_matches.append(email)
            print(f"❌ No match: {email}")
            print(f"   Computed: {computed_hash[:50]}...")
            print(f"   Exported: {exported_hash[:50]}...")
    
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Total users checked: {len(users_data['users'])}")
    print(f"Matches found: {len(matches)}")
    print(f"No matches: {len(no_matches)}")
    
    if matches:
        print("\n🎉 MATCHING USERS:")
        for match in matches:
            print(f"  - {match['email']} (UID: {match['uid']})")
    
    if no_matches:
        print(f"\n⚠️  {len(no_matches)} users did not match")
        print("This could mean:")
        print("  1. The password is different for those users")
        print("  2. The hash parameters don't match")
        print("  3. The export format is incorrect")

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

