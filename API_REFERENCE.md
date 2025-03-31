# Backend Ledger — API Reference & Command Cheatsheet
# Based on: https://github.com/ankurdotio/backend-ledger
# Server runs at: http://localhost:3000

# ============================================================
# STARTUP
# ============================================================

# Install dependencies
npm install

# Create system user (run ONCE before testing)
node src/scripts/createSystemUser.js

# Start dev server
npm run dev

# ============================================================
# AUTH ROUTES  (/api/auth)
# ============================================================

# Register a new user
# POST /api/auth/register
# Body: { "email": "test@test.com", "password": "password123", "name": "Test User" }
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123","name":"Test User"}'

# Login
# POST /api/auth/login
# Body: { "email": "test@test.com", "password": "password123" }
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"password123"}'

# Logout (blacklists the token)
# POST /api/auth/logout
# Header: Authorization: Bearer <token>
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer <YOUR_TOKEN>"

# ============================================================
# ACCOUNT ROUTES  (/api/accounts)  — All Protected
# ============================================================

# Create an account (for logged-in user)
# POST /api/accounts
# Body: { "currency": "INR" }
curl -X POST http://localhost:3000/api/accounts \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"currency":"INR"}'

# Get all accounts of logged-in user
# GET /api/accounts
curl -X GET http://localhost:3000/api/accounts \
  -H "Authorization: Bearer <YOUR_TOKEN>"

# Get balance of a specific account
# GET /api/accounts/balance/:accountId
curl -X GET http://localhost:3000/api/accounts/balance/<ACCOUNT_ID> \
  -H "Authorization: Bearer <YOUR_TOKEN>"

# ============================================================
# TRANSACTION ROUTES  (/api/transactions)  — All Protected
# ============================================================

# Transfer between two accounts (regular user)
# POST /api/transactions
# Body: { fromAccount, toAccount, amount, idempotencyKey }
curl -X POST http://localhost:3000/api/transactions \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAccount": "<FROM_ACCOUNT_ID>",
    "toAccount": "<TO_ACCOUNT_ID>",
    "amount": 500,
    "idempotencyKey": "unique-key-001"
  }'

# Add initial funds to an account (SYSTEM USER ONLY)
# POST /api/transactions/system/initial-funds
# Body: { toAccount, amount, idempotencyKey }
curl -X POST http://localhost:3000/api/transactions/system/initial-funds \
  -H "Authorization: Bearer <SYSTEM_USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "toAccount": "<ACCOUNT_ID>",
    "amount": 10000,
    "idempotencyKey": "init-funds-001"
  }'

# ============================================================
# TESTING FLOW (step-by-step for Postman or curl)
# ============================================================

# Step 1: Register or login as system user
#         email: system@test.com | password: system_password_123

# Step 2: Register or login as regular user (midun)

# Step 3: Create an account as system user
#         POST /api/accounts  →  save the returned _id

# Step 4: Create an account as regular user
#         POST /api/accounts  →  save the returned _id

# Step 5: Add initial funds to regular user's account (as system user)
#         POST /api/transactions/system/initial-funds
#         toAccount = regular user's account _id

# Step 6: Check balance of regular user's account
#         GET /api/accounts/balance/<ACCOUNT_ID>

# Step 7: Transfer from regular user to another account
#         POST /api/transactions
#         fromAccount = regular user's account
#         toAccount = any other account

# ============================================================
# IDEMPOTENCY KEY BEHAVIOR
# ============================================================
# - Same key + COMPLETED → returns cached result (200)
# - Same key + PENDING   → returns "still processing" (200)
# - Same key + FAILED    → tells you to retry (500)
# - Same key + REVERSED  → tells you it was reversed (500)
# - New unique key       → processes as new transaction

# ============================================================
# IMPORTANT NOTES
# ============================================================
# - system@test.com is the only account that can hit /system/initial-funds
# - If your token has been used to logout, it's blacklisted for 3 days
# - All ledger entries are IMMUTABLE — cannot be modified or deleted
# - MongoDB Replica Set is required for transactions (sessions) to work
#   If using MongoDB Atlas, this is already supported
#   If using local MongoDB, start with: mongod --replSet rs0
