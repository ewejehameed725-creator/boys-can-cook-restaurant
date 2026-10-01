# Boys Can Cook Restaurant — Platform Starter

This version is the customer-facing foundation for a proper food-ordering platform.

## Included
- Responsive restaurant homepage
- Menu
- Customer registration/login UI
- Account/profile dashboard
- Wallet UI
- Cart
- Order history/status UI
- Mobile navigation foundation
- Black/orange/white brand design

## Important
The account, wallet and order data in this starter are demo browser storage only. They are NOT suitable for real payments or production authentication.

## Next backend stage
Recommended production architecture:
Frontend: Vercel
Backend: Node.js + Express on Render
Database: PostgreSQL
Payments: Nigerian payment gateway with server-side verification/webhooks

Planned API:
POST /api/auth/register
POST /api/auth/login
GET /api/me
GET /api/menu
POST /api/orders
GET /api/orders
GET /api/wallet/balance
GET /api/wallet/transactions
POST /api/wallet/deposit/initiate
GET /api/wallet/deposit/verify
POST /api/payments/webhook

Never let the browser directly set a real wallet balance.
