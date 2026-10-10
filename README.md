# x402-books

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![x402](https://img.shields.io/badge/payments-x402-0052ff.svg)](https://x402.org)
[![USDC on Base](https://img.shields.io/badge/USDC-Base-0052ff.svg)](https://base.org)
[![USDC on Solana](https://img.shields.io/badge/USDC-Solana-14f195.svg)](https://solana.com)

**Agents buy clean, chaptered full-text public-domain books — OpenLibrary search,
Gutenberg delivery, in-response.** $0.001 to search, $0.01 for the whole book, in
USDC on Base *or* Solana. The 200 body carries the entire text: licence
boilerplate stripped, split into chapters, each chapter as markdown paragraphs
with a word count.

Docs site: **https://nirholas.github.io/x402-books/**

## Why x402 for this

The text is free; getting it in a usable shape is not. An agent that wants
*Frankenstein* as clean chaptered markdown has to find the right edition,
guess the right Gutenberg id, download a 450 KB fixed-width text file, strip a
licence header, and write a chapter splitter — every time, for every book. This
service does that work and charges a cent for it. x402 makes a one-cent product
viable at all: no invoice, no seat, no minimum, no account for a buyer who may
purchase exactly one book and never return. And because the artifact is the
response body, there is nothing to fetch afterwards.

## Quickstart

```bash
git clone https://github.com/nirholas/x402-books
cd x402-books
npm install
npm run dev            # http://localhost:4025 — no configuration needed
```

See the price with no wallet at all:

```bash
curl -s "http://localhost:4025/search?q=frankenstein&limit=2" | jq
# 402 + accepts: [ USDC on Base, USDC on Solana ]
```

Then buy it, from an agent (wallet funded with Base Sepolia USDC —
https://faucet.circle.com):

```bash
PRIVATE_KEY=0xYourTestKey npm run client
```

## API

| Route | Price | What you get back |
|-------|-------|-------------------|
| `GET /search` | **$0.001** | Editions with authors, first publication year, subjects, cover, OpenLibrary ebook access level — and, where the complete text is buyable here, a ready-to-call `readPath` |
| `GET /read/:gutenbergId` | **$0.01** | The entire book: metadata, front matter, and one entry per chapter with its markdown body and word count — licence boilerplate already stripped |
| `GET /` | free | Service metadata, live prices, active payment rails, upstream status |
| `GET /health` | free | Liveness probe |
| `GET /.well-known/x402` | free | Machine-readable discovery manifest |

Full reference: [docs/api.md](docs/api.md) · [openapi.json](openapi.json)

## How x402 works

**Pay in USDC on Base or Solana — your client picks the rail.**

1. **402** — the route, called without payment, replies HTTP 402 with an
   `accepts` array holding **both** rails: exact price
   ($0.001 → `1000` USDC base units), asset, and `payTo`.
2. **Sign** — on Base, the client signs an EIP-3009 USDC authorization (no gas
   from the payer). On Solana, it signs an SPL `transferChecked` whose fee payer
   is the facilitator's sponsor account (so the buyer needs USDC only, no SOL).
3. **Settle** — the server hands the payload to the facilitator
   (`https://x402.org/facilitator`), which verifies and settles on the chosen chain.
4. **200** — the same request returns the artifact in the body, with the
   settlement receipt in the `X-PAYMENT-RESPONSE` header.

| Rail | Network | Asset | payTo |
|------|---------|-------|-------|
| EVM | `base-sepolia` (`base` on mainnet) | USDC | `0x40252CFDF8B20Ed757D61ff157719F33Ec332402` |
| Solana | `solana` (`solana-devnet` on devnet) | USDC | `WwwuGbqHrwF5RG89KhUbmRWEvjnRH9k5kVM5p7T3WwW` |

Those are the suite's public receive addresses and the server's defaults. Set
`PAY_TO_ADDRESS` / `SOLANA_PAY_TO_ADDRESS` to be paid yourself.

Walkthroughs: [examples/curl.md](examples/curl.md) ·
[examples/agent-client.ts](examples/agent-client.ts) ·
[docs/tutorial.md](docs/tutorial.md)

## Real backend / API keys

| Env | Effect |
|-----|--------|
| *(none)* | **No API key exists for this service.** OpenLibrary, Gutendex and Project Gutenberg are all keyless and are called live on every request. There is no fixture mode and no `source: "fixture"` — if an upstream fails you get a `502`, not invented data. |
| `OPENLIBRARY_BASE_URL`, `GUTENDEX_BASE_URL`, `GUTENBERG_BASE_URL` | Point any of the three upstreams at a mirror or a local instance. |
| `BOOKS_USER_AGENT`, `BOOKS_TIMEOUT_MS` | Identify yourself to the upstreams (they ask for it) and bound the request time. Default timeout 30s — full books are large. |

All variables: [.env.example](.env.example)

## For AI agents

- **[skill.md](skill.md)** — agent-facing skill file: endpoints, prices,
  schemas, both payment rails. Point your agent at it.
- **`GET /.well-known/x402`** — discovery manifest listing every resource with
  both networks. Indexable by [x402scan.com](https://x402scan.com), the x402
  Bazaar, and [agentic.market](https://agentic.market).
- **MCP** — [examples/mcp-tool.md](examples/mcp-tool.md) exposes these routes as
  Claude MCP tools, with per-wallet spend caps and a
  `claude_desktop_config.json` example.
- More: [docs/agents.md](docs/agents.md)

## Docs

- Landing: https://nirholas.github.io/x402-books/
- [Tutorial](docs/tutorial.md) · [API reference](docs/api.md) · [For AI agents](docs/agents.md)

## Support

Questions, bugs, or a listing request: **nichxbt@gmail.com** ·
[open an issue](https://github.com/nirholas/x402-books/issues)

## License

Apache-2.0. Part of the [x402 Suite](https://github.com/nirholas/x402-suite).

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=nirholas/x402-books&type=Date)](https://www.star-history.com/#nirholas/x402-books&Date)

<!-- three.ws:growth -->
## Support the project

If x402-books saves you time, **[star it on GitHub](https://github.com/nirholas/x402-books)**. Stars are how other developers and AI agents find the repositories worth trusting, and they cost you one click.

Know someone who would use it? [Post on X](https://twitter.com/intent/tweet?text=x402-books%3A%20Agents%20buy%20clean%2C%20chaptered%20full-text%20public-domain%20books%3A%20OpenLibrary%20search%2C%20Gutenberg%20delivery&url=https%3A%2F%2Fgithub.com%2Fnirholas%2Fx402-books) · [Share on Bluesky](https://bsky.app/intent/compose?text=x402-books%3A%20Agents%20buy%20clean%2C%20chaptered%20full-text%20public-domain%20books%3A%20OpenLibrary%20search%2C%20Gutenberg%20delivery%20https%3A%2F%2Fgithub.com%2Fnirholas%2Fx402-books) · [Share on LinkedIn](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fgithub.com%2Fnirholas%2Fx402-books) · [Submit to Hacker News](https://news.ycombinator.com/submitlink?u=https%3A%2F%2Fgithub.com%2Fnirholas%2Fx402-books&t=x402-books%3A%20Agents%20buy%20clean%2C%20chaptered%20full-text%20public-domain%20books%3A%20OpenLibrary%20search%2C%20Gutenberg%20delivery) · [Share on Reddit](https://www.reddit.com/submit?url=https%3A%2F%2Fgithub.com%2Fnirholas%2Fx402-books&title=x402-books%3A%20Agents%20buy%20clean%2C%20chaptered%20full-text%20public-domain%20books%3A%20OpenLibrary%20search%2C%20Gutenberg%20delivery)

## Built for AI agents too

Coding agents and LLM tooling can read this repo directly: [AGENTS.md](./AGENTS.md), [llms.txt](./llms.txt), [llms-full.txt](./llms-full.txt). Point an agent at `https://github.com/nirholas/x402-books` and it has the context it needs.

## More from the same author

- [All repositories by nirholas](https://github.com/nirholas/nirholas#readme): the full catalog, grouped by topic
- [three.ws](https://three.ws): the platform for 3D AI agents with Solana wallets, a skill marketplace and x402 payments
- Questions or ideas: [open an issue](https://github.com/nirholas/x402-books/issues) or [start a discussion](https://github.com/nirholas/x402-books/discussions)

## Contributors

[![Contributors](https://contrib.rocks/image?repo=nirholas/x402-books)](https://github.com/nirholas/x402-books/graphs/contributors)

<!-- /three.ws:growth -->
