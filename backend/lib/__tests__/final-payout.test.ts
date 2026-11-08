import { releaseDuePayouts } from '../stripe-marketplace';

type Row = Record<string, unknown>;

const COOK = '11111111-1111-4111-8111-111111111111';

function memoryAdmin(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      const rows = tables[table] || (tables[table] = []);
      const filters: ((row: Row) => boolean)[] = [];
      let mode: 'select' | 'update' | 'insert' = 'select';
      let patch: Row = {};
      let pendingInsert: Row | null = null;
      const run = () => {
        if (mode === 'insert' && pendingInsert) {
          rows.push(pendingInsert);
          return { data: pendingInsert, error: null };
        }
        const matched = rows.filter((row) => filters.every((fn) => fn(row)));
        if (mode === 'update') {
          for (const row of matched) Object.assign(row, patch);
        }
        return { data: matched, error: null };
      };
      const chain = {
        select() { return chain; },
        eq(key: string, value: unknown) {
          filters.push((row) => row[key] === value);
          return chain;
        },
        is(key: string, value: unknown) {
          filters.push((row) => row[key] === value);
          return chain;
        },
        lte(key: string, value: unknown) {
          filters.push((row) => String(row[key] ?? '') <= String(value));
          return chain;
        },
        gte() { return chain; },
        in(key: string, values: unknown[]) {
          filters.push((row) => values.includes(row[key]));
          return chain;
        },
        order() { return chain; },
        limit() { return run(); },
        maybeSingle() {
          const result = run();
          const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
          return { data, error: null };
        },
        single() {
          const result = run();
          const data = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
          return { data, error: null };
        },
        update(next: Row) {
          mode = 'update';
          patch = next;
          return chain;
        },
        insert(next: Row) {
          mode = 'insert';
          pendingInsert = { ...next };
          return chain;
        },
        then(resolve: (value: { data: unknown; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return chain;
    },
  };
}

describe('final payout after selling is removed', () => {
  it('waits 30 days and leaves a pending chargeback unpaid', async () => {
    const tables: Record<string, Row[]> = {
      profiles: [{
        id: COOK,
        stripe_account_id: 'acct_cook',
        stripe_payouts_enabled: true,
        selling_removed: true,
        final_payout_at: '2099-01-01T00:00:00.000Z',
        dispute_fee_owed_cents: 500,
      }],
      transactions: [{
        id: 'tx-wait',
        seller_id: COOK,
        seller_payout: 18,
        currency: 'usd',
        payment_intent_id: 'pi_wait',
        order_id: 'order-wait',
        status: 'held',
        payout_release_at: '2020-01-01T00:00:00.000Z',
        stripe_charge_id: 'ch_wait',
        stripe_transfer_id: null,
      }],
      audit_logs: [],
      shop_orders: [],
    };
    const fetchSpy = jest.spyOn(global, 'fetch');
    const result = await releaseDuePayouts(memoryAdmin(tables) as never, 'sk_test_final');
    expect(result.released).toBe(0);
    expect(tables.transactions[0].status).toBe('held');
    expect(tables.transactions[0].payout_release_at).toBe('2099-01-01T00:00:00.000Z');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('transfers the remaining share after 30 days, minus fees still owed', async () => {
    const tables: Record<string, Row[]> = {
      profiles: [{
        id: COOK,
        stripe_account_id: 'acct_cook',
        stripe_payouts_enabled: true,
        selling_removed: true,
        final_payout_at: '2020-01-01T00:00:00.000Z',
        dispute_fee_owed_cents: 500,
      }],
      transactions: [
        {
          id: 'tx-final',
          seller_id: COOK,
          seller_payout: 18,
          currency: 'usd',
          payment_intent_id: 'pi_final',
          order_id: 'order-final',
          status: 'held',
          payout_release_at: null,
          stripe_charge_id: 'ch_final',
          stripe_transfer_id: null,
        },
        {
          id: 'tx-dispute',
          seller_id: COOK,
          seller_payout: 18,
          currency: 'usd',
          payment_intent_id: 'pi_dispute',
          order_id: 'order-dispute',
          status: 'disputed',
          payout_release_at: '2020-01-01T00:00:00.000Z',
          stripe_charge_id: 'ch_dispute',
          stripe_transfer_id: null,
        },
      ],
      audit_logs: [],
      shop_orders: [],
    };
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: 'tr_final' }),
    } as Response);
    const result = await releaseDuePayouts(memoryAdmin(tables) as never, 'sk_test_final');
    expect(result.released).toBe(1);
    expect(tables.transactions[0].status).toBe('settled');
    expect(tables.transactions[0].stripe_transfer_id).toBe('tr_final');
    expect(tables.transactions[0].stripe_transfer_cents).toBe(1300);
    expect(tables.transactions[1].status).toBe('disputed');
    expect(tables.profiles[0].dispute_fee_owed_cents).toBe(0);
    const body = String((fetchSpy.mock.calls[0][1] as { body?: string }).body);
    expect(body).toContain('amount=1300');
    expect(body).toContain('final_settlement');
    expect(body).toContain('destination=acct_cook');
    fetchSpy.mockRestore();
  });
});
