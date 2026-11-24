/** "12,400 kg": whole kilograms with thousands separators (written by hand so it does not depend on the phone's locale support). */
export function formatVolumeKg(kg: number): string {
  const whole = Math.max(0, Math.round(Number.isFinite(kg) ? kg : 0));
  return `${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} kg`;
}
