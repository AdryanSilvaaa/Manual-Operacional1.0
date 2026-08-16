import { query } from '../config/db.js';

export async function audit(userId, action, entityType = null, entityId = null, details = {}) {
  await query('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5::jsonb)', [userId || null, action, entityType, entityId ? String(entityId) : null, JSON.stringify(details)]);
}
