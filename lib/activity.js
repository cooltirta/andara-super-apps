import db from './db';
import crypto from 'crypto';

/**
 * Logs user activity to the database.
 * 
 * @param {string} userEmail - Email of the user performing the action.
 * @param {string} action - Action type: 'ADD', 'EDIT', 'DELETE', 'LOGIN', 'LOGOUT', 'VISIT', etc.
 * @param {string} targetType - Target type: 'JAMAAH', 'KELUARGA', 'USER', 'KEHADIRAN', 'PAGE', etc.
 * @param {string|null} targetId - ID of the target resource.
 * @param {string} details - Human-readable details about the action.
 */
export async function logActivity(userEmail, action, targetType, targetId, details) {
  try {
    if (!userEmail) return;
    const id = crypto.randomUUID();
    
    await db.query(
      "INSERT INTO activity_logs (id, user_email, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5, $6);",
      [id, userEmail.trim().toLowerCase(), action, targetType, targetId || null, details]
    );
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}
