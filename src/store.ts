import { create } from 'zustand';
import { dayKey } from './dates';
import { Room } from './types';

export type KindFilter = 'Tất cả' | Room['kind'];
export type Filters = {
  search: string;
  kind: KindFilter;
  building: string;
  floor: number;
  minCapacity: number;
  amenities: string[];
  date: string;
  setSearch: (v: string) => void;
  setKind: (v: KindFilter) => void;
  setBuilding: (v: string) => void;
  setFloor: (v: number) => void;
  setMinCapacity: (v: number) => void;
  toggleAmenity: (v: string) => void;
  setDate: (v: string) => void;
  clear: () => void;
};

export const useFilters = create<Filters>((set) => ({
  search: '', kind: 'Tất cả', building: 'Tất cả', floor: 0,
  minCapacity: 0, amenities: [], date: dayKey(new Date()),
  setSearch: (search) => set({ search }),
  setKind: (kind) => set({ kind }),
  setBuilding: (building) => set({ building }),
  setFloor: (floor) => set({ floor }),
  setMinCapacity: (minCapacity) => set({ minCapacity }),
  toggleAmenity: (v) => set((state) => ({
    amenities: state.amenities.includes(v)
      ? state.amenities.filter((item) => item !== v)
      : [...state.amenities, v],
  })),
  setDate: (date) => set({ date }),
  clear: () => set({ search: '', kind: 'Tất cả', building: 'Tất cả', floor: 0, minCapacity: 0, amenities: [] }),
}));
