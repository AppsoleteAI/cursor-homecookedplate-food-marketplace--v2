type Admin = { from: (table: string) => any };

/** Who has already confirmed pickup for these orders. A missing log leaves the list empty. */
export async function loadPickupConfirms(
  admin: Admin,
  orderIds: string[],
): Promise<Map<string, ('buyer' | 'seller')[]>> {
  const confirms = new Map<string, ('buyer' | 'seller')[]>();
  if (orderIds.length === 0) return confirms;
  const { data, error } = await admin
    .from('audit_logs')
    .select('record_id, new_data')
    .eq('action', 'PICKUP_CONFIRM')
    .in('record_id', orderIds);
  if (error || !data) return confirms;
  for (const row of data as { record_id?: string; new_data?: { role?: string } }[]) {
    const role = row.new_data?.role;
    if (!row.record_id || (role !== 'buyer' && role !== 'seller')) continue;
    const current = confirms.get(row.record_id) ?? [];
    if (!current.includes(role)) current.push(role);
    confirms.set(row.record_id, current);
  }
  return confirms;
}
