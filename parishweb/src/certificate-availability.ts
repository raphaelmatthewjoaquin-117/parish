export type CertificateBlockedSlot = { date: string; time: string | null };

export function isCertificateDateBlocked(blocks: CertificateBlockedSlot[], date: string): boolean {
  return blocks.some(block => block.date === date && block.time === null);
}

export function isCertificateTimeBlocked(blocks: CertificateBlockedSlot[], date: string, time: string): boolean {
  return blocks.some(block => block.date === date && (block.time === null || block.time === time));
}
