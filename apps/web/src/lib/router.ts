import { useSyncExternalStore } from 'react';

/** Hash routes: work on GitHub Pages, from a file, and inside the Android WebView. */
export type Route =
  | { name: 'home' }
  | { name: 'item'; id: string }
  | { name: 'collections' }
  | { name: 'collection'; id: string }
  | { name: 'settings' }
  | { name: 'privacy' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'item':
      return parts[1] ? { name: 'item', id: parts[1] } : { name: 'home' };
    case 'collections':
      return parts[1] ? { name: 'collection', id: parts[1] } : { name: 'collections' };
    case 'settings':
      return { name: 'settings' };
    case 'privacy':
      return { name: 'privacy' };
    default:
      return { name: 'home' };
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'item':
      return `#/item/${encodeURIComponent(route.id)}`;
    case 'collections':
      return '#/collections';
    case 'collection':
      return `#/collections/${encodeURIComponent(route.id)}`;
    case 'settings':
      return '#/settings';
    case 'privacy':
      return '#/privacy';
    default:
      return '#/';
  }
}

export function navigate(route: Route): void {
  window.location.hash = href(route).slice(1);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    (cb) => {
      window.addEventListener('hashchange', cb);
      return () => window.removeEventListener('hashchange', cb);
    },
    () => window.location.hash,
  );
  return parseHash(hash);
}
