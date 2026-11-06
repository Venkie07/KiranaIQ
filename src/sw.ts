import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim, skipWaiting } from 'workbox-core';

declare const self: {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>;
  addEventListener(type: 'install' | 'activate', listener: () => void): void;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

const fallbackHandler = createHandlerBoundToURL('/index.html');
registerRoute(new NavigationRoute(fallbackHandler));

self.addEventListener('install', skipWaiting);
self.addEventListener('activate', clientsClaim);
