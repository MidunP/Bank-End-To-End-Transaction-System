# Bank End-to-End Transaction System

A backend banking ledger system where users can

1. Sign up and login
2. Create bank accounts
3. Transfer funds between accounts using a double-entry ledger
4. Check real-time account balance derived from the ledger
5. Receive email notifications on transactions

## Tech Stack

1. Node.js for Backend
2. Express as the framework
3. MongoDB Atlas as the database
4. Mongoose as the ODM
5. JWT for authentication
6. Nodemailer + Gmail OAuth2 for email notifications

## Setting it up locally

- Clone the repo
- Copy over `.env.example` to `src/.env`
- Update `src/.env`
  - MongoDB Atlas connection string
  - JWT secret
  - Gmail OAuth2 credentials
- `npm install`
- Seed the system user (run once)
  - `node src/scripts/createSystemUser.js`
- Start the backend
  - `npm run dev`

## API Routes

- Auth — `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- Accounts — `POST /api/accounts`, `GET /api/accounts`, `GET /api/accounts/balance/:accountId`
- Transactions — `POST /api/transactions`, `POST /api/transactions/system/initial-funds`
