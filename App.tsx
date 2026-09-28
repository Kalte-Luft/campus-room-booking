import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, NavigatorScreenParams, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import { auth, configured } from './src/firebase';
import { cancelBooking, createBooking, getMyBookings, getRooms, getTaken, seedMoreRooms, seedRooms } from './src/data';
import { allSlots, clock, days, isPast } from './src/dates';
import { KindFilter, useFilters } from './src/store';
import { C } from './src/theme';
import { Booking, Room } from './src/types';
import moreRooms from './src/more-rooms.json';

type TabParams = { Explore: undefined; Bookings: undefined };
type StackParams = { Tabs: NavigatorScreenParams<TabParams> | undefined; Room: { room: Room } };
const Stack = createNativeStackNavigator<StackParams>();
const Tabs = createBottomTabNavigator<TabParams>();
const client = new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } });
const showError = (error: unknown) => Alert.alert('Có lỗi xảy ra', error instanceof Error ? error.message : 'Kiểm tra kết nối và thử lại.');

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[s.pill, active && s.pillActive]}><Text allowFontScaling={false} numberOfLines={1} style={[s.pillText, active && s.white]}>{label}</Text></Pressable>;
}
function Empty({ icon, title, detail }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }) {
  return <View style={s.empty}><Ionicons name={icon} size={38} color={C.blue} /><Text style={s.emptyTitle}>{title}</Text><Text style={s.centerText}>{detail}</Text></View>;
}
function FilterSheet({ visible, onClose, rooms }: { visible: boolean; onClose: () => void; rooms: Room[] }) {
  const f = useFilters();
  const buildings = ['Tất cả', ...new Set(rooms.map((r) => r.building))];
  const floors = [0, ...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
  const amenities = [...new Set(rooms.flatMap((r) => r.amenities))].sort((a, b) => a.localeCompare(b, 'vi'));
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
    <View style={s.modalShade}><SafeAreaView style={s.modalPanel} edges={['top', 'bottom']}>
      <View style={s.modalHeader}><View><Text style={s.eyebrow}>TÌM PHÒNG PHÙ HỢP</Text><Text style={s.title}>Bộ lọc</Text></View><Pressable accessibilityLabel="Đóng bộ lọc" onPress={onClose}><Ionicons name="close-circle" size={30} color={C.muted} /></Pressable></View>
      <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
        <Text style={s.filterLabel}>Loại không gian</Text><View style={s.wrap}>{(['Tất cả', 'Phòng học', 'Phòng lab', 'Phòng họp', 'Phòng tự học', 'Studio'] as KindFilter[]).map((v) => <Pill key={v} label={v} active={f.kind === v} onPress={() => f.setKind(v)} />)}</View>
        <Text style={s.filterLabel}>Tòa nhà</Text><View style={s.wrap}>{buildings.map((v) => <Pill key={v} label={v} active={f.building === v} onPress={() => f.setBuilding(v)} />)}</View>
        <Text style={s.filterLabel}>Tầng</Text><View style={s.wrap}>{floors.map((v) => <Pill key={v} label={v === 0 ? 'Tất cả' : `Tầng ${v}`} active={f.floor === v} onPress={() => f.setFloor(v)} />)}</View>
        <Text style={s.filterLabel}>Sức chứa tối thiểu</Text><View style={s.wrap}>{[0, 4, 8, 12, 20, 30].map((v) => <Pill key={v} label={v === 0 ? 'Bất kỳ' : `${v}+ chỗ`} active={f.minCapacity === v} onPress={() => f.setMinCapacity(v)} />)}</View>
        <Text style={s.filterLabel}>Tiện ích · chọn nhiều</Text><View style={s.wrap}>{amenities.map((v) => <Pill key={v} label={v} active={f.amenities.includes(v)} onPress={() => f.toggleAmenity(v)} />)}</View>
      </ScrollView>
      <View style={s.modalActions}><Pressable onPress={f.clear} style={s.clearButton}><Text style={s.link}>Đặt lại</Text></Pressable><Pressable onPress={onClose} style={s.applyButton}><Text style={s.buttonText}>Xem phòng</Text></Pressable></View>
    </SafeAreaView></View>
  </Modal>;
}
function Explore({ navigation }: { navigation: any }) {
  const f = useFilters(); const qc = useQueryClient(); const [filtersOpen, setFiltersOpen] = useState(false);
  const { data = [], isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ['rooms'], queryFn: getRooms });
  useFocusEffect(React.useCallback(() => { void refetch(); }, [refetch]));
  const seed = useMutation({ mutationFn: seedRooms, onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }), onError: showError });
  const seedMore = useMutation({ mutationFn: seedMoreRooms, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['rooms'] }); Alert.alert('Hoàn tất', 'Đã bổ sung các phòng mẫu còn thiếu.'); }, onError: showError });
  const missingMore = moreRooms.some((sample) => !data.some((r) => r.id === sample.id));
  const activeCount = Number(f.kind !== 'Tất cả') + Number(f.building !== 'Tất cả') + Number(f.floor !== 0) + Number(f.minCapacity !== 0) + f.amenities.length;
  const rooms = data.filter((r) => {
    const term = f.search.trim().toLocaleLowerCase('vi-VN');
    return (!term || `${r.name} ${r.building} ${r.amenities.join(' ')}`.toLocaleLowerCase('vi-VN').includes(term)) &&
      (f.kind === 'Tất cả' || r.kind === f.kind) &&
      (f.building === 'Tất cả' || r.building === f.building) &&
      (f.floor === 0 || r.floor === f.floor) &&
      r.capacity >= f.minCapacity &&
      f.amenities.every((item) => r.amenities.includes(item));
  });
  return <SafeAreaView edges={['top']} style={s.page}>
    <View style={s.header}><Text style={s.eyebrow}>CAMPUS SPACE</Text><Text style={s.title}>Tìm không gian học</Text><Text style={s.muted}>Chọn phòng phù hợp, đặt lịch trong vài giây.</Text></View>
    <View style={s.search}><Ionicons name="search" size={20} color={C.muted} /><TextInput style={s.input} placeholder="Tên phòng, tòa nhà, tiện ích..." placeholderTextColor={C.muted} value={f.search} onChangeText={f.setSearch} /></View>
    <View style={s.filterToolbar}><Pressable onPress={() => setFiltersOpen(true)} style={s.filterTrigger}><Ionicons name="options-outline" size={19} color={C.blue} /><Text allowFontScaling={false} style={s.filterTriggerText}>Bộ lọc{activeCount ? ` (${activeCount})` : ''}</Text><Ionicons name="chevron-down" size={16} color={C.blue} /></Pressable><Text style={s.filterHint}>{activeCount ? 'Đang áp dụng bộ lọc' : 'Loại · tòa · tầng · tiện ích'}</Text></View>
    <FilterSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} rooms={data} />
    <FlatList data={rooms} keyExtractor={(r) => r.id} initialNumToRender={6} maxToRenderPerBatch={6} windowSize={5} removeClippedSubviews
      refreshing={isRefetching} onRefresh={() => void refetch()} contentContainerStyle={s.list}
      ListHeaderComponent={<View><View style={s.between}><Text style={s.section}>{rooms.length} phòng phù hợp</Text>{(activeCount > 0 || f.search) && <Pressable onPress={f.clear}><Text style={s.link}>Xóa lọc</Text></Pressable>}</View>{data.length > 0 && missingMore && <Pressable style={s.seedBanner} disabled={seedMore.isPending} onPress={() => seedMore.mutate()}><Ionicons name="add-circle-outline" size={20} color={C.blue} /><Text style={s.seedText}>{seedMore.isPending ? 'Đang thêm phòng...' : 'Thêm 10 phòng mẫu (chỉ thêm phòng chưa có)'}</Text></Pressable>}</View>}
      renderItem={({ item: r }) => <Pressable accessibilityRole="button" onPress={() => navigation.getParent()?.navigate('Room', { room: r })} style={s.card}>
        <View style={[s.cardArt, { backgroundColor: r.color }]}><Ionicons name={roomIcon(r.kind)} color={C.navy} size={43} /><Text style={s.artTag}>{r.kind}</Text></View>
        <View style={s.cardBody}><View style={s.between}><Text style={s.cardTitle}>{r.name}</Text><Ionicons name="arrow-forward-circle" size={25} color={C.blue} /></View><Text style={s.muted}>{r.building} · Tầng {r.floor} · {r.capacity} chỗ</Text><View style={s.amenities}>{r.amenities.slice(0, 3).map((v) => <Text key={v} style={s.amenity}>{v}</Text>)}</View></View>
      </Pressable>}
      ListEmptyComponent={isLoading ? <ActivityIndicator style={s.loading} color={C.blue} /> : error ? <Empty icon="cloud-offline-outline" title="Không tải được phòng" detail="Kéo xuống để thử lại; kiểm tra cấu hình Firebase." /> : data.length === 0 ? <View><Empty icon="home-outline" title="Chưa có phòng" detail="Tạo 5 phòng ban đầu, sau đó thêm 10 phòng đa dạng." /><Pressable style={s.button} disabled={seed.isPending} onPress={() => seed.mutate()}><Text style={s.buttonText}>{seed.isPending ? 'Đang tạo...' : 'Tạo phòng mẫu'}</Text></Pressable></View> : <Empty icon="options-outline" title="Không tìm thấy phòng" detail="Thử thay đổi từ khóa hoặc bộ lọc." />}
    />
  </SafeAreaView>;
}
function roomIcon(kind: Room['kind']): keyof typeof Ionicons.glyphMap {
  if (kind === 'Phòng lab') return 'flask-outline';
  if (kind === 'Phòng họp') return 'people-outline';
  if (kind === 'Phòng tự học') return 'book-outline';
  if (kind === 'Studio') return 'videocam-outline';
  return 'library-outline';
}

function RoomDetail({ route, navigation, uid }: NativeStackScreenProps<StackParams, 'Room'> & { uid: string }) {
  const room = route.params.room, date = useFilters((v) => v.date), setDate = useFilters((v) => v.setDate);
  const qc = useQueryClient(); const [start, setStart] = useState<number | null>(null), [end, setEnd] = useState<number | null>(null);
  const { data: taken = [], isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ['taken', room.id, date], queryFn: () => getTaken(room.id, date), refetchInterval: 10_000 });
  useFocusEffect(React.useCallback(() => { void refetch(); }, [refetch]));
  useEffect(() => { setStart(null); setEnd(null); }, [date]);
  const booking = useMutation({ mutationFn: () => createBooking(room, date, start!, end!, uid), onSuccess: async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['taken', room.id, date] }), qc.invalidateQueries({ queryKey: ['bookings', uid] })]);
    Alert.alert('Đặt phòng thành công', `${room.name} · ${date} · ${clock(start!)}–${clock(end!)}`, [{ text: 'Xem lịch', onPress: () => navigation.navigate('Tabs', { screen: 'Bookings' }) }, { text: 'Đóng' }]);
    setStart(null); setEnd(null);
  }, onError: async (e) => { await qc.invalidateQueries({ queryKey: ['taken', room.id, date] }); showError(e); } });
  const choose = (slot: number) => {
    if (taken.includes(slot) || isPast(date, slot)) return;
    if (start === null || end !== null || slot <= start || slot - start > 8 || Array.from({ length: slot - start }, (_, i) => start + i).some((n) => taken.includes(n))) { setStart(slot); setEnd(null); }
    else setEnd(slot + 1);
  };
  const valid = start !== null && end !== null && !isPast(date, start) && Array.from({ length: end - start }, (_, i) => start + i).every((n) => !taken.includes(n));
  return <SafeAreaView edges={['bottom']} style={s.page}><ScrollView contentContainerStyle={s.detail}>
    <View style={[s.hero, { backgroundColor: room.color }]}><Ionicons name={roomIcon(room.kind)} size={70} color={C.navy} /></View>
    <Text style={s.title}>{room.name}</Text><Text style={s.muted}>{room.building} · Tầng {room.floor} · {room.kind}</Text><Text style={s.description}>{room.description}</Text>
    <View style={s.stats}><Ionicons name="people-outline" color={C.blue} size={19} /><Text style={s.stat}>{room.capacity} chỗ</Text><Ionicons name="time-outline" color={C.blue} size={19} /><Text style={s.stat}>08:00–20:00</Text></View>
    <Text style={s.section}>Tiện ích</Text><View style={s.amenities}>{room.amenities.map((v) => <Text style={s.amenity} key={v}>{v}</Text>)}</View>
    <Text style={[s.section, s.space]}>Chọn ngày</Text><View style={s.wrap}>{days().map((d) => <Pill key={d.key} label={`${d.label} · ${d.number}`} active={date === d.key} onPress={() => setDate(d.key)} />)}</View>
    <View style={[s.between, s.space]}><Text style={s.section}>Chọn khung giờ</Text><Pressable onPress={() => void refetch()}><Ionicons name="refresh" color={C.blue} size={22} /></Pressable></View><Text style={s.muted}>Chạm giờ bắt đầu, rồi chạm ô giờ cuối. Tối đa 4 giờ.</Text>
    {isLoading || isRefetching ? <ActivityIndicator style={{ margin: 10 }} color={C.blue} /> : null}{error ? <Text style={s.error}>Không tải được lịch. Nhấn tải lại và thử lại.</Text> : null}
    <View style={s.grid}>{allSlots.map((slot) => {
      const unavailable = taken.includes(slot) || isPast(date, slot), selected = start !== null && slot >= start && (end === null ? slot === start : slot < end);
      return <Pressable key={slot} disabled={unavailable || !!error || isLoading || booking.isPending} style={[s.slot, unavailable && s.slotUnavailable, selected && s.pillActive]} onPress={() => choose(slot)}><Text style={[s.slotText, unavailable && s.disabledText, selected && s.white]}>{clock(slot)}</Text></Pressable>;
    })}</View><Text style={s.legend}>Xanh: đang chọn     Xám: đã đặt hoặc đã qua</Text>
  </ScrollView><View style={s.bottom}><Text style={s.selection}>{valid ? `${date} · ${clock(start!)}–${clock(end!)}` : 'Chọn một khung giờ còn trống'}</Text><Pressable disabled={!valid || booking.isPending || !!error} onPress={() => booking.mutate()} style={[s.button, (!valid || booking.isPending || !!error) && s.disabledButton]}><Text style={s.buttonText}>{booking.isPending ? 'Đang xác nhận...' : 'Xác nhận đặt phòng'}</Text></Pressable></View></SafeAreaView>;
}

function MyBookings({ uid }: { uid: string }) {
  const qc = useQueryClient(); const { data = [], isLoading, error, refetch, isRefetching } = useQuery({ queryKey: ['bookings', uid], queryFn: () => getMyBookings(uid) });
  useFocusEffect(React.useCallback(() => { void refetch(); }, [refetch]));
  const cancel = useMutation({ mutationFn: (b: Booking) => cancelBooking(b, uid), onSuccess: async (_, b) => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['bookings', uid] }), qc.invalidateQueries({ queryKey: ['taken', b.roomId, b.date] })]); Alert.alert('Đã hủy', 'Khung giờ đã được trả lại.');
  }, onError: showError });
  return <SafeAreaView edges={['top']} style={s.page}><View style={s.header}><Text style={s.eyebrow}>LỊCH CỦA TÔI</Text><Text style={s.title}>Phòng đã đặt</Text><Text style={s.muted}>Theo dõi và hủy lịch khi không sử dụng.</Text></View>
    <FlatList data={data} keyExtractor={(b) => b.id} contentContainerStyle={s.list} refreshing={isRefetching} onRefresh={() => void refetch()}
      renderItem={({ item }) => <View style={s.bookingCard}><View style={s.between}><Text style={s.cardTitle}>{item.roomName}</Text><Text style={s.badge}>{item.date < days()[0].key ? 'Đã qua' : 'Đã đặt'}</Text></View><Text style={s.muted}>{item.date}    ·    {clock(item.start)}–{clock(item.end)}</Text>
        {item.date >= days()[0].key && <Pressable disabled={cancel.isPending} onPress={() => Alert.alert('Hủy lịch đặt?', `${item.roomName} · ${item.date} · ${clock(item.start)}–${clock(item.end)}`, [{ text: 'Giữ lịch', style: 'cancel' }, { text: 'Hủy lịch', style: 'destructive', onPress: () => cancel.mutate(item) }])}><Text style={s.cancelText}>Hủy đặt phòng</Text></Pressable>}
      </View>}
      ListEmptyComponent={isLoading ? <ActivityIndicator style={s.loading} color={C.blue} /> : error ? <Empty icon="cloud-offline-outline" title="Không tải được lịch" detail="Kéo xuống để thử lại." /> : <Empty icon="calendar-outline" title="Chưa có lịch đặt" detail="Khám phá phòng học và đặt khung giờ đầu tiên." />}
    />
  </SafeAreaView>;
}
function Main({ uid }: { uid: string }) {
  return <NavigationContainer><Stack.Navigator screenOptions={{ headerTintColor: C.navy, headerShadowVisible: false, headerStyle: { backgroundColor: C.bg } }}>
    <Stack.Screen name="Tabs" options={{ headerShown: false }}>{() => <Tabs.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: C.blue, tabBarInactiveTintColor: C.muted, tabBarStyle: { height: 66, paddingBottom: 8 }, tabBarIcon: ({ color, size }) => <Ionicons name={route.name === 'Explore' ? 'search-outline' : 'calendar-outline'} color={color} size={size} /> })}><Tabs.Screen name="Explore" component={Explore} options={{ title: 'Tìm phòng' }} /><Tabs.Screen name="Bookings" options={{ title: 'Lịch của tôi' }}>{() => <MyBookings uid={uid} />}</Tabs.Screen></Tabs.Navigator>}</Stack.Screen>
    <Stack.Screen name="Room" options={{ title: 'Chi tiết phòng' }}>{(props) => <RoomDetail {...props} uid={uid} />}</Stack.Screen>
  </Stack.Navigator></NavigationContainer>;
}
function Bootstrap() {
  const [user, setUser] = useState<User | null>(null), [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!configured) return; return onAuthStateChanged(auth, (u) => { if (u) setUser(u); else void signInAnonymously(auth).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e))); }, (e) => setError(e.message)); }, []);
  if (!configured) return <SafeAreaView style={s.center}><Ionicons name="construct-outline" size={46} color={C.blue} /><Text style={s.emptyTitle}>Cần cấu hình Firebase</Text><Text style={s.centerText}>Tạo .env theo .env.example và khởi động lại Expo. Xem README để biết từng bước.</Text></SafeAreaView>;
  if (error) return <SafeAreaView style={s.center}><Ionicons name="cloud-offline-outline" size={46} color={C.red} /><Text style={s.emptyTitle}>Không thể kết nối Firebase</Text><Text style={s.centerText}>{error}{'\n'}Kiểm tra mạng và bật Anonymous Authentication.</Text></SafeAreaView>;
  if (!user) return <SafeAreaView style={s.center}><ActivityIndicator color={C.blue} size="large" /><Text style={s.muted}>Đang kết nối...</Text></SafeAreaView>;
  return <Main uid={user.uid} />;
}
export default function App() { return <SafeAreaProvider><QueryClientProvider client={client}><StatusBar barStyle="dark-content" backgroundColor={C.bg} /><Bootstrap /></QueryClientProvider></SafeAreaProvider>; }

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg }, center: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 14 }, centerText: { textAlign: 'center', color: C.muted, lineHeight: 21 },
  header: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 12 }, eyebrow: { fontSize: 11, fontWeight: '800', color: C.blue, letterSpacing: 2, marginBottom: 9 }, title: { color: C.navy, fontSize: 27, fontWeight: '800', marginBottom: 6 }, muted: { color: C.muted, fontSize: 14, lineHeight: 21 },
  search: { marginHorizontal: 22, marginTop: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, paddingHorizontal: 15, height: 52, gap: 9 }, input: { flex: 1, color: C.navy, fontSize: 14 },
  filterToolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 14, gap: 12 }, filterTrigger: { minHeight: 46, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 13 }, filterTriggerText: { fontSize: 15, fontWeight: '700', color: C.blue }, filterHint: { color: C.muted, fontSize: 12, flexShrink: 1 },
  modalShade: { flex: 1, backgroundColor: '#172B4D66', justifyContent: 'flex-end' }, modalPanel: { height: '90%', backgroundColor: C.bg, borderTopLeftRadius: 23, borderTopRightRadius: 23, overflow: 'hidden' }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 18, paddingBottom: 10 }, modalContent: { paddingHorizontal: 22, paddingBottom: 32 }, filterLabel: { fontSize: 16, fontWeight: '800', color: C.navy, marginTop: 22, marginBottom: 12 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, alignItems: 'flex-start' },
  pill: { alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center', backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }, pillActive: { backgroundColor: C.blue, borderColor: C.blue }, pillText: { color: C.navy, fontSize: 14, lineHeight: 20, fontWeight: '700', includeFontPadding: false }, white: { color: C.white }, modalActions: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 10, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.white }, clearButton: { padding: 13 }, applyButton: { flex: 1, alignItems: 'center', padding: 15, borderRadius: 12, backgroundColor: C.blue }, seedBanner: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: C.light, borderRadius: 12, padding: 12, marginTop: 14 }, seedText: { color: C.blue, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  list: { paddingHorizontal: 22, paddingTop: 13, paddingBottom: 36, flexGrow: 1 }, between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, section: { color: C.navy, fontSize: 16, fontWeight: '800' }, link: { color: C.blue, fontWeight: '700' },
  card: { backgroundColor: C.white, borderRadius: 19, overflow: 'hidden', borderWidth: 1, borderColor: C.border, marginTop: 15 }, cardArt: { height: 105, alignItems: 'center', justifyContent: 'center' }, artTag: { position: 'absolute', right: 12, top: 12, backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, color: C.navy, fontWeight: '700' }, cardBody: { padding: 16 }, cardTitle: { color: C.navy, fontSize: 18, fontWeight: '800' }, amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }, amenity: { backgroundColor: C.light, color: C.blue, fontSize: 11, fontWeight: '700', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 25, marginTop: 35, gap: 11 }, emptyTitle: { color: C.navy, fontSize: 18, fontWeight: '800', textAlign: 'center' }, loading: { margin: 50 }, button: { backgroundColor: C.blue, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 12 }, buttonText: { color: C.white, fontSize: 15, fontWeight: '800' }, disabledButton: { opacity: 0.48 },
  detail: { padding: 22, paddingBottom: 35 }, hero: { height: 158, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 22 }, description: { color: C.navy, lineHeight: 22, marginTop: 14, marginBottom: 15 }, stats: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.white, padding: 15, borderRadius: 13, marginBottom: 22 }, stat: { color: C.navy, fontWeight: '700', marginRight: 13 }, space: { marginTop: 26, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 16 }, slot: { width: '22%', minWidth: 69, flexGrow: 1, paddingVertical: 11, backgroundColor: C.white, borderRadius: 11, borderWidth: 1, borderColor: C.border, alignItems: 'center' }, slotUnavailable: { backgroundColor: '#E9EDF2' }, slotText: { color: C.navy, fontWeight: '700' }, disabledText: { color: '#9AA7B5' }, legend: { color: C.muted, marginTop: 15, fontSize: 12 }, error: { color: C.red, marginTop: 12 },
  bottom: { backgroundColor: C.white, borderTopWidth: 1, borderColor: C.border, paddingHorizontal: 22, paddingVertical: 12 }, selection: { color: C.navy, textAlign: 'center', fontWeight: '700' }, bookingCard: { backgroundColor: C.white, borderRadius: 17, borderColor: C.border, borderWidth: 1, padding: 18, gap: 13, marginBottom: 13 }, badge: { backgroundColor: '#E5F7F0', color: C.green, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: '800' }, cancelText: { color: C.red, fontWeight: '700' },
});
