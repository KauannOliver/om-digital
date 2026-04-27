import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'server/.env') });

async function debug() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
  });

  const branchRoute = '0121';

  console.log('--- ASSET_VIEW (Total Fleet for 0121) ---');
  const [assets] = await connection.query(
    `SELECT family_name, COUNT(*) as total 
     FROM asset_view 
     WHERE CONCAT(LPAD(CAST(company AS CHAR), 2, '0'), LPAD(CAST(branch AS CHAR), 2, '0')) = ?
     GROUP BY family_name`,
    [branchRoute]
  );
  console.table(assets);

  console.log('\n--- MAIN_ORDER_VIEW (Orders for 0121) ---');
  const [orders] = await connection.query(
    `SELECT asset_family_name, COUNT(DISTINCT asset_plate) as in_maintenance 
     FROM main_order_view 
     WHERE REPLACE(branch, ' ', '') = ?
       AND status NOT IN ('8','9','2','7','3')
     GROUP BY asset_family_name`,
    [branchRoute]
  );
  console.table(orders);

  await connection.end();
}

debug().catch(console.error);
