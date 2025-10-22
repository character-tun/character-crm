import { NavItem } from './sidebarConfig';

// Точное сопоставление: активен если path === pathname
// или pathname лежит внутри пути секции: path + '/*'
export function isRouteActive(path?: string, pathname?: string): boolean {
  if (!path || !pathname) return false;
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(path + '/');
}

export type ActiveMatch = {
  sectionId: string | null;
  childId: string | null;
};

// Возвращает активный раздел и подпункт для текущего pathname
export function getActiveSection(items: NavItem[], pathname: string): ActiveMatch {
  let best: { sectionId: string; childId: string | null; score: number } | null = null;

  items.forEach((section) => {
    let score = 0;
    let childId: string | null = null;

    if (section.path && isRouteActive(section.path, pathname)) {
      score = section.path.length;
    }

    section.children?.forEach((c) => {
      if (c.path && pathname === c.path) {
        const s = c.path.length;
        if (s >= score) {
          score = s;
          childId = c.id;
        }
      }
    });

    if (score > 0) {
      if (!best || score > best.score) {
        best = { sectionId: section.id, childId, score };
      }
    }
  });

  return { sectionId: best ? best.sectionId : null, childId: best ? best.childId : null };
}