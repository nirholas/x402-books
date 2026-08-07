/**
 * x402-books — service layer.
 *
 * Entirely keyless and entirely live:
 *   - Editions and availability from the OpenLibrary Search API.
 *   - Public-domain full text from Project Gutenberg, cleaned and chaptered.
 *   - Gutenberg availability from Gutendex, with a fallback to gutenberg.org's
 *     own search when Gutendex is unreachable.
 *
 * There is no fixture mode: every response is fetched live. Failures surface as
 * upstream errors rather than as invented data.
 */

const USER_AGENT =
  process.env.BOOKS_USER_AGENT ??
  "x402-books/0.1 (+https://github.com/nirholas/x402-books)";

const OPENLIBRARY_BASE = process.env.OPENLIBRARY_BASE_URL ?? "https://openlibrary.org";
const GUTENDEX_BASE = process.env.GUTENDEX_BASE_URL ?? "https://gutendex.com";
const GUTENBERG_BASE = process.env.GUTENBERG_BASE_URL ?? "https://www.gutenberg.org";
const TIMEOUT_MS = Number(process.env.BOOKS_TIMEOUT_MS ?? 30_000);

async function get(url: string, accept = "application/json"): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: accept },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
  });
}

// ---------------------------------------------------------------------------
// /search — OpenLibrary editions + Gutenberg full-text availability
// ---------------------------------------------------------------------------

export interface GutenbergAvailability {
  /** True when a cleaned full text can be bought from `GET /read/:gutenbergId`. */
  available: boolean;
  gutenbergId: number | null;
  /** Ready-to-call path when `available` is true. */
  readPath: string | null;
  /** Why availability could not be determined, when it could not. */
  note?: string;
}

export interface Edition {
  /** OpenLibrary work key, e.g. "/works/OL450063W". */
  key: string;
  title: string;
  authors: string[];
  firstPublishYear: number | null;
  editionCount: number;
  languages: string[];
  subjects: string[];
  coverUrl: string | null;
  /**
   * OpenLibrary's own ebook access level:
   * `public` (free full view), `borrowable`, `printdisabled`, `no_ebook`.
   */
  ebookAccess: string | null;
  /** Internet Archive identifiers backing that access, if any. */
  internetArchiveIds: string[];
  openLibraryUrl: string;
  gutenberg: GutenbergAvailability;
}

export interface BookSearchResult {
  source: "openlibrary+gutenberg";
  query: { q: string; author: string | null; limit: number };
  totalFound: number;
  count: number;
  editions: Edition[];
  retrievedAt: string;
}

interface OlDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  edition_count?: number;
  language?: string[];
  subject?: string[];
  cover_i?: number;
  ebook_access?: string;
  ia?: string[];
}

interface GutendexBook {
  id?: number;
  title?: string;
  authors?: { name?: string; birth_year?: number | null; death_year?: number | null }[];
  subjects?: string[];
  languages?: string[];
  download_count?: number;
  formats?: Record<string, string>;
}

/** Normalises a title for fuzzy matching between the two catalogues. */
function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(the|a|an|or|and|of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Looks up Gutenberg ids by title via Gutendex. Returns null (rather than
 * throwing) when Gutendex is unreachable, so /search still succeeds.
 */
async function gutendexSearch(query: string): Promise<GutendexBook[] | null> {
  try {
    const res = await get(`${GUTENDEX_BASE}/books?search=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { results?: GutendexBook[] };
    return body.results ?? [];
  } catch {
    return null;
  }
}

/**
 * Fallback when Gutendex is blocked or down: parse gutenberg.org's own search
 * page for `/ebooks/<id>` links and their titles. Still keyless, still live.
 */
async function gutenbergSiteSearch(
  query: string,
): Promise<{ id: number; title: string }[] | null> {
  try {
    const res = await get(
      `${GUTENBERG_BASE}/ebooks/search/?query=${encodeURIComponent(query)}`,
      "text/html",
    );
    if (!res.ok) return null;
    const html = await res.text();
    const out: { id: number; title: string }[] = [];
    // Each result is an <a href="/ebooks/N"> … <span class="title">T</span>.
    const re = /href="\/ebooks\/(\d+)"[\s\S]{0,600}?<span class="title">([^<]*)<\/span>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && out.length < 25) {
      out.push({ id: Number(m[1]), title: m[2].trim() });
    }
    return out;
  } catch {
    return null;
  }
}

/** Builds a title → Gutenberg id index for the query, from whichever source works. */
async function gutenbergIndex(
  query: string,
): Promise<{ index: Map<string, number>; note?: string }> {
  // Both upstreams return results in relevance order, so the first id seen for
  // a normalised title is the most canonical edition — never overwrite it.
  const build = (entries: { id: number; title: string }[]): Map<string, number> => {
    const index = new Map<string, number>();
    for (const e of entries) {
      const key = normalizeTitle(e.title);
      if (!index.has(key)) index.set(key, e.id);
    }
    return index;
  };

  const viaGutendex = await gutendexSearch(query);
  if (viaGutendex) {
    return {
      index: build(
        viaGutendex
          .filter((b): b is GutendexBook & { id: number; title: string } =>
            b.id != null && typeof b.title === "string",
          )
          .map((b) => ({ id: b.id, title: b.title })),
      ),
    };
  }
  const viaSite = await gutenbergSiteSearch(query);
  if (viaSite) {
    return {
      index: build(viaSite),
      note: "Gutendex unreachable; availability resolved via gutenberg.org search.",
    };
  }
  return {
    index: new Map(),
    note: "Gutenberg availability could not be determined (both Gutendex and gutenberg.org were unreachable).",
  };
}

/** Finds a Gutenberg id for a title: exact normalised match, then prefix match. */
function matchGutenberg(title: string, index: Map<string, number>): number | null {
  const norm = normalizeTitle(title);
  if (index.has(norm)) return index.get(norm) ?? null;
  for (const [key, id] of index) {
    if (key.startsWith(norm) || norm.startsWith(key)) return id;
  }
  return null;
}

/**
 * Search editions by title (and optionally author) on OpenLibrary, annotated
 * with whether the full text can be bought from `/read/:gutenbergId`.
 */
export async function searchBooks(
  q: string,
  author: string | null,
  limit: number,
): Promise<BookSearchResult> {
  const params = new URLSearchParams({
    q,
    limit: String(limit),
    fields: "key,title,author_name,first_publish_year,edition_count,language,subject,cover_i,ebook_access,ia",
  });
  if (author) params.set("author", author);

  const res = await get(`${OPENLIBRARY_BASE}/search.json?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`OpenLibrary search failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const body = (await res.json()) as { numFound?: number; docs?: OlDoc[] };
  const docs = body.docs ?? [];

  const { index, note } = await gutenbergIndex(author ? `${q} ${author}` : q);

  const editions: Edition[] = docs.map((d) => {
    const title = d.title ?? "(untitled)";
    const gutenbergId = matchGutenberg(title, index);
    return {
      key: d.key ?? "",
      title,
      authors: d.author_name ?? [],
      firstPublishYear: d.first_publish_year ?? null,
      editionCount: d.edition_count ?? 0,
      languages: d.language ?? [],
      subjects: (d.subject ?? []).slice(0, 8),
      coverUrl: d.cover_i != null ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      ebookAccess: d.ebook_access ?? null,
      internetArchiveIds: (d.ia ?? []).slice(0, 5),
      openLibraryUrl: d.key ? `${OPENLIBRARY_BASE}${d.key}` : OPENLIBRARY_BASE,
      gutenberg:
        gutenbergId != null
          ? { available: true, gutenbergId, readPath: `/read/${gutenbergId}` }
          : { available: false, gutenbergId: null, readPath: null, ...(note ? { note } : {}) },
    };
  });

  return {
    source: "openlibrary+gutenberg",
    query: { q, author, limit },
    totalFound: body.numFound ?? editions.length,
    count: editions.length,
    editions,
    retrievedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// /read/:gutenbergId — cleaned, chaptered full text
// ---------------------------------------------------------------------------

export interface Chapter {
  index: number;
  /** Heading as printed in the source, e.g. "Chapter 4" or "Letter 1". */
  title: string;
  /** Chapter body as markdown paragraphs. */
  markdown: string;
  wordCount: number;
}

export interface BookText {
  source: "gutenberg";
  gutenbergId: number;
  title: string;
  authors: string[];
  languages: string[];
  subjects: string[];
  /** Where the plain text came from. */
  textUrl: string;
  /** Project Gutenberg landing page. */
  gutenbergUrl: string;
  rights: string;
  chapterCount: number;
  wordCount: number;
  /** Front matter before the first chapter heading (preface, dedication…). */
  frontMatter: string | null;
  chapters: Chapter[];
  retrievedAt: string;
}

/** Metadata from Gutendex, falling back to the per-book RDF on gutenberg.org. */
async function gutenbergMetadata(id: number): Promise<{
  title: string;
  authors: string[];
  languages: string[];
  subjects: string[];
} | null> {
  try {
    const res = await get(`${GUTENDEX_BASE}/books/${id}`);
    if (res.ok) {
      const b = (await res.json()) as GutendexBook;
      if (b.id != null) {
        return {
          title: b.title ?? `Project Gutenberg eBook ${id}`,
          authors: (b.authors ?? []).map((a) => a.name ?? "").filter(Boolean),
          languages: b.languages ?? [],
          subjects: (b.subjects ?? []).slice(0, 10),
        };
      }
    }
  } catch {
    /* fall through to the RDF */
  }

  // Fallback: Project Gutenberg publishes a per-book RDF record.
  try {
    const res = await get(`${GUTENBERG_BASE}/cache/epub/${id}/pg${id}.rdf`, "application/rdf+xml");
    if (!res.ok) return null;
    const xml = await res.text();
    const one = (re: RegExp): string | null => re.exec(xml)?.[1]?.trim() ?? null;
    const all = (re: RegExp): string[] => [...xml.matchAll(re)].map((m) => m[1].trim());
    const title = one(/<dcterms:title>([\s\S]*?)<\/dcterms:title>/);
    if (!title) return null;
    return {
      title,
      authors: all(/<pgterms:name>([\s\S]*?)<\/pgterms:name>/g),
      languages: all(/<rdf:value[^>]*>([a-z]{2,3})<\/rdf:value>/g).slice(0, 2),
      subjects: all(/<rdf:value>([^<]{3,})<\/rdf:value>/g)
        .filter((v) => !/^[a-z]{2,3}$/.test(v))
        .slice(0, 10),
    };
  } catch {
    return null;
  }
}

/** Candidate plain-text URLs, most preferred first. */
function textUrls(id: number): string[] {
  return [
    `${GUTENBERG_BASE}/cache/epub/${id}/pg${id}.txt`,
    `${GUTENBERG_BASE}/files/${id}/${id}-0.txt`,
    `${GUTENBERG_BASE}/ebooks/${id}.txt.utf-8`,
  ];
}

const START_MARKER = /^\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*$/im;
const END_MARKER = /^\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*$/im;

/** Strips the Project Gutenberg licence header and footer. */
function stripBoilerplate(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n");
  const start = START_MARKER.exec(text);
  if (start) text = text.slice(start.index + start[0].length);
  const end = END_MARKER.exec(text);
  if (end) text = text.slice(0, end.index);
  // Some texts repeat a transcriber note block right after the marker.
  return text.replace(/^\s*\n+/, "").replace(/\n{4,}/g, "\n\n\n");
}

/** Matches a standalone chapter/part/letter/book heading line. */
const HEADING = /^\s{0,8}((?:chapter|letter|part|book|canto|act|scene|volume)\s+[a-z0-9ivxlcdm]+\.?)\s*$/i;

/** Turns a run of source lines into markdown paragraphs. */
function toMarkdown(lines: string[]): string {
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.trim().length === 0) {
      if (current.length > 0) {
        paragraphs.push(current.join(" ").replace(/\s+/g, " ").trim());
        current = [];
      }
    } else {
      current.push(line.trim());
    }
  }
  if (current.length > 0) paragraphs.push(current.join(" ").replace(/\s+/g, " ").trim());
  return paragraphs.filter((p) => p.length > 0).join("\n\n");
}

function countWords(s: string): number {
  const m = s.match(/\S+/g);
  return m ? m.length : 0;
}

/**
 * Splits cleaned text into chapters on standalone headings. When a book has no
 * recognisable headings, the whole body is returned as a single chapter — the
 * caller still gets the complete text either way.
 */
function chapterize(text: string): { frontMatter: string | null; chapters: Chapter[] } {
  const lines = text.split("\n");
  const marks: { line: number; title: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = HEADING.exec(lines[i]);
    // A heading is preceded and followed by blank space in Gutenberg texts.
    const prevBlank = i === 0 || lines[i - 1].trim() === "";
    const nextBlank = i + 1 >= lines.length || lines[i + 1].trim() === "";
    if (m && prevBlank && nextBlank) {
      marks.push({ line: i, title: m[1].replace(/\.$/, "").trim() });
    }
  }

  if (marks.length === 0) {
    const markdown = toMarkdown(lines);
    return {
      frontMatter: null,
      chapters: [{ index: 1, title: "Full text", markdown, wordCount: countWords(markdown) }],
    };
  }

  const frontLines = lines.slice(0, marks[0].line);
  const frontMarkdown = toMarkdown(frontLines);

  const chapters: Chapter[] = marks.map((mark, i) => {
    const from = mark.line + 1;
    const to = i + 1 < marks.length ? marks[i + 1].line : lines.length;
    const markdown = toMarkdown(lines.slice(from, to));
    return {
      index: i + 1,
      title: mark.title,
      markdown,
      wordCount: countWords(markdown),
    };
  });

  return {
    frontMatter: frontMarkdown.length > 0 ? frontMarkdown : null,
    chapters,
  };
}

/**
 * Buys one book: fetches the Project Gutenberg plain text, strips the licence
 * boilerplate, splits it into chapters, and returns the whole thing as
 * markdown. This is the artifact — it is returned in the 200 body.
 */
export async function readBook(gutenbergId: number): Promise<BookText | null> {
  let raw: string | null = null;
  let usedUrl = "";
  for (const url of textUrls(gutenbergId)) {
    try {
      const res = await get(url, "text/plain");
      if (res.ok) {
        const body = await res.text();
        // Gutenberg serves an HTML error page with 200 for unknown ids.
        if (body.length > 2000 && !body.trimStart().startsWith("<")) {
          raw = body;
          usedUrl = url;
          break;
        }
      }
    } catch {
      /* try the next candidate URL */
    }
  }
  if (raw == null) return null;

  const meta = await gutenbergMetadata(gutenbergId);
  const cleaned = stripBoilerplate(raw);
  const { frontMatter, chapters } = chapterize(cleaned);
  const wordCount = chapters.reduce((n, c) => n + c.wordCount, 0) + countWords(frontMatter ?? "");

  return {
    source: "gutenberg",
    gutenbergId,
    title: meta?.title ?? `Project Gutenberg eBook ${gutenbergId}`,
    authors: meta?.authors ?? [],
    languages: meta?.languages ?? [],
    subjects: meta?.subjects ?? [],
    textUrl: usedUrl,
    gutenbergUrl: `${GUTENBERG_BASE}/ebooks/${gutenbergId}`,
    rights:
      "Public domain in the USA. Project Gutenberg licence applies to the source file; the cleaned text is derived from it.",
    chapterCount: chapters.length,
    wordCount,
    frontMatter,
    chapters,
    retrievedAt: new Date().toISOString(),
  };
}
