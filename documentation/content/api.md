# Content API contract

The contract a backend implements so the site can read content from it, and the mock file layout that implements the same contract today. The resources are defined in the [content model](model.md); how the site uses the API is in the [spec](spec.md#4-the-source-adapter).

> **TL;DR.**
> - **Shape:** read-only REST over HTTPS and JSON, versioned in the path (`/v1/`), with additive changes only within a version.
> - **Endpoints:** one per content item type (`/v1/articles/{id}`, `/v1/case-studies/{id}`, …), one per channel structure (`/v1/structures/site`, `/v1/structures/planet`), plus `/v1/routes`, the route table derived from the site structure.
> - **Responses:** lists come in a `{ data, meta, links }` envelope with page-based paging, filters and `include` expansion. Errors are RFC 9457 problem details. Caching uses `ETag` and `If-None-Match`.
> - **Auth:** public content needs a read token; drafts need a separate preview token. A publish sends a signed webhook, which becomes a GitHub `repository_dispatch` and a rebuild.
> - **The mock API** is the `content/` folder: every endpoint maps to one file, and list endpoints are that folder with the same query semantics (shared code). A mock server serves the folder over HTTP to prove the two agree.

## 1. Principles

- **Read-only for the site.** The site only reads. Writing belongs to the backend's own editing tools, which this contract doesn't cover.
- **Resources are the model's resources,** in the same shape. There's no separate "API view", so a response can be saved as a file and read back by the `files` adapter unchanged.
- **Additive within a version.** Adding a field, a resource or an enum value is allowed in `/v1`. Removing or renaming one, or changing a type or a meaning, needs `/v2`. The site's schemas ignore unknown fields from the API, so additions never break a build.
- **Boring and cacheable.** Plain `GET`s, strong `ETag`s, no GraphQL. A portfolio is dozens of documents, not millions.

## 2. Conventions

| Topic | Convention |
|---|---|
| Base URL | `CONTENT_API_URL`, for example `https://content.example.com`; paths start with `/v1/` |
| Format | `application/json; charset=utf-8`; errors are `application/problem+json` |
| Auth | `Authorization: Bearer <token>`. The **read token** sees `published` and `stale` resources in public visibilities. The **preview token** also sees drafts and review states. Neither is ever sent to a browser |
| Lists | `GET /v1/{collection}` returns `{ data: [...], meta: { page, pageSize, total }, links: { self, next, prev } }` |
| Paging | `page` (from 1) and `pageSize` (default 50, at most 100) |
| Filtering | `filter[field]=value`, for example `filter[practiceArea]=product-experience`, `filter[featured]=home`, `filter[slug]=…`; repeat a filter for "any of" |
| Sorting | `sort=field` or `sort=-field` (descending), comma-separated; the default is `order`, then `title` |
| Expansion | `include=media,people,terms` adds `included: { media: {…}, people: {…} }` keyed by ID, so one request can render a page |
| Changes since | `filter[updatedSince]=2026-09-01T00:00:00Z`, for incremental loads |
| Caching | Every response has a strong `ETag` and `Last-Modified`; the site sends `If-None-Match` and accepts `304 Not Modified` |
| Rate limits | `429` with `Retry-After` (seconds); the adapter waits and retries up to three times |
| Localisation | `locale=en` (the only value today) |
| Time | ISO 8601 in UTC |

## 3. Resources

| Method and path | Returns | Notes |
|---|---|---|
| `GET /v1/site` | Site | The settings resource |
| `GET /v1/structures/{channel}` | Structure | `site`: the page tree and the menus ([structures §2](ia.md#2-the-site-structure)); `planet`: the places ([structures §5](ia.md#5-the-planet-structure)) |
| `GET /v1/routes` | Route[] | Derived from the site structure: every built path, its node, item, template and breadcrumbs ([structures §3](ia.md#3-routes)) |
| `GET /v1/articles` and `/v1/articles/{id}` | Article | Filters: `kind` (`page`, `note`, `talk`), `topic` |
| `GET /v1/case-studies` and `/v1/case-studies/{id}` | Case study | Filters: `practiceArea`, `featured`, `contribution`, `outcomeType` |
| `GET /v1/practice-areas` and `/v1/practice-areas/{id}` | Practice area | |
| `GET /v1/leadership-topics` and `/v1/leadership-topics/{id}` | Leadership topic | |
| `GET /v1/galleries` and `/v1/galleries/{id}` | Gallery | |
| `GET /v1/resume` | Résumé | A single resource |
| `GET /v1/vocabularies/{name}` | Term[] | `contributions`, `outcome-types`, `engagement-types`, `tools`, `topics` |
| `GET /v1/people` and `/v1/people/{id}` | Person | |
| `GET /v1/media/{id}` | Media | The ID may contain slashes (`case-studies/x/cover`); includes the master's URL, size and type |
| `GET /v1/redirects` | Redirect[] | |

A request for a missing resource, or one the token can't see, returns `404` (not `403`), so the API doesn't reveal what exists.

## 4. Examples

**One resource** (`GET /v1/case-studies/design-system-at-scale?include=media`):

```json
{
  "data": { "id": "design-system-at-scale", "type": "caseStudy", "title": "…", "cover": "case-studies/design-system-at-scale/cover", "…": "…" },
  "included": {
    "media": {
      "case-studies/design-system-at-scale/cover": {
        "id": "case-studies/design-system-at-scale/cover",
        "kind": "image",
        "url": "https://content.example.com/files/case-studies/design-system-at-scale/cover.jpg",
        "width": 2400, "height": 1600, "mime": "image/jpeg",
        "alt": "…", "focus": "50% 40%"
      }
    }
  }
}
```

**A list** (`GET /v1/case-studies?filter[featured]=home&sort=featured.home`):

```json
{
  "data": [{ "id": "core-productivity-flow", "…": "…" }, { "id": "design-system-at-scale", "…": "…" }],
  "meta": { "page": 1, "pageSize": 50, "total": 2 },
  "links": { "self": "/v1/case-studies?filter[featured]=home&sort=featured.home&page=1" }
}
```

**An error** (RFC 9457):

```json
{
  "type": "https://content.example.com/problems/not-found",
  "title": "Not found",
  "status": 404,
  "detail": "No case study with the ID 'design-system-at-scale' is visible to this token.",
  "instance": "/v1/case-studies/design-system-at-scale"
}
```

## 5. Webhooks and rebuilding

When content or media is published, unpublished or changed, the backend sends a webhook. A small relay (or the backend itself) turns it into a GitHub `repository_dispatch`, which starts the deploy workflow.

| Event | Sent when | Result |
|---|---|---|
| `content.published` | A resource becomes `published`, or a published one changes | Rebuild |
| `content.unpublished` | A published resource is archived or withdrawn | Rebuild |
| `structure.updated` | A channel's structure (`site` or `planet`) changes | Rebuild |
| `media.updated` | A media file or its metadata changes | Rebuild |

- **Payload:** `{ "event": "content.published", "type": "caseStudy", "id": "…", "at": "…" }`.
- **Signature:** an `X-Signature-256: sha256=<HMAC>` header over the body, with a shared secret. The relay rejects unsigned or stale deliveries (older than five minutes).
- **Dispatch:** `POST https://api.github.com/repos/prabinpebam/atiya/dispatches` with `{ "event_type": "content-published", "client_payload": { … } }`. It needs a fine-grained token with *Contents: read and write* on this repository only, held by the relay, never by the site.
- **Batching:** several events within a minute cause one build; the workflow uses a concurrency group, so a newer build cancels an older one in progress.

## 6. The mock API: files that mirror it

The `content/` folder is the mock API. Every endpoint maps to a file with exactly that endpoint's `data`:

```text
content/
├── site.json                                  GET /v1/site
├── structures/site.json                       GET /v1/structures/site
├── structures/planet.json                     GET /v1/structures/planet
├── articles/{id}.json                         GET /v1/articles/{id}
├── case-studies/{id}.json                     GET /v1/case-studies/{id}
├── practice-areas/{id}.json                   GET /v1/practice-areas/{id}
├── leadership-topics/{id}.json                GET /v1/leadership-topics/{id}
├── galleries/{id}.json                        GET /v1/galleries/{id}
├── resume.json                                GET /v1/resume
├── vocabularies/{name}.json                   GET /v1/vocabularies/{name}
├── people/{id}.json                           GET /v1/people/{id}
├── redirects.json                             GET /v1/redirects
└── media/{id}.json + media/{id}.{ext}         GET /v1/media/{id} and its master (see media)
```

- **Lists** (`GET /v1/case-studies`) are the folder. The `files` adapter reads every file in it and applies the same filter, sort and paging functions the mock server uses (`src/site/content/query.ts`), so the semantics can't drift.
- **`/v1/routes`** is derived from the site structure and the items it maps by shared code, in the adapter and in the mock server alike.
- **Media URLs.** In a file, a media resource names its master by a relative `file`. The mock server turns it into a `url`, as the real API would.
- **The mock server** (`npm run content:serve`, phase 3) serves `content/` as `/v1/…` with the envelopes, filters, ETags and errors above. The contract test runs the `api` adapter against it and compares every resource with the `files` adapter's result.
- **Snapshot.** `npm run content:snapshot` does the opposite: it reads a real API and writes this layout ([spec §6](spec.md#6-publishing-rebuilding-and-previews)).

## 7. Versioning and documentation

- **An OpenAPI 3.1 description** of this contract (`content/openapi.yaml`) is generated from the same Zod schemas in phase 3, so the backend can be built and tested against it. The JSON Schemas of each resource (`content/schema/*.schema.json`) are generated too, for editors and for the backend's own validation.
- **Deprecation.** A field that `/v2` will remove is marked `deprecated: true` in the OpenAPI description for at least one release before `/v2` ships. `/v1` keeps serving until the site's `api` adapter has moved.
