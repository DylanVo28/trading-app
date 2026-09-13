# Kế hoạch xây dựng React Native Trading App

Roadmap phát triển ứng dụng trading mô phỏng bằng Expo, React Native và TypeScript. Các phase được thực hiện tuần tự; chỉ bắt đầu phase tiếp theo sau khi phase hiện tại đạt đủ tiêu chí hoàn thành.

> Phạm vi MVP: sử dụng dữ liệu và lệnh mô phỏng; không có backend production, xác thực người dùng, kết nối sàn hoặc xử lý tiền thật.

## Phase 1 — Khởi tạo React Native App

Mục tiêu của phase này chỉ là tạo và xác nhận ứng dụng React Native hoạt động. Không cài dependency hoặc xây dựng tính năng trading.

- [x] Khởi tạo Expo App với TypeScript trong thư mục `mobile/`.
- [x] Giữ màn hình mẫu tối giản để xác nhận quá trình render hoạt động.
- [x] Chạy Expo development server thành công.
- [ ] Mở và kiểm tra ứng dụng trên iOS Simulator hoặc thiết bị iOS.
- [ ] Mở và kiểm tra ứng dụng trên Android Emulator hoặc thiết bị Android.
- [x] Chạy kiểm tra TypeScript và xử lý toàn bộ lỗi.

### Tiêu chí hoàn thành Phase 1

- [x] Mã nguồn Expo nằm trong `mobile/`; thư mục `plans/` vẫn nằm ở repository root.
- [x] Development server khởi động không lỗi.
- [ ] Màn hình mẫu hiển thị đúng trên cả iOS và Android.
- [x] Kiểm tra TypeScript hoàn tất không có lỗi.
- [x] Chưa có dependency, dữ liệu hoặc tính năng trading.

## Phase 2 — Nền tảng ứng dụng

- [ ] Cấu hình Expo Router và tab navigation.
- [ ] Tạo cấu trúc thư mục cho route, component, hook, store, service, model và theme.
- [ ] Thiết lập ESLint, Prettier và alias import.
- [ ] Định nghĩa màu sắc, typography và spacing dùng chung.
- [ ] Hỗ trợ light mode và dark mode.
- [ ] Tạo các component nền tảng và xử lý safe area.

### Tiêu chí hoàn thành Phase 2

- [ ] Có thể điều hướng giữa các tab và màn hình mẫu.
- [ ] Lint và TypeScript hoàn tất không có lỗi.
- [ ] Theme sáng/tối và safe area hoạt động trên iOS và Android.

## Phase 3 — Dữ liệu và state

- [ ] Thêm Zustand để quản lý state của ứng dụng.
- [ ] Thêm AsyncStorage để lưu dữ liệu cục bộ.
- [ ] Định nghĩa các type `Asset`, `PricePoint`, `Order`, `Position` và `Portfolio`.
- [ ] Tạo mock market service với dữ liệu mẫu, độ trễ và khả năng mô phỏng lỗi.
- [ ] Tạo store cho watchlist, lệnh và danh mục.
- [ ] Lưu và khôi phục watchlist, lịch sử lệnh và danh mục trên thiết bị.

### Tiêu chí hoàn thành Phase 3

- [ ] Mock service trả về dữ liệu thị trường đúng type.
- [ ] Store cập nhật state chính xác.
- [ ] Dữ liệu được khôi phục sau khi đóng và mở lại ứng dụng.
- [ ] Loading và lỗi giả lập có thể được kiểm tra độc lập.

## Phase 4 — Theo dõi thị trường

- [ ] Xây dựng màn hình tổng quan với tài sản nổi bật và biến động giá.
- [ ] Xây dựng watchlist với thao tác thêm, xóa và sắp xếp tài sản.
- [ ] Xây dựng màn hình chi tiết tài sản.
- [ ] Thêm biểu đồ lịch sử giá tương thích với Expo.
- [ ] Hoàn thiện trạng thái loading, lỗi và dữ liệu rỗng.
- [ ] Đảm bảo bố cục responsive và vùng chạm phù hợp trên iOS/Android.

### Tiêu chí hoàn thành Phase 4

- [ ] Người dùng xem được tổng quan thị trường từ dữ liệu giả lập.
- [ ] Watchlist có thể chỉnh sửa và được lưu cục bộ.
- [ ] Chi tiết tài sản và biểu đồ hiển thị đúng.
- [ ] Người dùng có thể thử lại sau khi mock service trả về lỗi.

## Phase 5 — Giao dịch mô phỏng

- [ ] Xây dựng form đặt lệnh mua/bán mô phỏng.
- [ ] Kiểm tra số lượng, giá, số dư và dữ liệu nhập trước khi đặt lệnh.
- [ ] Cập nhật số dư, vị thế và lịch sử lệnh sau khi khớp lệnh mô phỏng.
- [ ] Xây dựng màn hình danh mục với tổng giá trị và lãi/lỗ.
- [ ] Xây dựng màn hình cài đặt để đổi theme.
- [ ] Thêm chức năng đặt lại toàn bộ dữ liệu mô phỏng.

### Tiêu chí hoàn thành Phase 5

- [ ] Lệnh hợp lệ cập nhật số dư và vị thế chính xác.
- [ ] Lệnh không hợp lệ hiển thị lỗi và không thay đổi danh mục.
- [ ] Danh mục hiển thị đúng tổng giá trị và lãi/lỗ.
- [ ] Dữ liệu sau giao dịch được lưu và khôi phục trên thiết bị.
- [ ] Chức năng đặt lại đưa ứng dụng về trạng thái mặc định.

## Phase 6 — Kiểm thử và đóng gói

- [ ] Viết unit test cho số dư, giá trị danh mục và lãi/lỗ.
- [ ] Viết test cho store, persistence và xử lý lệnh.
- [ ] Viết component test cho form giao dịch và các trạng thái loading, lỗi, rỗng.
- [ ] Kiểm tra responsive, accessibility, nhãn điều khiển và độ tương phản.
- [ ] Chạy lint và kiểm tra TypeScript.
- [ ] Chuẩn bị tên ứng dụng, bundle identifier và package name.
- [ ] Thêm icon, adaptive icon và splash screen.
- [ ] Cấu hình EAS Build cho iOS và Android.
- [ ] Tạo preview build và chạy thử trên cả hai nền tảng.
- [ ] Ghi hướng dẫn cài đặt, chạy, kiểm thử và build vào README.

### Tiêu chí hoàn thành Phase 6

- [ ] Toàn bộ test, lint và TypeScript đều vượt qua.
- [ ] Các luồng chính hoạt động trên iOS và Android.
- [ ] Preview build được tạo và cài đặt thành công trên cả hai nền tảng.
- [ ] README có đủ hướng dẫn để một kỹ sư khác chạy và build ứng dụng.

## Quy tắc thực hiện

- [ ] Chỉ bắt đầu phase tiếp theo sau khi toàn bộ tiêu chí của phase hiện tại hoàn thành.
- [ ] Mỗi phase được kiểm tra trên cả iOS và Android trước khi đóng phase.
- [ ] Không mở rộng MVP sang backend production, xác thực, kết nối sàn hoặc giao dịch tiền thật.
