---
name: public-domain-books-api
description: Search public-domain books and buy the complete chaptered text through a self-hosted x402-books server (OpenLibrary search, Project Gutenberg text). Use when an agent needs the full text of a classic book as markdown JSON.
---

# x402-books

Search runs against OpenLibrary; the read route fetches the Project Gutenberg
plain text, strips the licence boilerplate, splits chapters on their headings
and returns the whole book as markdown JSON. Everything is keyless and fetched
live (no fixture mode).

## Run the server

It is a self-hosted Node server (Express, Node 18 or newer). Run it from a clone:

```bash
git clone https://github.com/nirholas/x402-books && cd x402-books
npm install
cp .env.example .env     # then adjust; see the comments in the file
npm run dev              # tsx src/server.ts, listens on PORT (default 4025)
```

`npm run build` then `npm start` runs the compiled server. `npm run client`
runs `examples/agent-client.ts`, a reference paying client. Set `PAY_TO_ADDRESS`
and `SOLANA_PAY_TO_ADDRESS` to your own wallets to be paid yourself.

Upstream overrides: `OPENLIBRARY_BASE_URL`, `GUTENDEX_BASE_URL`,
`GUTENBERG_BASE_URL`, `BOOKS_USER_AGENT`, `BOOKS_TIMEOUT_MS`.

## Routes

| Route | Price | Notes |
| --- | --- | --- |
| `GET /search?q=&author=&limit=` | $0.001 | `q` required, 1 to 200 chars; `author` optional, up to 120; `limit` 1 to 20, default 10 |
| `GET /read/:gutenbergId` | $0.01 | numeric Gutenberg ebook id, for example 84 |
| `GET /`, `GET /health`, `GET /.well-known/x402` | free | |

Search results are editions with `title`, `authors`, `firstPublishYear`,
`subjects`, `ebookAccess` and, where the text is buyable, `gutenberg.readPath`
(for example `/read/84`). Call that path to buy the book.

Errors: 400 `invalid_query`, `invalid_author`, `invalid_limit`,
`invalid_gutenberg_id`; 404 `not_found` (no plain-text edition); 502
`upstream_error`.

## Example

```bash
curl -i "http://localhost:4025/search?q=frankenstein&limit=2"   # 402 first, then pay and retry
```

## Paying (x402)

Paid routes follow the x402 protocol. An unpaid call returns HTTP 402 with an
`accepts` array listing USDC on Base and USDC on Solana. Sign for one rail,
retry with the base64 payload in the `X-PAYMENT` header, and the 200 body
carries the result; the settlement receipt is in the `X-PAYMENT-RESPONSE`
header. Clients: `x402-fetch` (EVM), `@three-ws/x402-payment-modal` (browser,
both rails), or any x402 client. The rail networks are chosen by `NETWORK`
(EVM, `base-sepolia` by default) and `SOLANA_NETWORK` in `.env`; see
`.env.example`. Settlement moves real USDC on the chosen network: show the user
the recipient, amount and network and get an explicit yes before every paid call.
