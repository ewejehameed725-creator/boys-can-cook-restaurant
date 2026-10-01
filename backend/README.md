# Boys Can Cook Restaurant Backend

## Render
Build command:
npm install

Start command:
npm start

Environment variables:
DATABASE_URL = your PostgreSQL connection string
JWT_SECRET = a long random secret
NODE_ENV = production

## Main endpoints
GET /db-test
POST /api/auth/register
POST /api/auth/login
GET /api/me
GET /api/menu
GET /api/wallet
POST /api/wallet/deposit
GET /api/orders
POST /api/orders
GET /api/admin/orders
PATCH /api/admin/orders/:id/status

The wallet deposit endpoint intentionally creates a pending transaction. Real wallet credit must happen only after the payment gateway verifies the payment server-side/webhook.
