# Tutorial — x402-books

From a clean checkout to a paid API call, on either payment rail.

## 1. Install

```bash
git clone https://github.com/nirholas/x402-books
cd x402-books
npm install
```

Node 18 or newer.

## 2. Configure (optional)

```bash
cp .env.example .env
```

Nothing is required. Out of the box the server:

- listens on port `4025`,
- accepts USDC on **Base Sepolia** and on **Solana**, paying out to the suite's
  public receive addresses,
- calls OpenLibrary, Gutendex and Project Gutenberg **live** — there is no key and no fixture mode.

To be paid yourself, change these two lines:

```bash
PAY_TO_ADDRESS=0xYourEvmAddress
SOLANA_PAY_TO_ADDRESS=YourSolanaAddress
```

There is nothing to configure. All three upstreams are keyless, so `npm run dev`
gives you the real thing immediately.

If you deploy this, do set a contactable user agent — the upstreams ask for it,
and some reject anonymous clients:

```bash
BOOKS_USER_AGENT="your-service/1.0 (+https://your.example.com)"
```

## 3. Run the server

```bash
npm run dev
```

```
x402-books v0.1.0 listening on :4025
  payment rails:
    EVM     base-sepolia  USDC → 0x40252CFDF8B20Ed757D61ff157719F33Ec332402
    Solana  solana         USDC → WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW
  facilitator: https://x402.org/facilitator
  paid routes:
    GET /search                  $0.001
    GET /read/:gutenbergId       $0.01
  free routes: GET /, GET /health, GET /.well-known/x402
```

Check it is alive:

```bash
curl -s http://localhost:4025/health
# {"status":"ok","uptime":1.2}
```

## 4. Your first 402

```bash
curl -s "http://localhost:4025/search?q=frankenstein&limit=2" | jq
```

You get HTTP **402** and a challenge listing **both** rails:

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "accepts": [
    { "scheme": "exact", "network": "base-sepolia", "maxAmountRequired": "1000",
      "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402", "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
    { "scheme": "exact", "network": "solana", "maxAmountRequired": "1000",
      "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW", "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" }
  ]
}
```

That is the whole price negotiation: no key, no signup, no account. The price
is `1000` USDC base units (6 decimals) = **$0.001**.

## 5. Pay for real

Get a Base Sepolia test wallet and fund it with test USDC from
<https://faucet.circle.com>. Then:

```bash
PRIVATE_KEY=0xYourTestKey npm run client
```

[`examples/agent-client.ts`](../examples/agent-client.ts) does the full flow:

1. Calls the route unpaid and prints both rails from the 402.
2. Signs an EIP-3009 USDC authorization for exactly $0.001.
3. Retries with the `X-PAYMENT` header.
4. Prints the artifact and decodes the `X-PAYMENT-RESPONSE` receipt.

Prefer Solana? The bottom of that file shows the equivalent flow — the server
needs no changes, since the same 402 already advertises the `solana` rail.

## 6. Read the artifact

The 200 body **is** the purchase:

```json
{
  "source": "openlibrary+gutenberg",
  "query": {
    "q": "frankenstein",
    "author": null,
    "limit": 2
  },
  "totalFound": 4033,
  "count": 2,
  "editions": [
    {
      "key": "/works/OL450063W",
      "title": "Frankenstein; or, The Modern Prometheus",
      "authors": [
        "Mary Shelley"
      ],
      "firstPublishYear": 1818,
      "editionCount": 2187,
      "languages": [
        "eng",
        "por",
        "ger",
        "spa",
        "chi",
        "dut",
        "rus",
        "ita",
        "fre"
      ],
      "subjects": [
        "Frankenstein (Fictitious character)",
        "Frankenstein's monster (Fictitious character)",
        "Fiction",
        "Victor Frankenstein (Fictitious character)",
        "Scientists",
        "Monsters",
        "Fiction, horror",
        "Frankenstein (fictitious character), fiction"
      ],
      "coverUrl": "https://covers.openlibrary.org/b/id/12356249-M.jpg",
      "ebookAccess": "public",
      "internetArchiveIds": [
        "frankensteinormo00shel_8",
        "cu31924105428902",
        "ghostseer01schiuoft",
        "frankensteinormo00shel_9",
        "frankensteinorm00shelgoog"
      ],
      "openLibraryUrl": "https://openlibrary.org/works/OL450063W",
      "gutenberg": {
        "available": true,
        "gutenbergId": 84,
        "readPath": "/read/84"
      }
    },
    {
      "key": "/works/OL25595002W",
      "title": "Mary Shelley's Frankenstein; or, the Modern Prometheus (1818 text)",
      "authors": [
        "Mary Shelley"
      ],
      "firstPublishYear": 1818,
      "editionCount": 90,
      "languages": [
        "eng",
        "fre",
        "rus"
      ],
      "subjects": [
        "Frankenstein, victor",
        "Frankenstein's monster",
        "Shelley, mary wollstonecraft , 1797-1851",
        "Scientists",
        "Scientists--fiction",
        "Monsters",
        "Monsters--fiction",
        "Medicine in literature"
      ],
      "coverUrl": "https://covers.openlibrary.org/b/id/7267770-M.jpg",
      "ebookAccess": "public",
      "internetArchiveIds": [
        "frankenstein00mary_6",
        "frankensteinormo0000mary",
        "frankensteinormo0000shel_t0c9",
        "maryshelleyfrank00shel",
        "frankensteinorig0000shel"
      ],
      "openLibraryUrl": "https://openlibrary.org/works/OL25595002W",
      "gutenberg": {
        "available": false,
        "gutenbergId": null,
        "readPath": null,
        "note": "Gutendex unreachable; availability resolved via gutenberg.org search."
      }
    }
  ],
  "retrievedAt": "2026-08-07T03:14:29.429Z"
}
```

That is the whole book. `chapters` holds one entry per printed heading, each
with its markdown body and a word count; `frontMatter` holds anything before the
first heading (preface, dedication, letters). `wordCount` is the total.

Books without recognisable chapter headings come back as a single chapter titled
`"Full text"` — you always get the complete text, chaptered where the source
makes that possible.

To find something to buy, run `/search` first: every edition whose full text is
available carries `gutenberg.readPath`, which you can call directly.

Full field-by-field reference: [api.md](api.md).

## 7. Going to mainnet

```bash
# EVM: Base mainnet
NETWORK=base
PAY_TO_ADDRESS=0xYourRealAddress

# Solana: mainnet (this is already the default)
SOLANA_NETWORK=mainnet-beta
SOLANA_PAY_TO_ADDRESS=YourRealSolanaAddress
SOLANA_RPC_URL=https://your-dedicated-rpc.example.com

# A facilitator that settles on the networks you accept
FACILITATOR_URL=https://x402.org/facilitator
```

Then run `npm run build && npm start`. Nothing else changes: the same routes,
the same prices, real USDC.

> Use a dedicated Solana RPC in production. The public endpoint is heavily
> rate-limited.

## Where to go next

- [api.md](api.md) — every endpoint, parameter, and error
- [agents.md](agents.md) — discovery, MCP, and listing your instance
- [../skill.md](https://github.com/nirholas/x402-books/blob/main/skill.md) — the agent-facing skill file
- [../examples/curl.md](https://github.com/nirholas/x402-books/blob/main/examples/curl.md) — the same flow in raw curl
