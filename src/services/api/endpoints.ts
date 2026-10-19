/**
 * FUTURE API endpoint registry — **planned, not currently connected**.
 *
 * The frontend never calls these endpoints. They document the contract a
 * future backend (or local HTTP bridge) would implement so that swapping
 * service implementations later is a configuration change, not a UI
 * rewrite. See docs/API_CONTRACT.md for request/response shapes.
 *
 * No endpoint string is scattered across UI components: screens use the
 * service interfaces from src/services/interfaces.ts exclusively.
 */

export interface EndpointDefinition {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Path template with `:param` placeholders. */
  path: string;
  /** Short description of purpose. */
  description: string;
  status: 'planned-not-connected';
}

export const API_BASE_URL_PLACEHOLDER = 'https://api.example.invalid/kirana-iq/v1';

export const ENDPOINTS = {
  listProducts: { method: 'GET', path: '/products', description: 'List products', status: 'planned-not-connected' },
  createProduct: { method: 'POST', path: '/products', description: 'Create product', status: 'planned-not-connected' },
  getProduct: { method: 'GET', path: '/products/:id', description: 'Get product detail', status: 'planned-not-connected' },
  updateProduct: { method: 'PATCH', path: '/products/:id', description: 'Update product', status: 'planned-not-connected' },
  listInventory: { method: 'GET', path: '/inventory', description: 'List inventory levels', status: 'planned-not-connected' },
  getInventory: { method: 'GET', path: '/inventory/:variantId', description: 'Get stock for a variant', status: 'planned-not-connected' },
  listStockMovements: { method: 'GET', path: '/stock-movements', description: 'List stock movements', status: 'planned-not-connected' },
  createStockMovement: { method: 'POST', path: '/stock-movements', description: 'Record movement/correction', status: 'planned-not-connected' },
  createSale: { method: 'POST', path: '/sales', description: 'Record a sale', status: 'planned-not-connected' },
  listSales: { method: 'GET', path: '/sales', description: 'List sales', status: 'planned-not-connected' },
  getSale: { method: 'GET', path: '/sales/:id', description: 'Get one sale', status: 'planned-not-connected' },
  createPurchase: { method: 'POST', path: '/purchases', description: 'Receive stock', status: 'planned-not-connected' },
  listPurchases: { method: 'GET', path: '/purchases', description: 'List purchases', status: 'planned-not-connected' },
  listAlerts: { method: 'GET', path: '/alerts', description: 'List all alerts', status: 'planned-not-connected' },
  listExpiryBatches: { method: 'GET', path: '/expiry-batches', description: 'List expiry batches', status: 'planned-not-connected' },
  listSlowMoving: { method: 'GET', path: '/slow-moving-products', description: 'List slow-moving products', status: 'planned-not-connected' },
  previewPurchasePlan: { method: 'POST', path: '/purchase-plans/preview', description: 'Preview restock plan', status: 'planned-not-connected' },
  getSettings: { method: 'GET', path: '/settings', description: 'Get settings', status: 'planned-not-connected' },
  updateSettings: { method: 'PUT', path: '/settings', description: 'Update settings', status: 'planned-not-connected' },
  health: { method: 'GET', path: '/health', description: 'Service health probe', status: 'planned-not-connected' },
} as const satisfies Record<string, EndpointDefinition>;

export type EndpointKey = keyof typeof ENDPOINTS;

/** Build a concrete path, e.g. `productDetail` → `/products/abc`. */
export function buildPath(key: EndpointKey, params: Record<string, string> = {}): string {
  let path: string = ENDPOINTS[key].path;
  for (const [name, value] of Object.entries(params)) {
    path = path.replace(`:${name}`, encodeURIComponent(value));
  }
  return path;
}
