/**
 * The site's icons (tier 0, with the tokens): Font Awesome Free *solid*, the same set the game uses,
 * as data. Components draw them as inline SVG (`svgOf`), so the icons render on the server and no icon
 * font or CDN is ever loaded. Add an icon here by name before using it; the design library shows them
 * all (/design/tokens/icons/). Docs: documentation/site-ui/design-system.md §2.
 */
import {
  faArrowLeft,
  faArrowRight,
  faArrowUpRightFromSquare,
  faCheck,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faChevronUp,
  faCircleCheck,
  faCircleExclamation,
  faCircleHalfStroke,
  faCircleInfo,
  faCompress,
  faDesktop,
  faExpand,
  faGlobe,
  faImages,
  faMagnifyingGlass,
  faMinus,
  faMoon,
  faPause,
  faPlay,
  faPlus,
  faQuoteLeft,
  faBars,
  faSun,
  faXmark,
  faVolumeHigh,
  faVolumeXmark,
  faArrowDown,
  faCopy,
} from '@fortawesome/free-solid-svg-icons';

export interface IconDef {
  iconName: string;
  icon: [number, number, unknown, unknown, string | string[]];
}

export const ICONS = {
  'arrow-left': faArrowLeft,
  'arrow-right': faArrowRight,
  'arrow-down': faArrowDown,
  'external': faArrowUpRightFromSquare,
  check: faCheck,
  'chevron-down': faChevronDown,
  'chevron-left': faChevronLeft,
  'chevron-right': faChevronRight,
  'chevron-up': faChevronUp,
  success: faCircleCheck,
  error: faCircleExclamation,
  info: faCircleInfo,
  'theme-system': faCircleHalfStroke,
  'theme-light': faSun,
  'theme-dark': faMoon,
  desktop: faDesktop,
  expand: faExpand,
  compress: faCompress,
  planet: faGlobe,
  gallery: faImages,
  search: faMagnifyingGlass,
  minus: faMinus,
  plus: faPlus,
  play: faPlay,
  pause: faPause,
  quote: faQuoteLeft,
  menu: faBars,
  close: faXmark,
  copy: faCopy,
  'sound-on': faVolumeHigh,
  'sound-off': faVolumeXmark,
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

export interface SvgData {
  viewBox: string;
  d: string;
  name: string;
}

/** An icon as the parts of an inline <svg>: its viewBox, its path and its Font Awesome name. */
export function svgOf(name: IconName): SvgData {
  const def = ICONS[name] as IconDef;
  const [w, h, , , path] = def.icon;
  return { viewBox: `0 0 ${w} ${h}`, d: Array.isArray(path) ? path.join(' ') : path, name: def.iconName };
}
