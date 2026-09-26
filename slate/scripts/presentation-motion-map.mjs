import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export function buildMotionMap(motionPath) {
  const manifest = JSON.parse(fs.readFileSync(motionPath, "utf8"));
  return {
    version: 1,
    deckId: manifest.deckId,
    stage: manifest.stage || { width: 1600, height: 900 },
    transitions: manifest.transitions || {},
    slides: Object.entries(manifest.slides || {}).map(([slideId, slide]) => {
      const targets = slide.targets || [];
      const fragments = (slide.fragments || []).map(fragment => typeof fragment === "string" ? { id: fragment } : fragment);
      const firstFragment = fragments[0]?.id;
      const actions = fragments.map(fragment => {
        const owned = targets.filter(target => target.fragmentId === fragment.id);
        const offsets = owned.map(target => fragment.id === firstFragment ? (target.startMs || 0) : (target.revealOffsetMs || 0));
        const tailMs = owned.length ? Math.max(...owned.map((target, index) => offsets[index] + (target.durationMs || 420))) : 0;
        const staggerSpanMs = offsets.length ? Math.max(...offsets) - Math.min(...offsets) : 0;
        return { fragmentId: fragment.id, targetCount: owned.length, tailMs, staggerSpanMs, pacing: tailMs > 1200 ? "error" : tailMs > 700 ? "deliberate" : "preferred" };
      });
      const durationMs = slide.durationMs || Math.max(0, ...targets.map(target => (target.startMs || 0) + (target.durationMs || 0)), ...fragments.map(fragment => fragment.atMs || 0));
      return {
        slideId,
        durationMs,
        revisit: slide.revisit || manifest.defaultRevisit || "restore",
        fallback: slide.fallback || "end",
        fragments,
        actions,
        targets: targets.map(target => ({
          id: target.id,
          recipe: target.recipe,
          startMs: target.startMs || 0,
          durationMs: target.durationMs || 420,
          endMs: (target.startMs || 0) + (target.durationMs || 420),
        })),
        warnings: [
          ...(targets.length === 0 ? ["no explicit motion targets; runtime defaults may apply"] : []),
          ...(fragments.some(fragment => fragment.atMs == null) ? ["fragment timing omitted; semantic navigation still works"] : []),
        ],
      };
    }),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, match => match.slice(1)))) {
  const motionIndex = process.argv.indexOf("--motion");
  if (motionIndex < 0 || !process.argv[motionIndex + 1]) { console.error("Usage: node presentation-motion-map.mjs --motion <motion.json>"); process.exit(2); }
  console.log(JSON.stringify(buildMotionMap(path.resolve(process.argv[motionIndex + 1])), null, 2));
}
