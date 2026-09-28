export type Room = {
  id: string;
  name: string;
  building: string;
  floor: number;
  kind: 'Phòng học' | 'Phòng lab' | 'Phòng họp' | 'Phòng tự học' | 'Studio';
  capacity: number;
  amenities: string[];
  description: string;
  color: string;
};

export type Booking = {
  id: string;
  roomId: string;
  roomName: string;
  date: string;
  start: number;
  end: number;
  uid: string;
  createdAt: number;
};
