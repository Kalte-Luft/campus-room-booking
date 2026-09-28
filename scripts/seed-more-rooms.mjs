// Run once after filling .env: npm run seed:more
// Safe to run again: existing rooms are never overwritten.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getFirestore, runTransaction } from 'firebase/firestore';
import moreRooms from '../src/more-rooms.json' with { type: 'json' };

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};
if (!config.apiKey || !config.projectId || !config.appId || config.apiKey === 'replace_me') {
  console.error('Thiếu Firebase config. Hãy điền file .env theo README.');
  process.exitCode = 1;
} else {
  try {
    const app = initializeApp(config);
    const auth = getAuth(app);
    await signInAnonymously(auth);
    const db = getFirestore(app);
    let created = 0;
    for (const room of moreRooms) {
      const ref = doc(db, 'rooms', room.id);
      const inserted = await runTransaction(db, async (tx) => {
        if ((await tx.get(ref)).exists()) return false;
        tx.set(ref, room);
        return true;
      });
      if (inserted) created++;
    }
    console.log(`Đã thêm ${created} phòng mới. ${moreRooms.length - created} phòng có sẵn được giữ nguyên.`);
  } catch (error) {
    console.error('Không thể tạo phòng:', error);
    process.exitCode = 1;
  }
}
