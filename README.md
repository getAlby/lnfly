# LNFly

Lightning Fly - A platform to quickly create apps that you can earn through bitcoin lightning payments.

[Try it now](https://lnfly.fly.dev/)

## How it works

LNFly focuses on simplicity - 1 html file for frontend, and if needed, 1 deno file for the backend.

LNFly provides information on how to make payments to the LLM through a system prompt.

Deno is secure by default - therefore Deno apps can be run as child processes. Deno apps only have access to the internet

## Features

- [x] Basic HTML app generation
- [x] Accountless app management (publishing and unpublishing apps)
- [x] Apps list on homepage
- [x] Prompt suggestions on homepage
- [x] Generate prompt improvement suggestions
- [x] Generate app name from prompt
- [x] Basic app backend generation
- [x] Launching and stopping app backends
- [x] Proxy frontend requests to app backend
- [x] [Lightning Tools] Generate an invoice from a lightning address
- [x] [Lightning Tools] Verify an invoice was paid
- [x] [Bitcoin Connect] Launch Payment modal
- [x] [Bitcoin Connect] Request WebLN provider
- [x] [NWC] Create, lookup and pay invoices
- [ ] Generate system prompt based on request
- [ ] Zap posts on homepage
- [ ] User accounts
- [ ] Nostr knowledge

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
