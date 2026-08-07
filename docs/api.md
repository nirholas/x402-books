# API reference — x402-books

Base URL: `http://localhost:4025` in development.
Machine-readable: [`openapi.json`](https://github.com/nirholas/x402-books/blob/main/openapi.json) (OpenAPI 3.1).

All paid routes return the purchased artifact in the **200 response body**.

## Payment

Every paid route answers an unpaid request with **402** and an `accepts` array
holding both rails:

| Rail | Network | Asset | payTo |
|------|---------|-------|-------|
| EVM | `base-sepolia` (`base` on mainnet) | USDC | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana` (`solana-devnet` on devnet) | USDC | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

Prices are quoted in USDC base units (6 decimals) as `maxAmountRequired`.
On success the response carries `X-PAYMENT-RESPONSE`: base64 JSON with
`{ success, rail, network, transaction, payer, amount, asset }`.

---

## `GET /search`

**$0.001** — Search books on OpenLibrary, annotated with full-text availability

### Parameters

| Param | In | Required | Type | Description |
|-------|----|----------|------|-------------|
| `q` | query | yes | string | Title or free-text query, 1-200 characters. |
| `author` | query | no | string | Narrow to an author name. |
| `limit` | query | no | integer | Maximum editions to return, 1…20. Default 10. |

### Example request

```bash
curl -s "http://localhost:4025/search?q=frankenstein&limit=2" -H "X-PAYMENT: <base64 payload>"
```

### Response `200 application/json`

The field to look at is `gutenberg`. When `available` is `true`, `readPath` is a path you can call directly (`GET /read/84`) to buy the full text for $0.01. When it is `false`, `note` explains why availability could not be established, if that is the reason.

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

### Errors

| HTTP | `error` | When |
|------|---------|------|
| 400 | `invalid_query` | `q` missing, empty, or longer than 200 characters. |
| 400 | `invalid_author` | `author` longer than 120 characters. |
| 400 | `invalid_limit` | `limit` outside 1…20. |
| 402 | — | No or invalid `X-PAYMENT`. Body carries `accepts` with both rails. |
| 502 | `upstream_error` | The upstream data source failed or timed out. |

---

## `GET /read/:gutenbergId`

**$0.01** — Buy the complete public-domain book as chaptered markdown

### Parameters

| Param | In | Required | Type | Description |
|-------|----|----------|------|-------------|
| `gutenbergId` | path | yes | integer | Project Gutenberg ebook number — the `gutenberg.gutenbergId` from `/search`, or the number in a `gutenberg.org/ebooks/N` URL. `84` is Frankenstein. |

### Example request

```bash
curl -s "http://localhost:4025/read/84" -H "X-PAYMENT: <base64 payload>"
```

### Response `200 application/json`

This is the whole artifact, in the body. `chapters[].markdown` is the chapter text as markdown paragraphs. `frontMatter` holds anything before the first heading. Books with no recognisable headings return one chapter titled `"Full text"`. The example below is abridged — real chapter bodies run to thousands of words.

```json
{
  "source": "gutenberg",
  "gutenbergId": 84,
  "title": "Frankenstein; or, the modern prometheus",
  "authors": [
    "Shelley, Mary Wollstonecraft"
  ],
  "languages": [
    "en"
  ],
  "subjects": [
    "Science fiction",
    "Horror tales",
    "Gothic fiction",
    "Scientists -- Fiction",
    "Monsters -- Fiction",
    "Frankenstein, Victor (Fictitious character) -- Fiction",
    "Frankenstein's monster (Fictitious character) -- Fiction",
    "Text",
    "Precursors of Science Fiction",
    "Gothic Fiction"
  ],
  "textUrl": "https://www.gutenberg.org/cache/epub/84/pg84.txt",
  "gutenbergUrl": "https://www.gutenberg.org/ebooks/84",
  "rights": "Public domain in the USA. Project Gutenberg licence applies to the source file; the cleaned text is derived from it.",
  "chapterCount": 28,
  "wordCount": 74986,
  "frontMatter": "Frankenstein;\n\nor, the Modern Prometheus\n\nby Mary Wollstonecraft (Godwin) Shelley\n\nCONTENTS\n\nLetter 1 Letter 2 Letter 3 Letter 4 Chapter 1 Chapter 2 Chapter 3 Chapter 4 Chapter 5 C …",
  "chapters": [
    {
      "index": 1,
      "title": "Letter 1",
      "markdown": "_To Mrs. Saville, England._\n\nSt. Petersburgh, Dec. 11th, 17—.\n\nYou will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings. I arrived here yesterday, and my first task is to ass …",
      "wordCount": 1198
    },
    {
      "index": 2,
      "title": "Letter 2",
      "markdown": "_To Mrs. Saville, England._\n\nArchangel, 28th March, 17—.\n\nHow slowly the time passes here, encompassed as I am by frost and snow! Yet a second step is taken towards my enterprise. I have hired a vessel and am occupied in collecting my sailors; those whom I hav …",
      "wordCount": 1309
    }
  ],
  "retrievedAt": "2026-08-07T03:14:29.864Z"
}
```

### Errors

| HTTP | `error` | When |
|------|---------|------|
| 400 | `invalid_gutenberg_id` | `gutenbergId` is not a Project Gutenberg ebook number. |
| 404 | `not_found` | Project Gutenberg has no plain-text edition for that ebook number. |
| 402 | — | No or invalid `X-PAYMENT`. Body carries `accepts` with both rails. |
| 502 | `upstream_error` | The upstream data source failed or timed out. |


---

## Free routes

### `GET /`

Service metadata: description, live prices, active payment rails, data-source
status, and docs links.

### `GET /health`

```json
{ "status": "ok", "uptime": 12.5 }
```

### `GET /.well-known/x402`

The discovery manifest — every resource with its price, output schema, and both
accepted rails. See [agents.md](agents.md).
