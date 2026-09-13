# Kế hoạch tính năng Hyperliquid BTC Market Header

## Tóm tắt

Xây dựng market header giống ảnh tham chiếu cho ứng dụng Expo 57 hiện tại.

- Cố định market `BTC-USDC`, không làm market picker.
- Hiển thị giá realtime, biến động 24h, đòn bẩy tối đa, Mark/Oracle, Volume, Open Interest, Funding và countdown.
- REST dùng để tải snapshot ban đầu/fallback; WebSocket dùng để cập nhật realtime.
- Chỉ đọc dữ liệu public, không kết nối ví hoặc gửi lệnh thật.
- Component có trạng thái mở rộng/thu gọn và được gắn vào `mobile/App.tsx`.

## Phase 1 — Kiểu dữ liệu và Hyperliquid REST service

- [ ] Tạo feature-local types, formatter và service để không phụ thuộc UI.
- [ ] Gọi `POST https://api.hyperliquid.xyz/info` với `{ "type": "metaAndAssetCtxs" }`.
- [ ] Tìm `BTC` trong `universe`, lấy metadata và asset context cùng index.
- [ ] Chuẩn hóa các giá trị wire dạng `string | number`; từ chối response thiếu, lệch index hoặc chứa số không hợp lệ.
- [ ] Timeout REST sau 10 giây bằng `AbortController`.

### Tiêu chí hoàn thành Phase 1

- [ ] Fixture API hợp lệ tạo được `BtcMarketSnapshot`.
- [ ] Malformed response trả lỗi có kiểm soát.
- [ ] TypeScript không dùng `any`.

## Phase 2 — Hook dữ liệu realtime

- [ ] Tạo `useBtcMarketData()` với `loading | live | reconnecting | error`, snapshot, `lastUpdatedAt` và `retry()`.
- [ ] Sau REST bootstrap, kết nối `wss://api.hyperliquid.xyz/ws` và subscribe `activeAssetCtx` cho BTC.
- [ ] Bỏ qua subscription acknowledgment/pong và chỉ nhận đúng channel/coin.
- [ ] Gửi heartbeat mỗi 30 giây và dọn socket/timer khi unmount.
- [ ] Reconnect với exponential backoff có jitter, tối đa 30 giây.
- [ ] Poll REST mỗi 15 giây khi WebSocket chưa phục hồi.
- [ ] Đóng socket khi app background; REST refresh và reconnect khi active.
- [ ] Coi dữ liệu là stale nếu không có update hợp lệ trong 15 giây.

### Tiêu chí hoàn thành Phase 2

- [ ] Giá cập nhật không cần refresh màn hình.
- [ ] Mất mạng không xóa snapshot cũ.
- [ ] Socket/timer không bị nhân đôi sau reconnect hoặc remount.

## Phase 3 — Tính toán và định dạng hiển thị

- [ ] Giá chính dùng `midPx ?? markPx`.
- [ ] Thay đổi 24h dùng giá chính trừ `prevDayPx`; phần trăm chia cho `prevDayPx`.
- [ ] Open Interest USD dùng `openInterest × oraclePx`.
- [ ] Funding hiển thị `funding × 100` với 4 chữ số thập phân.
- [ ] Countdown tính tới đầu giờ UTC kế tiếp và cập nhật mỗi giây.
- [ ] Dùng `Intl.NumberFormat("en-US")`; không bao giờ hiển thị `NaN` hoặc `Infinity`.
- [ ] Dùng teal cho tăng, hồng đỏ cho giảm và màu trung tính khi không đổi.

### Tiêu chí hoàn thành Phase 3

- [ ] Payload tương đương ảnh hiển thị đúng leverage, Mark/Oracle, volume, OI, funding và biến động 24h.

## Phase 4 — Component và tích hợp UI

- [ ] Tạo `BtcMarketHeader` với icon Bitcoin, market, leverage, giá, biến động và grid metrics.
- [ ] Chevron có vùng chạm tối thiểu 44×44; mặc định mở rộng.
- [ ] Khi thu gọn chỉ giữ hàng market, leverage, giá, biến động và chevron.
- [ ] Dưới 360dp chuyển metrics thành một cột.
- [ ] Loading dùng skeleton; lỗi lần đầu có Retry; reconnect giữ snapshot cuối.
- [ ] Bổ sung accessibility label/state cho control và metrics.
- [ ] Gắn component vào `mobile/App.tsx` nhưng giữ data layer độc lập.

### Tiêu chí hoàn thành Phase 4

- [ ] Giao diện khớp ảnh ở chiều rộng khoảng 375dp.
- [ ] Thu gọn/mở rộng đúng trên iOS và Android.

## Phase 5 — Kiểm thử và nghiệm thu

- [ ] Cấu hình `jest-expo`, Jest và `@testing-library/react-native` theo Expo 57.
- [ ] Unit test mapping, normalization, công thức, formatter và malformed payload.
- [ ] Hook test REST bootstrap, WebSocket update, retry/backoff, fallback polling và cleanup.
- [ ] Component test loading, live, error/retry, reconnecting, collapse và accessibility.
- [ ] Kiểm tra thủ công trên iOS/Android với mạng chậm, airplane mode, background/foreground và nhiều kích thước màn hình.
- [ ] Chạy `npm run typecheck` và test suite trước khi đóng phase.

## Interface công khai

- `BtcMarketSnapshot`: snapshot BTC đã chuẩn hóa; mọi giá trị số đều hữu hạn.
- `MarketDataStatus`: `loading | live | reconnecting | error`.
- `useBtcMarketData()`: trả snapshot, status, thời điểm cập nhật cuối và hàm retry.
- `BtcMarketHeaderProps`: chỉ có `initialExpanded?: boolean`, mặc định `true`.
- Không thêm backend, API key, wallet address hoặc runtime dependency.

## Giả định và tài liệu

- Hyperliquid API gọi perpetual là `BTC`; UI hiển thị `BTC-USDC`.
- Leverage lấy động từ metadata, không hard-code `40x`.
- Chỉ dùng REST/WebSocket mainnet.
- Không sửa roadmap hiện có.
- Tài liệu chính thức: [API overview](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api), [Perpetuals info endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals), [WebSocket](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket), [Subscriptions](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions), [Timeouts and heartbeats](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/timeouts-and-heartbeats), [Rate limits](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits), [Funding](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding), [Robust price indices](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/robust-price-indices) và [Expo 57](https://docs.expo.dev/versions/v57.0.0/).
