// Admin access is hardcoded to this single account (mirrored in is_admin() at
// the database level) rather than open to anyone with role='admin'.
export const ADMIN_UID = 'c95dfb14-7e54-470e-b00d-ec3fb588c916'

export const isAdminProfile = (profile) => profile?.role === 'admin' && profile?.id === ADMIN_UID
