import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';

export async function GET(request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  // Strictly restrict activity logs access to Super Admin only
  if (user.role !== 'Super Admin') {
    return NextResponse.json({ error: "Akses ditolak: Hanya Super Admin yang dapat mengakses rekam jejak aktivitas." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  
  const filterEmail = searchParams.get('email') || '';
  const filterAction = searchParams.get('action') || '';
  const filterTargetType = searchParams.get('target_type') || '';

  try {
    let queryParams = [];
    let paramIdx = 1;
    let conditions = [];

    if (filterEmail) {
      conditions.push(`user_email ILIKE $${paramIdx++}`);
      queryParams.push(`%${filterEmail}%`);
    }

    if (filterAction) {
      conditions.push(`action = $${paramIdx++}`);
      queryParams.push(filterAction);
    }

    if (filterTargetType) {
      conditions.push(`target_type = $${paramIdx++}`);
      queryParams.push(filterTargetType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query for total count
    const countQuery = `SELECT COUNT(*) as count FROM activity_logs ${whereClause};`;
    const { rows: countRows } = await db.query(countQuery, queryParams);
    const total = parseInt(countRows[0].count, 10);

    // Query for log rows with limit & offset
    const selectQuery = `
      SELECT * 
      FROM activity_logs 
      ${whereClause} 
      ORDER BY timestamp DESC 
      LIMIT $${paramIdx++} OFFSET $${paramIdx++};
    `;
    const selectParams = [...queryParams, limit, offset];
    const { rows: logsRows } = await db.query(selectQuery, selectParams);

    // Write a system visit log to the logs table itself
    // To prevent infinite loop, we DO NOT log when retrieving logs if it creates duplicate noise,
    // but a one-time page load tracking can be logged. We will log this VISIT as PAGE.
    if (offset === 0) {
      await logActivity(user.email, 'VISIT', 'PAGE', 'ACTIVITY_LOGS', 'Mengakses halaman Rekam Jejak (Logs)');
    }

    return NextResponse.json({
      logs: logsRows,
      total: total
    });
  } catch (error) {
    console.error("Failed to fetch activity logs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
