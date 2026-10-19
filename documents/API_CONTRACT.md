# API Contract (Planned — Not Currently Connected)

> **⚠️ All endpoints documented here are `planned-not-connected`. The current frontend uses local Dexie implementations exclusively. No remote calls are made.**

## Base URL

```
https://api.example.invalid/kirana-iq/v1
```

## Authentication

Future versions may use token-based auth. Current local app has no auth.

## Endpoints

### Products

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/products` | List products with filters |
| `POST` | `/products` | Create product + first variant |
| `GET` | `/products/:id` | Get product detail (variants, stock, batches, movements) |
| `PATCH` | `/products/:id` | Update product fields |
| `PATCH` | `/products/:id/variants/:vid` | Update variant fields |

**Filters:** `search`, `category`, `status`, `sort`, `includeInactive`

### Inventory

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/inventory` | All variant stock levels (total, usable, expired) |
| `GET` | `/inventory/:variantId` | Single variant stock |

### Stock Movements

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/stock-movements` | Filtered movement history |
| `POST` | `/stock-movements` | Record correction (append-only) |

**Filters:** `variantId`, `movementType`, `from`, `to`

### Sales

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sales` | Record sale (atomic: sale + movements + batch consumption) |
| `GET` | `/sales` | List sales (paginated) |
| `GET` | `/sales/:id` | Single sale detail |

### Purchases

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/purchases` | Receive stock (creates batch if expiry tracked) |
| `GET` | `/purchases` | List purchases (paginated) |

### Alerts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/alerts` | All alerts (low stock, expiry, slow-moving) |
| `GET` | `/expiry-batches` | Batches with expiry risk |
| `GET` | `/slow-moving-products` | Slow-moving list |

### Restock Planning

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/purchase-plans/preview` | Generate budget-constrained plan |
| `GET` | `/purchase-plans` | List saved plans |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/settings` | Current settings |
| `PUT` | `/settings` | Update settings |

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness/readiness probe |

---

## Request/Response Shapes

### Product (Create)
```json
{
  "name": "Sona Masoori Rice",
  "category": "rice-grains",
  "unit": "kg",
  "reorderThreshold": 8,
  "expiryTracked": false,
  "supplier": "Chennai Wholesale",
  "variant": {
    "name": "5 kg bag",
    "packSize": 5,
    "sellingPrice": 42000,
    "costPrice": 38500,
    "barcode": "8901030512340"
  },
  "initialStock": 12
}
```

### Sale (Create)
```json
{
  "items": [
    { "variantId": "var_123", "quantity": 3, "unitPrice": 8800 }
  ]
}
```

### Purchase (Receive)
```json
{
  "variantId": "var_123",
  "quantity": 12,
  "unitCost": 7800,
  "supplier": "Chennai Wholesale",
  "purchaseDate": "2026-10-15",
  "trackBatch": true,
  "batchCode": "B-RICE-001",
  "expiryDate": "2027-01-15"
}
```

### Restock Preview (Request)
```json
{
  "budget": 500000,
  "overrides": { "var_123": 10 },
  "excluded": { "var_456": true }
}
```

### Restock Plan (Response)
```json
{
  "id": "plan_abc123",
  "budget": 500000,
  "items": [
    {
      "variantId": "var_123",
      "productId": "prod_1",
      "productName": "Sona Masoori Rice",
      "variantName": "5 kg bag",
      "recommendedQuantity": 8,
      "quantity": 8,
      "unitCost": 38500,
      "lineTotal": 308000,
      "priority": 1,
      "reasons": ["low-stock", "high-sales"],
      "included": true,
      "budgetAdjusted": false
    }
  ],
  "estimatedTotal": 308000,
  "remainingBudget": 192000,
  "status": "draft",
  "createdAt": "2026-10-19T10:00:00.000Z",
  "assumptions": {
    "lookbackDays": 30,
    "leadTimeDays": 7,
    "safetyDays": 3,
    "currency": "INR",
    "generatedAt": "2026-10-19T10:00:00.000Z"
  }
}
```

---

## Error Format

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Not enough stock. You have 5, you asked for 10.",
    "params": { "available": 5, "requested": 10 }
  }
}
```

## Versioning

- API version in URL path: `/v1/`
- Breaking changes → new version (`/v2/`)
- Backward compatibility maintained for 12 months