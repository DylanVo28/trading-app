# Kế hoạch component Hyperliquid BTC Candlestick Chart

## Tóm tắt

Xây dựng `HyperliquidBtcChart` cho Expo 57, gồm nến BTC realtime, volume/SMA, OHLC, timeframe `5m | 1h | 1d`, current-price line, crosshair, pan và pinch-to-zoom. Không triển khai drawing tools hoặc indicators nâng cao.

## Phase 1 — Dependency, kiểu dữ liệu và cấu trúc feature

- [x] Cài bằng `npx expo install`:
  - `react-native-svg`
  - `react-native-gesture-handler`
  - `react-native-reanimated`
  - `react-native-worklets`
- [x] Tạo feature `mobile/src/features/btc-chart/`.
- [x] Định nghĩa `BtcChartInterval = '5m' | '1h' | '1d'`.
- [x] Định nghĩa candle đã chuẩn hóa gồm `openTime`, `closeTime`, `open`, `high`, `low`, `close`, `volume` và `tradeCount`.
- [x] Định nghĩa trạng thái dữ liệu `loading | live | reconnecting | error`.
- [x] Tạo mapping duration cho từng timeframe và constants cho 300 candle lịch sử, timeout, heartbeat và reconnect.
- [x] Không dùng `any`; mọi dữ liệu bên ngoài bắt đầu từ `unknown`.

### Tiêu chí hoàn thành Phase 1

- [x] Dependency tương thích Expo 57 và chạy được trong Expo Go.
- [x] TypeScript nhận đúng các interval được hỗ trợ.
- [x] Feature chart không làm thay đổi interface của `btc-market`.

## Phase 2 — Hyperliquid REST và chuẩn hóa candle

- [x] Tạo REST client gọi `POST https://api.hyperliquid.xyz/info`.
- [x] Gửi body:

  ```json
  {
    "type": "candleSnapshot",
    "req": {
      "coin": "BTC",
      "interval": "1d",
      "startTime": 0,
      "endTime": 0
    }
  }
  ```

- [x] Tính `startTime` để tải 300 candle gần nhất và đặt `endTime = Date.now()`.
- [x] Timeout request sau 10 giây bằng `AbortController`.
- [x] Chấp nhận price/volume dạng `string | number` nhưng chỉ trả ra số hữu hạn.
- [x] Kiểm tra:
  - Coin và interval phải khớp request.
  - Timestamp hợp lệ và `closeTime >= openTime`.
  - `high >= max(open, close)` và `low <= min(open, close)`.
  - Volume không âm, trade count là số nguyên không âm.
- [x] Sort tăng dần và deduplicate theo `openTime`.
- [x] Payload sai trả lỗi có kiểm soát thay vì render dữ liệu một phần.

### Tiêu chí hoàn thành Phase 2

- [x] REST trả đúng tối đa 300 candle BTC.
- [x] Payload string/number đều được chuẩn hóa chính xác.
- [x] Malformed response không tạo `NaN`, `Infinity` hoặc candle sai.
- [x] Request có thể bị hủy khi đổi timeframe hoặc unmount.

## Phase 3 — Hook dữ liệu candle realtime

- [x] Tạo hook nội bộ `useBtcCandles(interval)`.
- [x] Tải REST snapshot trước, sau đó kết nối `wss://api.hyperliquid.xyz/ws`.
- [x] Subscribe:

  ```json
  {
    "method": "subscribe",
    "subscription": {
      "type": "candle",
      "coin": "BTC",
      "interval": "1d"
    }
  }
  ```

- [x] Bỏ qua `subscriptionResponse`, `pong` và message không thuộc BTC/timeframe hiện tại.
- [x] Candle trùng `openTime` cập nhật candle đang chạy; candle mới được append.
- [x] Merge dữ liệu out-of-order theo timestamp và giữ tối đa 300 candle.
- [x] Khi đổi timeframe:
  - Hủy REST request cũ.
  - Unsubscribe hoặc đóng socket cũ.
  - Bỏ qua callback từ phiên cũ bằng run identifier.
  - Dùng cache memory theo timeframe nếu đã tải trước đó.
- [x] Gửi ping mỗi 30 giây.
- [x] Reconnect bằng exponential backoff có jitter, tối đa 30 giây.
- [x] Sau reconnect, tải REST snapshot để backfill phần dữ liệu bị bỏ lỡ.
- [x] Poll REST mỗi 15 giây khi WebSocket chưa phục hồi.
- [x] Đóng socket/timer khi app background; refresh và reconnect khi foreground.
- [x] Giữ candle cuối khi reconnect; chỉ hiện màn hình lỗi nếu chưa có snapshot.

### Tiêu chí hoàn thành Phase 3

- [x] Candle đang chạy cập nhật mà không reload component.
- [x] Timeframe cũ không ghi đè timeframe mới.
- [x] Mất mạng không xóa dữ liệu đang hiển thị.
- [x] Không nhân đôi socket, heartbeat, polling hoặc reconnect timer.

## Phase 4 — Chart math và SVG renderer

- [x] Tạo các hàm thuần để tính visible window, candle width, price domain, volume domain và tọa độ SVG.
- [x] Mặc định hiển thị 60 candle cuối trong tổng số 300 candle.
- [x] Price pane chiếm khoảng 72%, volume pane chiếm 28%.
- [x] Price domain lấy từ high/low của candle đang thấy và thêm padding 5%.
- [x] Render bằng `react-native-svg`:
  - Grid dọc/ngang.
  - Candle body và wick.
  - Volume bars cùng màu tăng/giảm với candle.
  - Volume SMA 20 kỳ.
  - Trục giá bên phải.
  - Trục thời gian UTC phía dưới.
  - Dotted current-price line và nhãn giá.
- [x] Dùng teal cho candle tăng, đỏ hồng cho candle giảm và màu trung tính cho doji.
- [x] Dùng formatter hiện có của `btc-market`; không hiển thị `NaN` hoặc `Infinity`.
- [x] Giảm số lượng tick theo chiều rộng để label không chồng nhau.

### Tiêu chí hoàn thành Phase 4

- [x] OHLC, volume và SMA khớp fixture.
- [x] Candle không vượt khỏi chart bounds.
- [x] Trục giá/thời gian đọc được ở chiều rộng 320dp.
- [x] Realtime update chỉ thay đổi candle liên quan, không reset viewport.

## Phase 5 — Component UI và tương tác

- [x] Tạo public component `HyperliquidBtcChart`.
- [x] Toolbar hiển thị `5m`, `1h`, `D`; mặc định chọn `D`.
- [x] Hiển thị title `BTC-USDC · 1D · Hyperliquid` và chấm trạng thái live.
- [x] Hiển thị dòng OHLC của candle mới nhất.
- [x] Long press và kéo để:
  - Chọn candle gần nhất.
  - Hiện crosshair ngang/dọc.
  - Thay OHLC và volume bằng candle được chọn.
  - Trở lại candle mới nhất khi thả.
- [x] Kéo ngang để pan trong giới hạn 300 candle.
- [x] Pinch-to-zoom thay đổi candle width trong khoảng 4–20dp.
- [x] Gesture transform chạy trên UI thread; tính lại visible domain khi gesture kết thúc.
- [x] Nếu viewport đang ở mép phải, candle mới tự động được theo dõi.
- [x] Nếu người dùng đang xem lịch sử, giữ nguyên viewport và hiện nút `Latest`.
- [x] Loading dùng skeleton; lỗi lần đầu có Retry; reconnect giữ nguyên chart.
- [x] Component có accessibility summary cho interval và OHLC; button có vùng chạm tối thiểu 44×44.

### Tiêu chí hoàn thành Phase 5

- [x] Giao diện gần với chart trong ảnh về màu sắc, bố cục và mật độ thông tin.
- [x] Pan, zoom và crosshair hoạt động mượt trên iOS/Android.
- [x] Thay timeframe không hiển thị nhầm dữ liệu cũ.
- [x] Live update không kéo người dùng khỏi vùng lịch sử đang xem.

## Phase 6 — Tích hợp ứng dụng

- [x] Bọc root bằng `GestureHandlerRootView`.
- [x] Gắn `HyperliquidBtcChart` dưới `BtcMarketHeader` trong `mobile/App.tsx`.
- [x] Component tự tính chiều cao responsive trong khoảng 440–620dp nếu không có prop `height`.
- [x] Export component, props và interval từ feature index.
- [x] Giữ nguyên orientation portrait và market header hiện có.
- [x] Không thêm wallet, authentication, order execution hoặc API key.

### Tiêu chí hoàn thành Phase 6

- [x] Header và chart dùng chung màu sắc, format giá và tên market.
- [x] Chart hiển thị đúng ở 320dp, 375dp và tablet.
- [x] Không phát sinh lỗi gesture với vùng cuộn của màn hình.
- [x] TypeScript build thành công.

## Phase 7 — Kiểm thử và nghiệm thu

- [ ] Unit test parser với payload hợp lệ, malformed, string/number, sai coin/interval và timestamp trùng.
- [ ] Unit test merge realtime, append candle, backfill, giới hạn 300 candle và SMA 20.
- [ ] Unit test price scale, volume scale, viewport bounds và candle coordinate.
- [ ] Hook test REST bootstrap, interval race, WebSocket update, heartbeat, reconnect, polling và cleanup.
- [ ] Component test loading, error/Retry, reconnecting, timeframe, OHLC, Latest và accessibility.
- [ ] Kiểm tra thủ công trên iOS và Android:
  - Pan, pinch và crosshair.
  - Realtime update và chuyển candle mới.
  - Mạng chậm, mất mạng và phục hồi.
  - Background/foreground.
  - Màn hình 320dp, 375dp và tablet.
- [ ] Chạy `npm run typecheck` và Jest suite trước khi nghiệm thu.

### Tiêu chí hoàn thành Phase 7

- [ ] Toàn bộ unit/component test vượt qua.
- [ ] Không còn socket hoặc timer sau unmount.
- [ ] Không crash hoặc reset viewport trong quá trình realtime.
- [ ] UI đáp ứng tiêu chí MVP trên cả iOS và Android.

## Interface công khai

```ts
export type BtcChartInterval = '5m' | '1h' | '1d';

export interface HyperliquidBtcChartProps {
  initialInterval?: BtcChartInterval;
  height?: number;
}
```

- `initialInterval` mặc định là `1d`.
- `height` không truyền sẽ dùng kích thước responsive 440–620dp.
- Candle wire types, hook dữ liệu và chart math giữ internal.

## Giả định và tài liệu

- Chỉ hỗ trợ BTC perpetual mainnet; UI dùng tên `BTC-USDC`.
- Không bao gồm tabs Order Book/Trades/Funding, drawing tools, indicators tùy chọn, date range, log/% scale hoặc fullscreen.
- Hyperliquid hỗ trợ các interval và tối đa 5.000 candle gần nhất qua [`candleSnapshot`](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint#candle-snapshot).
- Realtime dựa trên [WebSocket subscriptions](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions) và [timeouts/heartbeats](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/timeouts-and-heartbeats).
- Dependency tuân theo Expo 57 cho [SVG](https://docs.expo.dev/versions/v57.0.0/sdk/svg/), [Gesture Handler](https://docs.expo.dev/versions/v57.0.0/sdk/gesture-handler/) và [Reanimated](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/).
