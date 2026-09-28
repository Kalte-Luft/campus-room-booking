export const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const days = () => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + i);
  return { key: dayKey(d), label: i === 0 ? 'Hôm nay' : i === 1 ? 'Ngày mai' : d.toLocaleDateString('vi-VN', { weekday: 'short' }), number: `${d.getDate()}/${d.getMonth() + 1}` };
});
export const clock = (slot: number) => `${String(Math.floor(slot / 2)).padStart(2, '0')}:${slot % 2 ? '30' : '00'}`;
export const allSlots = Array.from({ length: 24 }, (_, i) => i + 16); // 08:00–20:00
export const isPast = (date: string, slot: number) => {
  if (date < dayKey(new Date())) return true;
  if (date !== dayKey(new Date())) return false;
  const now = new Date();
  return slot * 30 <= now.getHours() * 60 + now.getMinutes();
};
