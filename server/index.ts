import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBackendEnv } from './env';
import { pool, trackedQuery } from './db';
import type { BranchInfo, OperationInfo, MainOrderRow, AssetFamilySummary } from './types';
import { createTTLCache } from './cache';

loadBackendEnv();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize query count per request
app.use((_req, res, next) => {
  res.locals.queryCount = 0;
  next();
});

// Middleware to inject the header at the end of every request
app.use((_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.setHeader('X-DB-Query-Count', String(res.locals.queryCount || 0));
    return originalJson(body);
  };
  next();
});

const PORT = Number(process.env.PORT || '3001');

function envInt(name: string, def: number) {
  const raw = process.env[name];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : def;
}

const TTL_DEFAULT_MS = envInt('CACHE_TTL_MS', 60_000);

const HOME_TTL_MS = envInt('HOME_CACHE_TTL_MS', 86_400_000);

const ORDERS_TTL_MS = envInt('ORDERS_CACHE_TTL_MS', TTL_DEFAULT_MS);
const ASSETS_TTL_MS = envInt('ASSETS_CACHE_TTL_MS', TTL_DEFAULT_MS);

const branchesCache = createTTLCache(HOME_TTL_MS);
const branchInfoCache = createTTLCache(HOME_TTL_MS);

const operationsCache = createTTLCache(HOME_TTL_MS);
const operationInfoCache = createTTLCache(HOME_TTL_MS);

const ordersCache = createTTLCache(ORDERS_TTL_MS);
const allOrdersCache = createTTLCache(ORDERS_TTL_MS); // Master cache for all active orders
const assetsSummaryCache = createTTLCache(ASSETS_TTL_MS);

function normalizeRoute(raw: string): string {
  return String(raw || '').replace(/\s+/g, '').trim();
}

function setCacheHeaders(
  res: express.Response,
  meta: { hit: boolean; stale: boolean; ageMs: number; ttlMs: number }
) {
  res.setHeader('X-Cache', meta.stale ? 'STALE' : meta.hit ? 'HIT' : 'MISS');
  res.setHeader('X-Cache-Age', String(Math.floor(meta.ageMs / 1000)));
  res.setHeader('X-Cache-TTL', String(Math.floor(meta.ttlMs / 1000)));
}

const COMPANY_SQL = `LPAD(CAST(company AS CHAR), 2, '0')`;
const BRANCH_SQL = `LPAD(CAST(branch AS CHAR), 2, '0')`;
const BRANCH_ROUTE_SQL = `CONCAT(${COMPANY_SQL}, ${BRANCH_SQL})`;
const BRANCH_DISPLAY_SQL = `CONCAT(${COMPANY_SQL}, ' ', ${BRANCH_SQL})`;

app.get('/', (_req, res) => {
  res.send(
    'OM Digital API OK. Use /api/health, /api/branches, /api/operations, /api/orders/branch/:branchRoute, /api/orders/operation/:operationCode, /api/assets/summary/branch/:branchRoute, /api/assets/summary/operation/:operationCode'
  );
});

app.get('/api/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'db_error' });
  }
});

app.get('/api/branches', async (_req, res) => {
  try {
    const meta = await branchesCache.get<BranchInfo[]>('branches:list', async () => {
      const [rows] = await trackedQuery(
        `
        SELECT
          REPLACE(branch, ' ', '') AS branch_route,
          branch,
          SUBSTRING_INDEX(GROUP_CONCAT(branch_name ORDER BY end_prev_datetime ASC SEPARATOR '@@@'), '@@@', 1) AS branch_name
        FROM om_digital.main_order_view
        WHERE branch IS NOT NULL
          AND branch_name IS NOT NULL
          AND status NOT IN ('8','9','2','7','3')
        GROUP BY branch
        ORDER BY branch_route ASC
        `,
        [],
        res.locals as { queryCount: number }
      );

      return rows as BranchInfo[];
    });

    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, stale-while-revalidate=60, stale-if-error=86400'
    );
    setCacheHeaders(res, meta);
    res.json(meta.data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'branches_error' });
  }
});

app.get('/api/branches/:branchRoute', async (req, res) => {
  const branchRoute = normalizeRoute(req.params.branchRoute || '');
  if (!branchRoute) return res.status(400).json({ error: 'branchRoute_required' });

  try {
    const meta = await branchInfoCache.get<BranchInfo | null>(`branch:${branchRoute}`, async () => {
      const [rows] = await trackedQuery(
        `
        SELECT
          REPLACE(branch, ' ', '') AS branch_route,
          branch,
          branch_name
        FROM om_digital.main_order_view
        WHERE REPLACE(branch, ' ', '') = ?
          AND branch_name IS NOT NULL
          AND status NOT IN ('8','9','2','7','3')
        ORDER BY end_prev_datetime ASC
        LIMIT 1
        `,
        [branchRoute],
        res.locals as { queryCount: number }
      );

      const result = (rows as BranchInfo[])[0];
      return result ?? null;
    });

    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, stale-while-revalidate=60, stale-if-error=86400'
    );
    setCacheHeaders(res, meta);
    if (!meta.data) return res.status(404).json({ error: 'branch_not_found' });
    return res.json(meta.data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'branch_error' });
  }
});

app.get('/api/operations', async (_req, res) => {
  try {
    const meta = await operationsCache.get<OperationInfo[]>('operations:list', async () => {
      const [rows] = await trackedQuery(
        `
        SELECT
          CAST(operation_code AS CHAR) AS operation_code,
          operation
        FROM om_digital.operation_view
        WHERE company IS NOT NULL
          AND operation_code IS NOT NULL
          AND operation IS NOT NULL
        GROUP BY operation_code, operation
        ORDER BY operation_code ASC
        `,
        [],
        res.locals as { queryCount: number }
      );

      return rows as OperationInfo[];
    });

    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, stale-while-revalidate=60, stale-if-error=86400'
    );
    setCacheHeaders(res, meta);
    res.json(meta.data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'operations_error' });
  }
});

app.get('/api/operations/:operationCode', async (req, res) => {
  const operationCode = normalizeRoute(req.params.operationCode || '');
  if (!operationCode) return res.status(400).json({ error: 'operationCode_required' });

  try {
    const meta = await operationInfoCache.get<OperationInfo | null>(
      `op:${operationCode}`,
      async () => {
        const [rows] = await trackedQuery(
          `
          SELECT
            CAST(operation_code AS CHAR) AS operation_code,
            operation
          FROM om_digital.operation_view
          WHERE operation_code = ?
            AND operation IS NOT NULL
          ORDER BY \`datetime\` DESC
          LIMIT 1
          `,
          [operationCode],
          res.locals as { queryCount: number }
        );

        const result = (rows as OperationInfo[])[0];
        return result ?? null;
      }
    );

    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, stale-while-revalidate=60, stale-if-error=86400'
    );
    setCacheHeaders(res, meta);
    if (!meta.data) return res.status(404).json({ error: 'operation_not_found' });
    return res.json(meta.data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'operation_error' });
  }
});

const PLATE_NORM_SQL = `REPLACE(REPLACE(plate, '-', ''), ' ', '')`;

app.get('/api/assets/summary/branch/:branchRoute', async (req, res) => {
  const branchRoute = normalizeRoute(req.params.branchRoute || '');
  if (!branchRoute) return res.status(400).json({ error: 'branchRoute_required' });

  try {
    const meta = await assetsSummaryCache.get<AssetFamilySummary[]>(
      `assets:summary:branch:${branchRoute}`,
      async () => {
        const [rows] = await trackedQuery(
          `
          SELECT
            family,
            family_name,
            COUNT(DISTINCT ${PLATE_NORM_SQL}) AS total_plates
          FROM om_digital.asset_view
          WHERE CONCAT(LPAD(CAST(company AS CHAR), 2, '0'), LPAD(CAST(branch AS CHAR), 2, '0')) = ?
            AND plate IS NOT NULL
          GROUP BY family, family_name
          ORDER BY total_plates DESC
          `,
          [branchRoute],
          res.locals as { queryCount: number }
        );
        return rows as AssetFamilySummary[];
      }
    );

    setCacheHeaders(res, meta);
    res.json(meta.data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'assets_summary_branch_error' });
  }
});

app.get('/api/assets/summary/operation/:operationCode', async (req, res) => {
  const operationCode = normalizeRoute(req.params.operationCode || '');
  if (!operationCode) return res.status(400).json({ error: 'operationCode_required' });

  try {
    const meta = await assetsSummaryCache.get<AssetFamilySummary[]>(
      `assets:summary:operation:${operationCode}`,
      async () => {
        const [rows] = await trackedQuery(
          `
          SELECT
            REPLACE(UPPER(TRIM(family)), ' ', '') AS family,
            UPPER(TRIM(family_name)) AS family_name,
            COUNT(DISTINCT plate) AS total_plates
          FROM om_digital.asset_view
          WHERE operation_code = ?
            AND plate IS NOT NULL
          GROUP BY family, family_name
          ORDER BY total_plates DESC
          `,
          [operationCode],
          res.locals as { queryCount: number }
        );
        return rows as AssetFamilySummary[];
      }
    );

    setCacheHeaders(res, meta);
    res.json(meta.data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'assets_summary_operation_error' });
  }
});

app.get('/api/orders/all', async (_req, res) => {
  try {
    const meta = await allOrdersCache.get<MainOrderRow[]>('all_orders', async () => {
      return fetchAllActiveOrders(res.locals as { queryCount: number });
    });

    res.setHeader(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=120, stale-if-error=600'
    );
    setCacheHeaders(res, meta);
    res.json(meta.data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'all_orders_error' });
  }
});

// Helper to fetch all active orders from database once
async function fetchAllActiveOrders(resLocals: { queryCount: number }): Promise<MainOrderRow[]> {
  const [rows] = await trackedQuery(
    `
    SELECT
      id, \`number\`, asset_code, asset_plate, asset_family_name,
      REPLACE(branch, ' ', '') AS branch_route, branch, asset_branch_name AS branch_name,
      CAST(operation_code AS CHAR) AS operation_code, operation, group_branch,
      service_code, status_description, status, \`datetime\` AS INICIOPARADA,
      end_prev_datetime AS PREVTERMINO, resp_register_name
    FROM om_digital.main_order_view
    WHERE status NOT IN ('8','9','2','7','3')
    ORDER BY end_prev_datetime ASC
    `,
    [],
    resLocals
  );
  return rows as MainOrderRow[];
}

app.get('/api/orders/branch/:branchRoute', async (req, res) => {
  const branchRoute = normalizeRoute(req.params.branchRoute || '');
  if (!branchRoute) return res.status(400).json({ error: 'branchRoute_required' });

  try {
    const meta = await allOrdersCache.get<MainOrderRow[]>('all_orders', async () => {
      return fetchAllActiveOrders(res.locals as { queryCount: number });
    });

    const filtered = meta.data.filter((o) => o.branch_route === branchRoute);

    setCacheHeaders(res, meta);
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'orders_branch_error' });
  }
});

app.get('/api/orders/operation/:operationCode', async (req, res) => {
  const operationCode = normalizeRoute(req.params.operationCode || '');
  if (!operationCode) return res.status(400).json({ error: 'operationCode_required' });

  try {
    const meta = await allOrdersCache.get<MainOrderRow[]>('all_orders', async () => {
      return fetchAllActiveOrders(res.locals as { queryCount: number });
    });

    const filtered = meta.data.filter((o) => o.operation_code === operationCode);

    setCacheHeaders(res, meta);
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'orders_operation_error' });
  }
});

app.get('/api/orders/:branchRoute', async (req, res) => {
  const branchRoute = normalizeRoute(req.params.branchRoute || '');
  if (!branchRoute) return res.status(400).json({ error: 'branchRoute_required' });

  try {
    const meta = await allOrdersCache.get<MainOrderRow[]>('all_orders', async () => {
      return fetchAllActiveOrders(res.locals as { queryCount: number });
    });

    const filtered = meta.data.filter((o) => o.branch_route === branchRoute);

    setCacheHeaders(res, meta);
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'orders_error' });
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '..', 'dist');

app.use('/mnt/disponibilidade', express.static(distPath));

app.get(['/mnt/disponibilidade', '/mnt/disponibilidade/*'], (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[om-digital] API server running on http://localhost:${PORT}`);
});