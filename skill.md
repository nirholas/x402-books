# x402-books — agent skill

Find public-domain books and buy their complete text. Search runs against the
OpenLibrary catalogue and annotates every edition with whether its full text can
be bought here — when it can, the result carries a ready-to-call `readPath`.
The read route fetches the Project Gutenberg plain text, strips the licence
boilerplate, splits it into chapters on their printed headings, and returns the
whole book as markdown JSON in the response body. Everything is keyless and
fetched live; there is no fixture mode.

**Base URL:** `{BASE_URL}` (local default `http://localhost:4025`)

Every paid call returns the purchased artifact **in the 200 response body**.
There is nothing to poll and nothing to collect later.

## Payment

This service speaks **x402** (HTTP 402 Payment Required, <https://x402.org>).

**Pay in USDC on Base or Solana — your client picks the rail.**

| Rail | Network | Asset | payTo |
|------|---------|-------|-------|
| EVM | `base-sepolia` (`base` on mainnet) | USDC | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana` (`solana-devnet` on devnet) | USDC | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

Facilitator: `https://x402.org/facilitator` (verifies and settles both rails).

Flow:

1. Call the endpoint with no `X-PAYMENT` header. You get **402** with an
   `accepts` array holding **both** rails.
2. Pick a rail, sign the payment, and put the base64 payload in `X-PAYMENT`.
3. Repeat the request. You get **200** with the artifact, and a settlement
   receipt in the `X-PAYMENT-RESPONSE` header (base64 JSON:
   `{ success, rail, network, transaction, payer, amount, asset }`).

Use `x402-fetch` (EVM), a Solana x402 client, or any x402-aware HTTP client —
the wire format is the standard one.

```ts
import { wrapFetchWithPayment, createSigner } from "x402-fetch";
const signer = await createSigner("base-sepolia", process.env.PRIVATE_KEY!);
const pay = wrapFetchWithPayment(fetch, signer);
const res = await pay("{BASE_URL}/search?q=frankenstein&limit=2");
const artifact = await res.json();
```

## Endpoints

### `GET /search` — $0.001

Search books on OpenLibrary, annotated with full-text availability

| Param | In | Required | Type | Description |
|-------|----|----------|------|-------------|
| `q` | query | yes | string | Title or free-text query, 1-200 characters. |
| `author` | query | no | string | Narrow to an author name. |
| `limit` | query | no | integer | Maximum editions to return, 1…20. Default 10. |

**Returns** (`200 application/json`) — Editions with authors, first publication year, subjects, cover, OpenLibrary ebook access level — and, where the complete text is buyable here, a ready-to-call `readPath`

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

<details><summary>Response schema</summary>

```json
{
  "type": "object",
  "required": [
    "source",
    "query",
    "totalFound",
    "count",
    "editions",
    "retrievedAt"
  ],
  "properties": {
    "source": {
      "type": "string",
      "enum": [
        "openlibrary+gutenberg"
      ]
    },
    "query": {
      "type": "object",
      "properties": {
        "q": {
          "type": "string"
        },
        "author": {
          "type": [
            "string",
            "null"
          ]
        },
        "limit": {
          "type": "integer"
        }
      }
    },
    "totalFound": {
      "type": "integer",
      "description": "Total matches upstream, not just the returned page."
    },
    "count": {
      "type": "integer"
    },
    "retrievedAt": {
      "type": "string",
      "format": "date-time"
    },
    "editions": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "key",
          "title",
          "authors",
          "gutenberg"
        ],
        "properties": {
          "key": {
            "type": "string",
            "description": "OpenLibrary work key, e.g. `/works/OL450063W`."
          },
          "title": {
            "type": "string"
          },
          "authors": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "firstPublishYear": {
            "type": [
              "integer",
              "null"
            ]
          },
          "editionCount": {
            "type": "integer",
            "description": "How many editions OpenLibrary knows of."
          },
          "languages": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "MARC language codes."
          },
          "subjects": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Up to 8 subject headings."
          },
          "coverUrl": {
            "type": [
              "string",
              "null"
            ],
            "format": "uri"
          },
          "ebookAccess": {
            "type": [
              "string",
              "null"
            ],
            "description": "OpenLibrary's access level: `public`, `borrowable`, `printdisabled`, `no_ebook`."
          },
          "internetArchiveIds": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Up to 5 IA identifiers."
          },
          "openLibraryUrl": {
            "type": "string",
            "format": "uri"
          },
          "gutenberg": {
            "type": "object",
            "required": [
              "available"
            ],
            "properties": {
              "available": {
                "type": "boolean",
                "description": "True when the full text can be bought from `/read/:gutenbergId`."
              },
              "gutenbergId": {
                "type": [
                  "integer",
                  "null"
                ]
              },
              "readPath": {
                "type": [
                  "string",
                  "null"
                ],
                "description": "Ready-to-call path, e.g. `/read/84`."
              },
              "note": {
                "type": "string",
                "description": "Present only when availability could not be established."
              }
            }
          }
        }
      }
    }
  }
}
```

</details>

---

### `GET /read/:gutenbergId` — $0.01

Buy the complete public-domain book as chaptered markdown

| Param | In | Required | Type | Description |
|-------|----|----------|------|-------------|
| `gutenbergId` | path | yes | integer | Project Gutenberg ebook number — the `gutenberg.gutenbergId` from `/search`, or the number in a `gutenberg.org/ebooks/N` URL. `84` is Frankenstein. |

**Returns** (`200 application/json`) — The entire book: metadata, front matter, and one entry per chapter with its markdown body and word count — licence boilerplate already stripped

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

<details><summary>Response schema</summary>

```json
{
  "type": "object",
  "required": [
    "source",
    "gutenbergId",
    "title",
    "chapterCount",
    "wordCount",
    "chapters",
    "retrievedAt"
  ],
  "properties": {
    "source": {
      "type": "string",
      "enum": [
        "gutenberg"
      ]
    },
    "gutenbergId": {
      "type": "integer"
    },
    "title": {
      "type": "string"
    },
    "authors": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "languages": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "subjects": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "textUrl": {
      "type": "string",
      "format": "uri",
      "description": "The Project Gutenberg source file this was derived from."
    },
    "gutenbergUrl": {
      "type": "string",
      "format": "uri"
    },
    "rights": {
      "type": "string"
    },
    "chapterCount": {
      "type": "integer"
    },
    "wordCount": {
      "type": "integer",
      "description": "Total across front matter and all chapters."
    },
    "frontMatter": {
      "type": [
        "string",
        "null"
      ],
      "description": "Markdown before the first chapter heading, or null."
    },
    "retrievedAt": {
      "type": "string",
      "format": "date-time"
    },
    "chapters": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "index",
          "title",
          "markdown",
          "wordCount"
        ],
        "properties": {
          "index": {
            "type": "integer",
            "description": "1-based position in the book."
          },
          "title": {
            "type": "string",
            "description": "Heading as printed, e.g. \"Chapter 4\" or \"Letter 1\"."
          },
          "markdown": {
            "type": "string",
            "description": "Chapter body as markdown paragraphs."
          },
          "wordCount": {
            "type": "integer"
          }
        }
      }
    }
  }
}
```

</details>


## Free endpoints

- `GET /` — Service metadata, live prices, active payment rails, upstream status
- `GET /health` — Liveness probe
- `GET /.well-known/x402` — Machine-readable discovery manifest

## Error codes

| HTTP | `error` | Meaning |
|------|---------|---------|
| 400 | `invalid_query` | `q` missing, empty, or longer than 200 characters. |
| 400 | `invalid_author` | `author` longer than 120 characters. |
| 400 | `invalid_limit` | `limit` outside 1…20. |
| 400 | `invalid_gutenberg_id` | `gutenbergId` is not a Project Gutenberg ebook number. |
| 404 | `not_found` | Project Gutenberg has no plain-text edition for that ebook number. |
| 502 | `upstream_error` | OpenLibrary or Project Gutenberg failed or timed out. No data is invented on failure. |
| 402 | — | Payment required or rejected. Body carries `accepts` (both rails) and an `error` reason. |
| 500 | `no_payment_rail_configured` | Server has neither a valid EVM nor Solana payTo. |

## Data source

**Everything is live and keyless. There is no fixture mode.**

| Source | Used for |
|--------|----------|
| [OpenLibrary Search API](https://openlibrary.org/dev/docs/api/search) | Editions, authors, subjects, covers, `ebookAccess` level, Internet Archive ids |
| [Gutendex](https://gutendex.com) | Mapping titles to Project Gutenberg ebook numbers |
| [Project Gutenberg](https://www.gutenberg.org) | The plain text itself, plus per-book RDF metadata |

If Gutendex is unreachable, availability is resolved from gutenberg.org's own
search page instead, and the affected results carry a `gutenberg.note`
explaining it — the search still succeeds. If the text itself cannot be fetched,
you get a `502`, never invented content.

Texts are public domain in the USA. The Project Gutenberg licence applies to the
source files; the cleaned, chaptered output is derived from them. Book metadata
is from OpenLibrary.

## Discovery

Machine-readable manifest: **`GET /.well-known/x402`**
(also at <https://github.com/nirholas/x402-books/blob/main/public/.well-known/x402>).
Indexed by [x402scan.com](https://x402scan.com), the x402 Bazaar, and
[agentic.market](https://agentic.market).

OpenAPI 3.1: [`openapi.json`](https://github.com/nirholas/x402-books/blob/main/openapi.json)

## Contact

nichxbt@gmail.com · <https://github.com/nirholas/x402-books>
