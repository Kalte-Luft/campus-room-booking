# Campus Space — đặt phòng học và phòng lab

Ứng dụng Android bằng **React Native + Expo Managed**, **TypeScript strict**, **React Navigation 7 (Stack + Tabs)**, **Zustand** cho bộ lọc và **TanStack Query** cho dữ liệu Firebase Cloud Firestore. Dùng Firebase Authentication ẩn danh; không cần đăng ký tài khoản. Giao diện tiếng Việt.

## Chức năng

- Danh sách phòng bằng `FlatList` (tối ưu render theo lô), tìm tên/tòa nhà/tiện ích, lọc kết hợp loại phòng, số chỗ, máy chiếu.
- Chi tiết phòng, tiện ích, chọn ngày trong 7 ngày tới và khung giờ 30 phút từ 08:00–20:00. Chọn ô bắt đầu rồi ô cuối; tối đa 4 giờ.
- Xem ô đã đặt, ngăn chọn giờ đã qua hoặc khoảng giờ vướng lịch; làm mới tự động mỗi 10 giây và bằng nút tải lại.
- Xác nhận đặt, xem lịch cá nhân, hủy lịch và trả lại khung giờ.
- Khi hai thiết bị đặt trùng giờ, Firestore transaction kiểm tra và khóa **tất cả** ô 30 phút của khoảng giờ trong cùng một lần commit. Giao dịch nào **commit thành công trước** được giữ phòng; giao dịch còn lại sẽ tự retry, thấy ô đã bị giữ và báo lỗi. Thời gian bấm nút ở điện thoại không quyết định ưu tiên. Các khoảng chỉ chạm điểm kết thúc không bị xem là trùng.

## Chuẩn bị

1. Cài **Node.js 22.13+** và npm. Cài **Expo Go** trên điện thoại Android (Google Play); máy tính và điện thoại cùng mạng Wi-Fi. Không cần Android Studio nếu dùng điện thoại.
2. Giải nén ZIP, mở terminal tại thư mục `campus-room-booking`, chạy:

   ```bash
   npm install
   ```

## Tạo Firebase từ đầu

1. Mở [Firebase Console](https://console.firebase.google.com/) → **Add project / Thêm dự án** → đặt tên, ví dụ `campus-space-demo` → tiếp tục (có thể tắt Google Analytics) → **Create project**.
2. Trong **Build → Authentication → Get started → Sign-in method**, chọn **Anonymous / Ẩn danh**, bật **Enable**, bấm **Save**. Ứng dụng sẽ tự tạo một tài khoản ẩn danh cho từng bản cài.
3. Trong **Build → Firestore Database → Create database**, chọn một location gần bạn, chọn **production mode** → **Create**. App dùng **Cloud Firestore**, không dùng Realtime Database. Không cần tự tạo collection hay index tổng hợp.
4. Vào tab **Rules** của Firestore, thay nội dung bằng file [`firestore.rules`](firestore.rules), bấm **Publish**. Các rules đơn giản này cho người dùng đã đăng nhập ẩn danh đọc/ghi để chạy bài tập. Chỉ dùng cho demo, xem ghi chú giới hạn bên dưới.
5. Tại **Project overview → biểu tượng Web `</>` → Register app**, đặt nickname, ví dụ `campus-expo` → **Register app**. Chép giá trị trong `firebaseConfig` (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`). Không cần Firebase Hosting, file `google-services.json`, hay Android app registration vì ứng dụng dùng Firebase JS SDK trong Expo Go.
6. Sao chép `.env.example` thành `.env` và điền **đúng 6 giá trị**:

   ```bash
   cp .env.example .env
   ```

   Ví dụ `EXPO_PUBLIC_FIREBASE_PROJECT_ID=campus-space-demo`. Không thêm dấu nháy. Firebase web config không phải mật khẩu; quyền truy cập thực tế do Firebase Rules quản lý.

## Chạy trên Android

Tại thư mục dự án:

```bash
npm start
```

Quét QR trong terminal bằng **Expo Go**. Nếu điện thoại không kết nối được mạng nội bộ, thử `npx expo start --tunnel` (cần mạng và Expo account khi CLI yêu cầu). Sau khi đổi `.env`, dừng Metro rồi chạy `npx expo start -c`.

Lần mở đầu, trang chủ chưa có dữ liệu: nhấn **Tạo phòng mẫu**. Năm phòng được thêm vào collection `rooms` trong Firestore bằng ID cố định; nhấn lại sẽ không ghi đè phòng đã có. Để kiểm tra tranh chấp, mở app ở **hai điện thoại/cài đặt khác nhau**, chọn cùng phòng/ngày/giờ và xác nhận gần như đồng thời. Một lịch thành công, bên kia thấy thông báo giờ vừa được đặt. Hai bản sao cùng một tài khoản ẩn danh vẫn sẽ tạo tối đa một lịch cho cùng ô giờ.

## Cấu trúc Firestore

| Đường dẫn | Nội dung |
| --- | --- |
| `rooms/{roomId}` | Tên, loại, sức chứa, tiện ích, mô tả |
| `bookings/{autoId}` | `uid`, phòng, ngày `YYYY-MM-DD`, chỉ số giờ bắt đầu/kết thúc, thời gian tạo |
| `slots/{roomId}_{date}/items/{slotNumber}` | Khóa 30 phút chứa `bookingId` và `uid`; ví dụ `16` là 08:00–08:30 |

Đặt và hủy là các **giao dịch nguyên tử** giữa booking và các ô giờ; khi hủy, app kiểm tra `uid` và `bookingId` trước khi trả ô. Firestore tự retry giao dịch nếu tài liệu đã đọc thay đổi; chỉ một giao dịch ghi được các ô tranh chấp. Giao dịch cần kết nối mạng; không đặt phòng offline.

## Lệnh hữu ích

```bash
npm run typecheck    # kiểm tra TypeScript strict
npx expo install --check  # đối chiếu phiên bản thư viện với SDK Expo
```

## Giới hạn của mini project

Rules đi kèm chỉ yêu cầu đăng nhập ẩn danh để ứng dụng demo chạy nhanh. Người dùng sửa mã ứng dụng vẫn có thể ghi trực tiếp Firestore hoặc sửa lịch người khác; tính toàn vẹn khi có client không đáng tin cậy cần rules chặt hơn hay backend/Cloud Functions. Cơ chế ưu tiên giao dịch ở trên áp dụng cho **các thao tác đi qua app**. Anonymous Auth gắn với lần cài và bộ nhớ ứng dụng; xóa dữ liệu app có thể làm mất quyền truy cập lịch cũ. FlatList được tối ưu để cuộn mượt, nhưng tốc độ 60 fps còn tùy thiết bị và không phải cam kết đo kiểm. Thời gian ngày/giờ dùng múi giờ trên điện thoại; dùng cùng múi giờ khi triển khai cho một campus.

## Tham khảo

- [Expo SDK và Firebase JS SDK](https://docs.expo.dev/guides/using-firebase/)
- [Firebase transaction](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Firebase Anonymous Auth](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [React Navigation 7](https://reactnavigation.org/docs/7.x/getting-started/)
