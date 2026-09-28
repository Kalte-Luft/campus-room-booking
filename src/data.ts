import { collection, doc, getDocs, query, runTransaction, where } from 'firebase/firestore';
import { db } from './firebase';
import { Booking, Room } from './types';
import { allSlots, days, isPast } from './dates';
import moreRooms from './more-rooms.json';

const samples: Room[] = [
  { id: 'a101', name: 'Phòng A101', building: 'Tòa A', floor: 1, kind: 'Phòng học', capacity: 12, amenities: ['Máy chiếu', 'Bảng trắng', 'Wi-Fi'], description: 'Không gian học nhóm yên tĩnh, đủ ánh sáng và bảng thảo luận.', color: '#DCEBFF' },
  { id: 'a204', name: 'Phòng A204', building: 'Tòa A', floor: 2, kind: 'Phòng học', capacity: 6, amenities: ['Bảng trắng', 'Wi-Fi'], description: 'Phòng nhỏ cho các nhóm học và thuyết trình.', color: '#E7E9FF' },
  { id: 'b302', name: 'Lab B302', building: 'Tòa B', floor: 3, kind: 'Phòng lab', capacity: 20, amenities: ['Máy tính', 'Máy chiếu', 'Điều hòa'], description: 'Phòng thực hành với máy tính và thiết bị trình chiếu.', color: '#E0F5EB' },
  { id: 'b105', name: 'Lab B105', building: 'Tòa B', floor: 1, kind: 'Phòng lab', capacity: 16, amenities: ['Máy tính', 'Wi-Fi'], description: 'Phòng lab cho thực hành và làm đồ án nhóm.', color: '#FFF0D9' },
  { id: 'c201', name: 'Phòng C201', building: 'Tòa C', floor: 2, kind: 'Phòng học', capacity: 30, amenities: ['Máy chiếu', 'Điều hòa', 'Wi-Fi'], description: 'Phòng rộng dành cho workshop và trao đổi chuyên đề.', color: '#FCE4EC' },
];

export async function getRooms(): Promise<Room[]> {
  const snap = await getDocs(collection(db, 'rooms'));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Room)).sort((a, b) => a.name.localeCompare(b.name));
}
export async function seedRooms() {
  // Stable IDs make this button safe to tap more than once. Only create missing rooms.
  for (const room of samples) {
    const ref = doc(db, 'rooms', room.id);
    await runTransaction(db, async (tx) => {
      const found = await tx.get(ref);
      if (!found.exists()) tx.set(ref, room);
    });
  }
}
export async function seedMoreRooms() {
  // Stable IDs: safe to run again; existing documents are never overwritten.
  for (const room of moreRooms as Room[]) {
    const ref = doc(db, 'rooms', room.id);
    await runTransaction(db, async (tx) => {
      if (!(await tx.get(ref)).exists()) tx.set(ref, room);
    });
  }
}
export async function getTaken(roomId: string, date: string): Promise<number[]> {
  const snap = await getDocs(collection(db, 'slots', `${roomId}_${date}`, 'items'));
  return snap.docs.map((s) => Number(s.id));
}
export async function getMyBookings(uid: string): Promise<Booking[]> {
  const snap = await getDocs(query(collection(db, 'bookings'), where('uid', '==', uid)));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Booking)).sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start);
}
const slotRef = (roomId: string, date: string, slot: number) => doc(db, 'slots', `${roomId}_${date}`, 'items', String(slot));

export class SlotConflict extends Error { constructor() { super('Khung giờ vừa được người khác đặt. Vui lòng chọn giờ khác.'); } }

export async function createBooking(room: Room, date: string, start: number, end: number, uid: string) {
  if (!allSlots.includes(start) || end <= start || end > 40 || end - start > 8 || !days().some((d) => d.key === date) || isPast(date, start)) throw new Error('Khung giờ không hợp lệ hoặc đã qua.');
  const slots = Array.from({ length: end - start }, (_, i) => start + i);
  const bookingRef = doc(collection(db, 'bookings'));
  const refs = slots.map((s) => slotRef(room.id, date, s));
  await runTransaction(db, async (tx) => {
    // Read every lock before any write. A concurrent commit invalidates these
    // reads; Firestore retries, then one contender sees the occupied slot.
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));
    if (snapshots.some((snap) => snap.exists())) throw new SlotConflict();
    const booking: Booking = { id: bookingRef.id, roomId: room.id, roomName: room.name, date, start, end, uid, createdAt: Date.now() };
    tx.set(bookingRef, booking);
    refs.forEach((ref) => tx.set(ref, { bookingId: bookingRef.id, uid }));
  });
  return bookingRef.id;
}
export async function cancelBooking(booking: Booking, uid: string) {
  const bookingRef = doc(db, 'bookings', booking.id);
  const refs = Array.from({ length: booking.end - booking.start }, (_, i) => slotRef(booking.roomId, booking.date, booking.start + i));
  await runTransaction(db, async (tx) => {
    const current = await tx.get(bookingRef);
    const locks = await Promise.all(refs.map((ref) => tx.get(ref)));
    if (!current.exists() || current.data().uid !== uid) throw new Error('Không thể hủy lịch đặt này.');
    if (locks.some((lock) => !lock.exists() || lock.data()?.bookingId !== booking.id)) throw new Error('Dữ liệu đặt phòng không đồng bộ.');
    tx.delete(bookingRef);
    refs.forEach((ref) => tx.delete(ref));
  });
}
