import express from 'express';
import cors from 'cors';
import { loadBackendEnv } from './env';
import { pool } from './db';
import type { BranchInfo, OperationInfo, MainOrderRow, AssetFamilySummary } from './types';
import { createTTLCache } from './cache';

loadBackendEnv();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || '3001');
const TTL_MS = 60_000;

const branchesCache = createTTLCache(TTL_MS);
const branchInfoCache = createTTLCache(TTL_MS);
const operationsCache = createTTLCache(TTL_MS);
const operationInfoCache = createTTLCache(TTL_MS);
const ordersCache = createTTLCache(TTL_MS);
const assetsSummaryCache = createTTLCache(TTL_MS);

function normalizeRoute(raw: string): string {
  return String(raw || '').replace(/\s+/g, '').trim();
}

function setCacheHeaders(
  res: express.Response,
  meta: { hit: boolean; stale: boolean; ageMs: number }
) {
  res.setHeader('X-Cache', meta.stale ? 'STALE' : meta.hit ? 'HIT' : 'MISS');
  res.setHeader('X-Cache-Age', String(Math.floor(meta.ageMs / 1000)));
}

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
      const [rows] = await pool.query(
        `
        SELECT
          REPLACE(branch, ' ', '') AS branch_route,
          branch,
          branch_name
        FROM om_digital.main_order_view
        WHERE branch IS NOT NULL
          AND branch_name IS NOT NULL
        GROUP BY REPLACE(branch, ' ', ''), branch, branch_name
        ORDER BY branch_route ASC
        `
      );
      return rows as BranchInfo[];
    });

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
      const [rows] = await pool.query(
        `
        SELECT
          REPLACE(branch, ' ', '') AS branch_route,
          branch,
          branch_name
        FROM om_digital.main_order_view
        WHERE REPLACE(branch, ' ', '') = ?
          AND branch_name IS NOT NULL
        ORDER BY branch_name DESC
        LIMIT 1
        `,
        [branchRoute]
      );

      const result = (rows as BranchInfo[])[0];
      return result ?? null;
    });

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
      const [rows] = await pool.query(
        `
        SELECT
          CAST(operation_code AS CHAR) AS operation_code,
          operation
        FROM om_digital.main_order_view
        WHERE operation_code IS NOT NULL
          AND operation IS NOT NULL
        GROUP BY CAST(operation_code AS CHAR), operation
        ORDER BY CAST(operation_code AS UNSIGNED) ASC
        `
      );
      return rows as OperationInfo[];
    });

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
      `operation:${operationCode}`,
      async () => {
        const [rows] = await pool.query(
          `
          SELECT
            CAST(operation_code AS CHAR) AS operation_code,
            operation
          FROM om_digital.main_order_view
          WHERE CAST(operation_code AS CHAR) = ?
            AND operation IS NOT NULL
          ORDER BY operation DESC
          LIMIT 1
          `,
          [operationCode]
        );

        const result = (rows as OperationInfo[])[0];
        return result ?? null;
      }
    );

    setCacheHeaders(res, meta);
    if (!meta.data) return res.status(404).json({ error: 'operation_not_found' });
    return res.json(meta.data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'operation_error' });
  }
});

const PLATE_NORM_SQL = `REPLACE(REPLACE(plate, '-', ''), ' ', '')`;

const BRANCH_ROUTE_SQL = `
  CONCAT(
    LPAD(CAST(company AS CHAR), 2, '0'),
    LPAD(CAST(branch  AS CHAR), 2, '0')
  )
`;

app.get('/api/assets/summary/branch/:branchRoute', async (req, res) => {
  const branchRoute = normalizeRoute(req.params.branchRoute || '');
  if (!branchRoute) return res.status(400).json({ error: 'branchRoute_required' });

  try {
    const meta = await assetsSummaryCache.get<AssetFamilySummary[]>(
      `assets:summary:branch:${branchRoute}`,
      async () => {
        const [rows] = await pool.query(
          `
          SELECT
            family,
            family_name,
            COUNT(DISTINCT ${PLATE_NORM_SQL}) AS total_plates
          FROM om_digital.asset_view
          WHERE ${BRANCH_ROUTE_SQL} = ?
            AND plate IS NOT NULL
          GROUP BY family, family_name
          ORDER BY total_plates DESC
          `,
          [branchRoute]
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
        const [rows] = await pool.query(
          `
          SELECT
            family,
            family_name,
            COUNT(DISTINCT ${PLATE_NORM_SQL}) AS total_plates
          FROM om_digital.asset_view
          WHERE CAST(operation_code AS CHAR) = ?
            AND plate IS NOT NULL
          GROUP BY family, family_name
          ORDER BY total_plates DESC
          `,
          [operationCode]
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

async function queryOrders(whereSql: string, param: string): Promise<MainOrderRow[]> {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      \`number\`,
      asset_code,
      asset_plate,
      asset_family_name,
      asset_family,
      REPLACE(branch, ' ', '') AS branch_route,
      branch,
      branch_name,
      CAST(operation_code AS CHAR) AS operation_code,
      operation,
      group_branch,
      service_code,
      status_description,
      status,
      datetime AS INICIOPARADA,
      end_prev_datetime AS PREVTERMINO,
      resp_register_name
    FROM om_digital.main_order_view
    WHERE status NOT IN ('8','9','2','7','3')
      AND ${whereSql}
    ORDER BY end_prev_datetime ASC
    `,
    [param]
  );

  return rows as MainOrderRow[];
}

app.get('/api/orders/branch/:branchRoute', async (req, res) => {
  const branchRoute = normalizeRoute(req.params.branchRoute || '');
  if (!branchRoute) return res.status(400).json({ error: 'branchRoute_required' });

  try {
    const meta = await ordersCache.get<MainOrderRow[]>(`orders:branch:${branchRoute}`, async () => {
      return queryOrders(`REPLACE(branch, ' ', '') = ?`, branchRoute);
    });

    setCacheHeaders(res, meta);
    res.json(meta.data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'orders_branch_error' });
  }
});

app.get('/api/orders/operation/:operationCode', async (req, res) => {
  const operationCode = normalizeRoute(req.params.operationCode || '');
  if (!operationCode) return res.status(400).json({ error: 'operationCode_required' });

  try {
    const meta = await ordersCache.get<MainOrderRow[]>(
      `orders:operation:${operationCode}`,
      async () => {
        return queryOrders(`CAST(operation_code AS CHAR) = ?`, operationCode);
      }
    );

    setCacheHeaders(res, meta);
    res.json(meta.data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'orders_operation_error' });
  }
});

app.get('/api/orders/:branchRoute', async (req, res) => {
  const branchRoute = normalizeRoute(req.params.branchRoute || '');
  if (!branchRoute) return res.status(400).json({ error: 'branchRoute_required' });

  try {
    const meta = await ordersCache.get<MainOrderRow[]>(`orders:branch:${branchRoute}`, async () => {
      return queryOrders(`REPLACE(branch, ' ', '') = ?`, branchRoute);
    });

    setCacheHeaders(res, meta);
    res.json(meta.data);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'orders_error' });
  }
});

app.listen(PORT, () => {
  console.log(`[om-digital] API server running on http://localhost:${PORT}`);
});
