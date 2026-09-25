import type { IconDefinition } from '@fortawesome/free-solid-svg-icons';

/**
 * A Font Awesome (Free, solid) icon as inline SVG: the icon's own path data rendered directly, so
 * there's no icon runtime or font to load, and only the icons actually imported are bundled.
 * Decorative by default (hidden from assistive tech: the control carries the accessible name).
 * Icons: Font Awesome Free by Fonticons, Inc. (CC BY 4.0) — see assets-src/CREDITS.md.
 */
export function Icon({ icon, className, title }: { icon: IconDefinition; className?: string; title?: string }) {
  const [w, h, , , path] = icon.icon;
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox={`0 0 ${w} ${h}`}
      width="1em"
      height="1em"
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      data-icon={icon.iconName}
    >
      {title && <title>{title}</title>}
      {Array.isArray(path) ? path.map((d, i) => <path key={i} d={d} />) : <path d={path} />}
    </svg>
  );
}
