/** A message on a plate order. Payment already told the cook. An ETA tells the buyer. */

export function paidContactDecision(input: {
  paid: boolean;
  role: string | null | undefined;
  etaMinutes?: number | null;
  text: string;
}): { ok: true; text: string } | { ok: false; message: string } {
  if (input.role !== 'platemaker' && input.role !== 'platetaker') {
    return { ok: false, message: 'Only the PlateMaker or the PlateTaker on this order can send a message.' };
  }
  if (!input.paid) {
    return { ok: false, message: 'Pay for this order before sending a message.' };
  }
  if (input.etaMinutes != null) {
    if (input.role !== 'platemaker') {
      return { ok: false, message: 'Only the PlateMaker can send an ETA.' };
    }
    if (!Number.isInteger(input.etaMinutes) || input.etaMinutes < 5 || input.etaMinutes > 240) {
      return { ok: false, message: 'Choose an ETA between 5 and 240 minutes.' };
    }
    const eta = `ETA ${input.etaMinutes} minutes.`;
    const extra = input.text.trim();
    return { ok: true, text: extra && extra !== eta ? `${eta} ${extra}` : eta };
  }
  if (!input.text.trim()) {
    return { ok: false, message: 'That message cannot be sent.' };
  }
  return { ok: true, text: input.text.trim() };
}

export function messageNotice(text: string): { title: string; body: string } {
  const body = text.slice(0, 140);
  if (/^ETA \d+ minutes\./.test(text)) return { title: 'Order ETA', body };
  return { title: 'New message', body };
}
