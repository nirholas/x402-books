/**
 * Per-route request/response schemas published in the x402 402 challenge.
 *
 * GENERATED from `openapi.json` — the runtime challenge and the OpenAPI
 * document must agree, and the runtime is authoritative for x402scan
 * discovery. Regenerate rather than hand-editing.
 *
 * Shape follows the x402 Bazaar convention:
 *   `input`  — how to call the route (`type: "http"`, method, query params /
 *              JSON body fields)
 *   `output` — the JSON-Schema of the 200 response body.
 *
 * Keys match the paywall route map in `src/server.ts` exactly.
 */

export type RouteSchema = {
  /** How an agent invokes this route. */
  input: Record<string, unknown>;
  /** JSON-Schema of the artifact returned in the 200 body. */
  output: Record<string, unknown>;
};

export const ROUTE_SCHEMAS: Record<string, RouteSchema> = {
  "GET /search": {
    "input": {
      "type": "http",
      "method": "GET",
      "queryParams": {
        "q": {
          "type": "string",
          "description": "Title or free-text query, 1-200 characters.",
          "example": "frankenstein"
        },
        "author": {
          "type": "string",
          "description": "Narrow to an author name.",
          "example": "Mary Shelley"
        },
        "limit": {
          "type": "integer",
          "description": "Maximum editions to return, 1…20. Default 10.",
          "example": 2
        }
      },
      "queryParamsRequired": [
        "q"
      ]
    },
    "output": {
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
  },
  "GET /read/:gutenbergId": {
    "input": {
      "type": "http",
      "method": "GET"
    },
    "output": {
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
  }
};
