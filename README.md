# 🏦 Bank End-to-End Transaction System

A production-ready **backend banking ledger system** built with Node.js, Express, and MongoDB. Features a double-entry ledger, atomic multi-step transactions, idempotency protection, JWT authentication with logout blacklisting, and email notifications — designed with financial-grade data integrity in mind.

![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-v5-000000?style=flat-square&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Mongoose](https://img.shields.io/badge/Mongoose-v9-880000?style=flat-square)
![License](https://img.shields.io/badge/license-ISC-blue?style=flat-square)

---

## ✨ Features

- **JWT Authentication** — Register, login, and logout with token blacklisting
- **Double-Entry Ledger** — Every transfer creates both a DEBIT and a CREDIT entry
- **Atomic Transactions** — All DB operations run inside a MongoDB Session; partial failures are automatically rolled back
- **Idempotency Protection** — Duplicate requests with the same key never double-charge
- **Immutable Ledger** — Ledger entries cannot be modified or deleted once created (Mongoose middleware enforced)
- **System User** — Privileged system account for seeding initial funds to users
- **Account Balance** — Real-time balance derived from the ledger via MongoDB aggregation pipelines
- **Email Notifications** — Send transaction alerts via Nodemailer + Gmail OAuth2
- **Deployment Ready** — Runs on Render, Railway, or any Node.js host

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express v5 |
| Database | MongoDB Atlas |
| ODM | Mongoose v9 |
| Auth | JSON Web Tokens (JWT) |
| Password Hashing | bcryptjs |
| Email | Nodemailer + Gmail OAuth2 |
| Environment | dotenv |

---

## 📁 Project Structure

```
.
├── API_REFERENCE.md              # curl cheatsheet for all endpoints
├── package.json
├── src/
│   ├── server.js                 # Entry point
│   ├── app.js                    # Express app setup & routes
│   ├── config/
│   │   └── db.js                 # MongoDB connection
│   ├── controllers/
│   │   ├── auth.controller.js    # Register, Login, Logout
│   │   ├── account.controller.js # Create account, get accounts, get balance
│   │   └── transaction.controllers.js  # 10-step transfer flow
│   ├── middleware/
│   │   └── auth.middleware.js    # JWT + blacklist check, system user guard
│   ├── models/
│   │   ├── user.models.js        # User schema with password hashing
│   │   ├── account.models.js     # Account schema + getBalance() method
│   │   ├── transaction.models.js # Transaction schema with idempotency key
│   │   ├── ledger.models.js      # Immutable ledger entries
│   │   └── blackList.models.js   # JWT blacklist with 3-day TTL
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── accounts.routes.js
│   │   └── transaction.routes.js
│   ├── services/
│   │   └── email.services.js     # Gmail OAuth2 email notifications
│   └── scripts/
│       └── createSystemUser.js   # Seed the SYSTEM_ user (run once)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **MongoDB Atlas** account (free tier works) — [create one here](https://www.mongodb.com/cloud/atlas)
- **Gmail OAuth2** credentials — for email notifications ([guide](https://developers.google.com/identity/protocols/oauth2))

### 1. Clone the repository

```bash
git clone https://github.com/MidunP/Bank-End-To-End-Transaction-System.git
cd Bank-End-To-End-Transaction-System
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file inside the `src/` directory:

```bash
# src/.env

MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/backend-ledger
JWT_SECRET=your_super_secret_jwt_key

# Gmail OAuth2 (for email notifications)
EMAIL_USER=youremail@gmail.com
CLIENT_ID=your_google_client_id
CLIENT_SECRET=your_google_client_secret
REFRESH_TOKEN=your_google_refresh_token
```

> ⚠️ Never commit your `.env` file. It is already listed in `.gitignore`.

### 4. Seed the System User (run once)

The system user is a privileged account used to deposit initial funds into real user accounts. It must exist before any `/system/initial-funds` calls.

```bash
node src/scripts/createSystemUser.js
```

This will create a user with:
- **Email:** `system@test.com`
- **Password:** `system_password_123`
- **Flag:** `systemUser: true`

### 5. Start the development server

```bash
npm run dev
```

The server will start at `http://localhost:3000`.

---

## 🔗 API Endpoints

### Auth — `/api/auth`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Register a new user | ❌ Public |
| POST | `/login` | Login and receive JWT | ❌ Public |
| POST | `/logout` | Logout and blacklist token | ✅ Required |

### Accounts — `/api/accounts`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/` | Create a new account | ✅ Required |
| GET | `/` | Get all accounts for logged-in user | ✅ Required |
| GET | `/balance/:accountId` | Get real-time ledger balance | ✅ Required |

### Transactions — `/api/transactions`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/` | Transfer funds between two accounts | ✅ Required |
| POST | `/system/initial-funds` | Seed initial funds to an account | 🔐 System User Only |

---

## 💳 The 10-Step Transfer Flow

Every call to `POST /api/transactions` runs through a strictly ordered pipeline:

```
1.  Validate request  (fromAccount, toAccount, amount, idempotencyKey)
2.  Validate idempotency key  (prevent duplicate processing)
3.  Check account status  (both must be ACTIVE)
4.  Derive sender balance from ledger  (reject if insufficient)
5.  Create transaction record (status: PENDING)
6.  Create DEBIT ledger entry  (deduct from sender)
7.  Create CREDIT ledger entry  (credit to receiver)
8.  Mark transaction COMPLETED
9.  Commit MongoDB session  (atomic — all or nothing)
10. Send email notification
```

All steps 5–9 run inside a **MongoDB transaction session**. If any step fails, the entire operation is rolled back automatically.

---

## 🔐 Security Design

| Concern | Solution |
|---------|----------|
| Password storage | bcryptjs (10 salt rounds) |
| Auth tokens | JWT (3-day expiry) |
| Logout invalidation | Token blacklist (auto-expire TTL index) |
| Secrets in DB | `systemUser` field is `select: false` |
| Ledger integrity | Mongoose pre-hooks block all update/delete operations |
| Idempotency | Unique index on `idempotencyKey` in transactions |

---

## 🧪 Testing with curl

Register a user:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"password123","name":"Alice"}'
```

Create an account:
```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"currency":"INR"}'
```

Check balance:
```bash
curl http://localhost:3000/api/accounts/balance/<ACCOUNT_ID> \
  -H "Authorization: Bearer <TOKEN>"
```

See [API_REFERENCE.md](./API_REFERENCE.md) for the full curl cheatsheet.

---

## 🌍 Deployment

### Deploying to Render

1. Push your code to GitHub (without `.env`)
2. Create a new **Web Service** on [Render](https://render.com)
3. Set **Build Command:** `npm install`
4. Set **Start Command:** `npm start`
5. Add all environment variables from `src/.env` in the Render dashboard
6. After deploy, run the system user seed script from the Render Shell:
   ```bash
   node src/scripts/createSystemUser.js
   ```

> ✅ MongoDB Atlas already supports Replica Sets — required for atomic transactions.

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** this repository
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Commit your changes**
   ```bash
   git commit -m "feat: add your feature description"
   ```
4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request** — describe what your PR does and why

Please follow the existing code style and ensure no secrets are committed.

---

## 📄 License

This project is licensed under the **ISC License**.

---

## 🙏 Acknowledgements

Inspired by the [backend-ledger](https://github.com/ankurdotio/backend-ledger) tutorial series by [@ankurdotio](https://github.com/ankurdotio).
