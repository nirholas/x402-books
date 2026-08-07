# Raw HTTP walkthrough — 402 → pay → 200

Everything below is plain `curl`. No SDK required.

## 0. Start the server

```bash
npm install
npm run dev      # http://localhost:4025
```

## 1. Free routes need no payment

```bash
curl -s http://localhost:4025/health
curl -s http://localhost:4025/ | jq
curl -s http://localhost:4025/.well-known/x402 | jq
```

## 2. Call a paid route with no payment → 402, both rails

```bash
curl -s -i "http://localhost:4025/search?q=frankenstein&limit=2"
```

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json
```

```json
{
  "x402Version": 1,
  "error": "X-PAYMENT header is required",
  "hint": "Pay in USDC on Base or Solana — your client picks the rail. See /.well-known/x402",
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "1000",
      "resource": "http://localhost:4025/search",
      "description": "Search books on OpenLibrary, annotated with full-text availability",
      "mimeType": "application/json",
      "payTo": "0x40252CFDF8B20Ed757D61ff157719F33Ec332402",
      "maxTimeoutSeconds": 120,
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      "extra": { "name": "USDC", "version": "2" }
    },
    {
      "scheme": "exact",
      "network": "solana",
      "maxAmountRequired": "1000",
      "resource": "http://localhost:4025/search",
      "description": "Search books on OpenLibrary, annotated with full-text availability",
      "mimeType": "application/json",
      "payTo": "WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW",
      "maxTimeoutSeconds": 120,
      "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "extra": { "name": "USDC", "decimals": 6, "feePayer": "<facilitator sponsor>" }
    }
  ]
}
```

`maxAmountRequired` is in USDC base units (6 decimals): `1000` = $0.001.

## 3. Build the payment

Pick **one** entry from `accepts`.

**EVM (Base):** sign an EIP-3009 `transferWithAuthorization` for
`maxAmountRequired` USDC to `payTo`. No gas needed from you — the facilitator
submits it.

**Solana:** build an SPL `transferChecked` of `maxAmountRequired` USDC to
`payTo`, with `extra.feePayer` as the transaction fee payer, and sign it. You
need USDC only — the facilitator sponsors the SOL fee.

Either way, base64-encode the x402 payload:

```json
{ "x402Version": 1, "scheme": "exact", "network": "<the rail you picked>", "payload": { … } }
```

In practice, let a library do it:

```bash
PRIVATE_KEY=0xYourTestKey npm run client
```

## 4. Repeat the request with the header → 200 + artifact

```bash
curl -s -i "http://localhost:4025/search?q=frankenstein&limit=2" \
  -H "X-PAYMENT: <base64 payload>"
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-PAYMENT-RESPONSE: eyJzdWNjZXNzIjp0cnVlLCJyYWlsIjoiZXZtIiwi…
```

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

Decode the receipt:

```bash
echo '<X-PAYMENT-RESPONSE value>' | base64 -d | jq
# { "success": true, "rail": "evm", "network": "base-sepolia",
#   "transaction": "0x…", "payer": "0x…", "amount": "1000", "asset": "USDC" }
```

The artifact is in the body of that same 200. There is nothing else to fetch.

## All paid routes

```bash
curl -s "http://localhost:4025/search?q=frankenstein&limit=2" -H "X-PAYMENT: <payload>"   # $0.001
```

```bash
curl -s "http://localhost:4025/read/84" -H "X-PAYMENT: <payload>"   # $0.01
```
