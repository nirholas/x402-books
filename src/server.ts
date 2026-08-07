/**
 * x402-books — Express server with the dual-rail x402 paywall.
 *
 * Agents buy clean, chaptered full-text public-domain books. Both routes are
 * keyless and fully live: OpenLibrary for editions and availability, Project
 * Gutenberg for the text itself. Paid routes return the purchased artifact
 * directly in the 200 response body — `/read/:gutenbergId` returns the entire
 * book, chaptered, as markdown JSON.
 *
 * Buyers pay in USDC on Base (EVM) or on Solana; the 402 challenge advertises
 * both rails and the client picks.
 */
import "dotenv/config";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  facilitatorUrl,
  paywall,
  rails,
  solanaCheckoutRouter,
  usingSuiteDefaultPayTo,
  type RoutePrices,
} from "./payments.js";
import { ROUTE_SCHEMAS } from "./schemas.js";
import { readBook, searchBooks } from "./service.js";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

/** Paid routes. Anything not listed here is free. */
const ROUTES: RoutePrices = {
  "GET /search": {
    price: "$0.001",
    description:
      "Book search over OpenLibrary, annotated with whether the full public-domain text can be bought from /read/:gutenbergId.",
    outputSchema: ROUTE_SCHEMAS["GET /search"],
  },
  "GET /read/:gutenbergId": {
    price: "$0.01",
    description:
      "The complete public-domain book: Project Gutenberg text with the licence boilerplate stripped, split into chapters, delivered as markdown JSON in the response body.",
    outputSchema: ROUTE_SCHEMAS["GET /read/:gutenbergId"],
  },
};

const app = express();
app.disable("x-powered-by");
app.use(express.json());

// Dual-rail x402 paywall: USDC on Base or Solana.
app.use(paywall(ROUTES, { service: "x402-books" }));

// Optional: browser (Phantom) Solana checkout helper.
const checkoutRouter = await solanaCheckoutRouter();
if (checkoutRouter) app.use("/api/x402-checkout", checkoutRouter);

// Discovery manifest — before express.static so it keeps an explicit JSON type.
app.get("/.well-known/x402", (_req, res) => {
  res.type("application/json").sendFile(join(publicDir, ".well-known", "x402"));
});

// `index: false` keeps `GET /` on the handler below, which serves the landing
// page to browsers and the JSON service descriptor to agents.
app.use(express.static(publicDir, { index: false }));

// Free: service info.
// Content-negotiated — `Accept: text/html` (a browser, or a crawler looking for
// title/description/favicon/og:image) gets the landing page; everything else,
// including `Accept: */*`, gets the JSON descriptor.
app.get("/", (req, res) => {
  if (req.accepts(["json", "html"]) === "html") {
    res.sendFile(join(publicDir, "index.html"));
    return;
  }
  res.json({
    name: "x402-books",
    description:
      "Agents buy clean, chaptered full-text public-domain books — OpenLibrary search, Gutenberg delivery, in-response",
    payment: {
      protocol: "x402",
      note: "Pay in USDC on Base or Solana — your client picks the rail.",
      facilitator: facilitatorUrl(),
      rails: rails(),
    },
    backend: {
      search: { source: "openlibrary", live: true, note: "OpenLibrary Search API — keyless, called live." },
      availability: { source: "gutendex", live: true, note: "Gutendex, falling back to gutenberg.org search." },
      text: { source: "gutenberg", live: true, note: "Project Gutenberg plain text — keyless, called live." },
    },
    routes: {
      "GET /search": {
        price: "$0.001",
        params: "q (required), author, limit (1-20, default 10)",
        returns: "editions with availability and, where free full text exists, a readPath",
      },
      "GET /read/:gutenbergId": {
        price: "$0.01",
        params: "gutenbergId (Project Gutenberg ebook number)",
        returns: "the complete book as chaptered markdown JSON",
      },
      "GET /health": { price: "free" },
      "GET /.well-known/x402": { price: "free" },
    },
    rights:
      "Texts are public domain in the USA and sourced from Project Gutenberg. Book metadata from OpenLibrary.",
    docs: "https://nirholas.github.io/x402-books/",
    skill: "https://github.com/nirholas/x402-books/blob/main/skill.md",
  });
});

// Free: health check.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Paid: $0.001 — book search. Artifact returned in this response body.
app.get("/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const author =
    typeof req.query.author === "string" && req.query.author.trim().length > 0
      ? req.query.author.trim()
      : null;
  const limit = req.query.limit != null ? Number(req.query.limit) : 10;

  if (q.length < 1 || q.length > 200) {
    res.status(400).json({
      error: "invalid_query",
      message: "Query param 'q' is required and must be 1-200 characters.",
    });
    return;
  }
  if (author != null && author.length > 120) {
    res.status(400).json({
      error: "invalid_author",
      message: "Query param 'author' must be at most 120 characters.",
    });
    return;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    res.status(400).json({
      error: "invalid_limit",
      message: "Query param 'limit' must be an integer between 1 and 20.",
    });
    return;
  }

  try {
    res.json(await searchBooks(q, author, limit));
  } catch (err) {
    res.status(502).json({
      error: "upstream_error",
      message: err instanceof Error ? err.message : "OpenLibrary request failed",
    });
  }
});

// Paid: $0.01 — the complete book. Artifact returned in this response body.
app.get("/read/:gutenbergId", async (req, res) => {
  const raw = req.params.gutenbergId;
  if (!/^\d{1,7}$/.test(raw)) {
    res.status(400).json({
      error: "invalid_gutenberg_id",
      message:
        "Path param 'gutenbergId' must be a Project Gutenberg ebook number, e.g. 84 for Frankenstein.",
    });
    return;
  }
  const id = Number(raw);
  try {
    const book = await readBook(id);
    if (!book) {
      res.status(404).json({
        error: "not_found",
        message: `Project Gutenberg has no plain-text edition for ebook ${id}.`,
      });
      return;
    }
    res.json(book);
  } catch (err) {
    res.status(502).json({
      error: "upstream_error",
      message: err instanceof Error ? err.message : "Project Gutenberg request failed",
    });
  }
});

const port = Number(process.env.PORT ?? 4025);
app.listen(port, () => {
  const pkg = require("../package.json") as { version: string };
  console.log(`x402-books v${pkg.version} listening on :${port}`);
  console.log("  payment rails:");
  for (const rail of rails()) {
    console.log(
      `    ${rail.rail === "evm" ? "EVM   " : "Solana"}  ${rail.network.padEnd(14)} ${rail.asset} → ${rail.payTo}`,
    );
  }
  console.log(`  facilitator: ${facilitatorUrl()}`);
  if (usingSuiteDefaultPayTo()) {
    console.log(
      "  note:        using suite default payTo — set PAY_TO_ADDRESS/SOLANA_PAY_TO_ADDRESS to receive funds yourself",
    );
  }
  console.log("  backend:     OpenLibrary + Gutendex + Project Gutenberg (keyless, all live)");
  console.log("  paid routes:");
  for (const [route, spec] of Object.entries(ROUTES)) {
    console.log(`    ${route.padEnd(28)} ${typeof spec === "string" ? spec : spec.price}`);
  }
  console.log("  free routes: GET /, GET /health, GET /.well-known/x402");
});
