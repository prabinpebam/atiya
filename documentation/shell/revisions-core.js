export const MAX_REVISION_BYTES = 8 * 1024 * 1024;
export const REVISION_ID = /^rev-[a-f0-9-]{36}$/;
const COMMENT_ID = /^comment-[a-f0-9-]{36}$/;
const SOURCE_ID = /^source-[a-f0-9-]{36}$/;
const HASH = /^[a-f0-9]{64}$/;
const SELECTOR = /^[a-z][a-z0-9-]*:nth-of-type\([1-9]\d*\)(?: > [a-z][a-z0-9-]*:nth-of-type\([1-9]\d*\))*$/;

export function safeContentPath(value) {
  return typeof value === 'string' && value.length <= 1024
    && !/[\\:%?#\u0000-\u001f]/.test(value)
    && /\.(?:md|html?)$/i.test(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..' && !part.startsWith('.'));
}

export function safeHostPath(value) {
  return value === '.' || (typeof value === 'string' && value.length <= 1024
    && !/[\\:%?#\u0000-\u001f]/.test(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..'));
}

export function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

export async function sha256(value) {
  if (!globalThis.crypto?.subtle) throw new Error('Revisions require HTTPS or a loopback HTTP address for source fingerprints.');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createRevision(now = new Date(), host = 'docs') {
  const timestamp = now.toISOString();
  return {
    schemaVersion: 1, kind: 'slate-revision', id: newId('rev'), host,
    name: `Revision ${now.toLocaleString()}`, status: 'active', version: 1,
    createdAt: timestamp, updatedAt: timestamp, archivedAt: null, resolution: null,
    sources: [], comments: [],
  };
}

export function revise(revision, change, now = new Date()) {
  const next = structuredClone(revision);
  change(next);
  next.version += 1;
  next.updatedAt = now.toISOString();
  return next;
}

export function archiveRevision(revision, summary, now = new Date()) {
  if (revision.status !== 'active') throw new Error('Reopen this revision before changing it.');
  if (!summary.trim()) throw new Error('A completion summary is required to archive a revision.');
  return revise(revision, next => {
    next.status = 'archived';
    next.archivedAt = now.toISOString();
    next.resolution = summary.trim();
    next.comments.forEach(comment => {
      if (comment.status === 'open') {
        comment.status = 'addressed';
        comment.updatedAt = now.toISOString();
      }
    });
  }, now);
}

export function reopenRevision(revision) {
  if (revision.status !== 'archived') throw new Error('Only an archived revision can be reopened.');
  return revise(revision, next => {
    next.status = 'active';
    next.archivedAt = null;
    next.resolution = null;
  });
}

export function validateRevision(revision) {
  function fail(message) { throw new Error(`Invalid revision: ${message}`); }
  function object(value, fields, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
    const keys = Object.keys(value);
    if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) fail(`${label} has missing or unknown fields`);
  }
  function text(value, max, label, empty = false) {
    if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) fail(`${label} must be ${empty ? 'a' : 'a nonempty'} string of at most ${max} characters`);
  }
  function timestamp(value, label) {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
        || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail(`${label} must be a UTC ISO timestamp`);
  }
  function integer(value, min, max, label) {
    if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${label} is outside ${min}..${max}`);
  }
  object(revision, ['schemaVersion', 'kind', 'id', 'host', 'name', 'status', 'version', 'createdAt', 'updatedAt', 'archivedAt', 'resolution', 'sources', 'comments'], 'root');
  if (revision.schemaVersion !== 1 || revision.kind !== 'slate-revision') fail('unsupported schema or kind');
  if (!REVISION_ID.test(revision.id)) fail('invalid id');
  if (!safeHostPath(revision.host)) fail('unsafe host path');
  text(revision.name, 200, 'name');
  if (!['active', 'archived'].includes(revision.status)) fail('invalid status');
  integer(revision.version, 1, Number.MAX_SAFE_INTEGER, 'version');
  timestamp(revision.createdAt, 'createdAt');
  timestamp(revision.updatedAt, 'updatedAt');
  if (revision.updatedAt < revision.createdAt) fail('updatedAt precedes createdAt');
  if (revision.status === 'archived') {
    timestamp(revision.archivedAt, 'archivedAt');
    text(revision.resolution, 20000, 'resolution');
    if (revision.archivedAt < revision.createdAt || revision.archivedAt > revision.updatedAt) fail('archive timestamp is outside the revision lifetime');
  } else if (revision.archivedAt !== null || revision.resolution !== null) fail('active revision cannot have archive metadata');
  if (!Array.isArray(revision.sources) || revision.sources.length > 128) fail('sources must be an array of at most 128 snapshots');
  const sourceIds = new Set();
  for (const source of revision.sources) {
    object(source, ['id', 'path', 'route', 'title', 'sha256', 'content'], 'source');
    if (!SOURCE_ID.test(source.id) || sourceIds.has(source.id)) fail('invalid or duplicate source id');
    sourceIds.add(source.id);
    if (!safeContentPath(source.path) || !safeContentPath(source.route)) fail('unsafe source path or route');
    text(source.title, 500, 'source title');
    text(source.content, 1000000, 'source content', true);
    if (!HASH.test(source.sha256)) fail('invalid source hash');
  }
  if (!Array.isArray(revision.comments) || revision.comments.length > 1000) fail('comments must be an array of at most 1000 entries');
  const commentIds = new Set();
  for (const comment of revision.comments) {
    object(comment, ['id', 'text', 'status', 'createdAt', 'updatedAt', 'targets'], 'comment');
    if (!COMMENT_ID.test(comment.id) || commentIds.has(comment.id)) fail('invalid or duplicate comment id');
    commentIds.add(comment.id);
    text(comment.text, 20000, 'comment text');
    if (!['open', 'addressed'].includes(comment.status)) fail('invalid comment status');
    if (revision.status === 'archived' && comment.status !== 'addressed') fail('archived revisions cannot contain open comments');
    timestamp(comment.createdAt, 'comment createdAt');
    timestamp(comment.updatedAt, 'comment updatedAt');
    if (comment.createdAt < revision.createdAt || comment.updatedAt < comment.createdAt || comment.updatedAt > revision.updatedAt) fail('comment timestamp is outside the revision lifetime');
    if (!Array.isArray(comment.targets) || !comment.targets.length || comment.targets.length > 100) fail('a comment requires 1..100 targets');
    const targets = new Set();
    for (const target of comment.targets) {
      object(target, ['sourceId', 'selector', 'ordinal', 'tag', 'elementId', 'text', 'html', 'sha256', 'occurrence', 'matches', 'headings', 'before', 'after'], 'target');
      if (!sourceIds.has(target.sourceId)) fail('target source is missing');
      if (typeof target.selector !== 'string' || target.selector.length > 4096 || !SELECTOR.test(target.selector)) fail('invalid selector');
      if (targets.has(`${target.sourceId}:${target.selector}`)) fail('duplicate target');
      targets.add(`${target.sourceId}:${target.selector}`);
      integer(target.ordinal, 0, 100000, 'ordinal');
      if (!/^[a-z][a-z0-9-]*$/.test(target.tag)) fail('invalid tag');
      text(target.elementId, 1024, 'element id', true);
      text(target.text, 1000000, 'target text', true);
      text(target.html, 1000000, 'target HTML');
      if (!HASH.test(target.sha256)) fail('invalid target hash');
      integer(target.matches, 1, 100000, 'matches');
      integer(target.occurrence, 1, target.matches, 'occurrence');
      text(target.before, 1000, 'before', true);
      text(target.after, 1000, 'after', true);
      if (!Array.isArray(target.headings) || target.headings.length > 6) fail('invalid heading context');
      for (const heading of target.headings) {
        object(heading, ['level', 'text', 'id'], 'heading');
        integer(heading.level, 1, 6, 'heading level');
        text(heading.text, 10000, 'heading text', true);
        text(heading.id, 1024, 'heading id', true);
      }
    }
  }
  if (new TextEncoder().encode(`${JSON.stringify(revision, null, 2)}\n`).length > MAX_REVISION_BYTES) fail('file exceeds 8 MiB');
  return revision;
}

export async function verifyRevision(revision) {
  validateRevision(revision);
  for (const source of revision.sources) {
    if (await sha256(source.content) !== source.sha256) throw new Error(`Source snapshot fingerprint mismatch: ${source.path}`);
  }
  for (const comment of revision.comments) {
    for (const target of comment.targets) {
      if (await sha256(target.html) !== target.sha256) throw new Error(`Block snapshot fingerprint mismatch: ${target.selector}`);
    }
  }
  return revision;
}
