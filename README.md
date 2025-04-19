# Spark NWC

Multi-User NWC Wallet Service using Spark

## Development

### Frontend

```bash
cd frontend
yarn install
yarn dev
```

#### Build

This will allow you to access it served as static files from the backend at `localhost:3001`.

`yarn build`

### Backend

```bash
cd backend
cp .env.example .env
yarn install
yarn prisma migrate dev
yarn start
```
