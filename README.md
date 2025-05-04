# LNFly

Lightning Fly - A platform to quickly create apps that you can earn through bitcoin lightning payments.

[Try it now](https://lnfly.fly.dev/)

## Supported Lightning functionality

LNFly has limited knowledge of some lightning tools to enable your generated app to interact with lightning wallets:

- Bitcoin connect (Payment modal, WebLN)
- Lightning tools (Request invoice from lightning address, verify invoice)
- NWC (Make invoice, lookup invoice, pay invoice)

## How it works

LNFly focuses on simplicity - 1 html file for frontend, and if needed, 1 deno file for the backend.

LNFly provides information on how to make payments to the LLM through a system prompt.

Deno is secure by default and can be run as child processes without endangering the parent app. The child processes can access the internet, but not the local filesystem.

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
- [x] Generate system prompt based on request
- [x] Allow configuring NWC connection
- [ ] Update dockerfile to add fly
- [ ] Stop app backends automatically after 10 minutes
- [ ] Allow specifying a seed for generation
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
