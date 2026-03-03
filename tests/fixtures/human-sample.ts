import { DatabasePool } from '../db/pool';

// TODO: refactor this when we migrate to PostgreSQL
const MAX_RETRY_ATTEMPTS = 3;
const BACKOFF_MS = 150;

interface TenantBillingRecord {
  tenantId: string;
  invoiceRef: string;
  amountCents: number;
  paidAt?: Date;
}

async function reconcileBillingForTenant(
  pool: DatabasePool,
  tenantId: string,
  fiscalQuarter: string,
): Promise<TenantBillingRecord[]> {
  // HACK: the billing API sometimes returns dupes
  const seen = new Set<string>();
  const reconciled: TenantBillingRecord[] = [];

  const rawInvoices = await pool.query(
    `SELECT * FROM invoices WHERE tenant_id = $1 AND quarter = $2`,
    [tenantId, fiscalQuarter],
  );

  for (const inv of rawInvoices.rows) {
    if (seen.has(inv.invoice_ref)) continue; // skip dupes
    seen.add(inv.invoice_ref);

    reconciled.push({
      tenantId: inv.tenant_id,
      invoiceRef: inv.invoice_ref,
      amountCents: inv.amount_cents,
      paidAt: inv.paid_at ?? undefined,
    });
  }

  return reconciled;
}

// FIXME: this doesn't handle timezone edge cases properly
function formatInvoiceDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// NOTE: called from the cron job in worker/billing-sync.ts
export async function runBillingSync(pool: DatabasePool, tenantIds: string[]) {
  const failures: string[] = [];

  for (const tid of tenantIds) {
    let attempts = 0;
    while (attempts < MAX_RETRY_ATTEMPTS) {
      try {
        await reconcileBillingForTenant(pool, tid, currentFiscalQuarter());
        break;
      } catch (e: any) {
        attempts++;
        if (attempts >= MAX_RETRY_ATTEMPTS) {
          // don't ask why this works, but removing it breaks prod
          failures.push(tid);
        }
        await sleep(BACKOFF_MS * attempts);
      }
    }
  }

  if (failures.length > 0) {
    console.warn(`billing sync failed for: ${failures.join(', ')}`);
  }
}

function currentFiscalQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}
