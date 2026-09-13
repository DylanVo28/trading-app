# Kế hoạch component Hyperliquid BTC Order Book

File dự kiến: [plans/hyperliquid-btc-orderbook.md](/Users/dinh/WebstormProjects/trading-app/plans/hyperliquid-btc-orderbook.md). Chưa ghi file trong Plan Mode.

## Tóm tắt

Xây dựng component `HyperliquidBtcOrderBook` cho ứng dụng Expo 57/React Native hiện tại, bám sát ảnh tham chiếu.

- BTC perpetual mainnet cố định; Total luôn tính bằng BTC.
- Hiển thị 15 hàng mỗi bên: bids bên trái, asks bên phải, kèm thanh độ sâu.
- Có menu chọn độ gộp giá; góc phải hiển thị BTC dạng nhãn.
- Tích hợp thanh tab `Chart | Order Book | Trades | Funding`; Chart và Order Book hoạt động, hai tab còn lại vô hiệu hóa.
- Mặc định mở Order Book. Chỉ đọc dữ liệu public, không thêm chức năng đặt lệnh.

Thực hiện tuần tự; mỗi phase có checklist và tiêu chí hoàn thành.

## Phase 1 — Cấu trúc feature và interface

- [x] Tạo feature tại [mobile/src/features/btc-orderbook/](/Users/dinh/WebstormProjects/trading-app/mobile/src/features/btc-orderbook/), tách component, hook, REST/WebSocket client, types và hàm tính toán.
- [x] Định nghĩa snapshot chuẩn hóa gồm `coin`, `time`, `bids`, `asks`; mỗi level có `price`, `size`, `orderCount`.
- [x] Hook nội bộ trả snapshot, `status`, `lastUpdatedAt`, `error`, `retry`; status gồm `loading | live | reconnecting | error`.
- [x] Dữ liệu ngoài bắt đầu từ `unknown`; không dùng `any`. Dùng React Native primitives và dependency hiện có.
- [x] Export component cùng interface:

```ts
export type BtcOrderBookAggregation =
  | '5sf-1'
  | '5sf-2'
  | '5sf-5'
  | '4sf'
  | '3sf';

export interface HyperliquidBtcOrderBookProps {
  initialAggregation?: BtcOrderBookAggregation;
  rows?: number;
  enabled?: boolean;
}
```

Mặc định: `initialAggregation = '5sf-1'`, `rows = 15`, `enabled = true`. Giới hạn số hàng trong khoảng 1–20.

**Hoàn thành khi:** interface rõ ràng, TypeScript hợp lệ và data layer độc lập với UI.

## Phase 2 — REST snapshot và độ gộp giá

- [ ] Gọi `POST https://api.hyperliquid.xyz/info` với body mặc định:

```json
{
  "type": "l2Book",
  "coin": "BTC",
  "nSigFigs": 5,
  "mantissa": 1
}
```

- [ ] Dùng `AbortController`, timeout 10 giây; phân biệt lỗi mạng, HTTP, timeout và payload sai.
- [ ] Parse `levels[0]` thành bids, `levels[1]` thành asks; kiểm tra coin, timestamp, giá dương, size không âm và order count hợp lệ. Level size bằng 0 không tạo hàng hiển thị.
- [ ] Ánh xạ các preset `5sf-1/2/5` sang `nSigFigs: 5` cùng mantissa tương ứng; `4sf/3sf` chỉ gửi `nSigFigs`.
- [ ] Dùng aggregation phía server. REST trả tối đa 20 level mỗi bên; không tự gom 20 level nguyên bản để suy ra độ sâu lớn hơn. [Tài liệu L2 book](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint#l2-book-snapshot)
- [ ] Nhãn menu phản ánh bước giá theo preset và độ lớn của giá tham chiếu: quanh 77.000 là `1, 2, 5, 10, 100`; quanh 100.000 là `10, 20, 50, 100, 1,000`. Tính bằng `mantissa × 10^(floor(log10(price)) − nSigFigs + 1)`, mantissa mặc định 1.
- [ ] Giá tham chiếu lấy midpoint của best bid/ask, hoặc phía còn dữ liệu. Khi hai phía nằm khác mốc lũy thừa 10, hiển thị tên độ chính xác thay cho một bước giá duy nhất.

**Hoàn thành khi:** snapshot BTC hợp lệ được chuẩn hóa; mọi preset gửi đúng request và không gắn cố định `nSigFigs: 5` với bước giá 1.

## Phase 3 — WebSocket và vòng đời dữ liệu

- [ ] Khi được kích hoạt, chạy REST bootstrap và kết nối `wss://api.hyperliquid.xyz/ws` song song.
- [ ] Subscribe `l2Book`, `coin: "BTC"`, cùng aggregation hiện tại và `fast: false` để có tối đa 20 level mỗi bên. Mỗi message là snapshot thay thế toàn bộ book, không merge như delta. [WebSocket subscriptions](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions)
- [ ] Chỉ xử lý đúng channel/coin; bỏ qua acknowledgment và message không liên quan. Chỉ đánh dấu `live` sau snapshot WebSocket hợp lệ.
- [ ] So sánh server `time` trong cùng phiên; REST về chậm không ghi đè snapshot mới hơn. Khi timestamp bằng nhau, ưu tiên WebSocket.
- [ ] Khi đổi aggregation: hủy request, đóng socket cũ, tăng generation ID và tải phiên mới. Hiện skeleton đến khi có dữ liệu đúng preset.
- [ ] Gửi ping mỗi 30 giây, chờ pong tối đa 10 giây; thiếu pong thì reconnect. Backoff bắt đầu 1 giây, tăng gấp đôi có jitter, tối đa 30 giây. [Heartbeat protocol](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/timeouts-and-heartbeats)
- [ ] Khi mất kết nối, giữ snapshot cuối với nhãn `Reconnecting`; poll REST mỗi 15 giây, không chạy request chồng nhau. Dừng polling khi nhận snapshot WebSocket hợp lệ.
- [ ] Nếu không có book update trong 15 giây nhưng socket còn phản hồi, dùng REST kiểm tra lại; giá/khối lượng không đổi vẫn là dữ liệu hợp lệ.
- [ ] Khi background, `enabled = false` hoặc unmount: dọn socket, request và timer. Khi active lại, refresh REST và subscribe lại.
- [ ] Nếu chưa có dữ liệu và cả hai nguồn đều thất bại, hiển thị lỗi với Retry; REST lỗi riêng không ngăn WebSocket hoạt động.

**Hoàn thành khi:** cập nhật realtime đúng, không lẫn preset, không mất snapshot khi mất mạng và không rò rỉ tài nguyên.

## Phase 4 — Tính toán và giao diện theo ảnh

- [ ] Sort bids giảm dần, asks tăng dần; best bid/ask cùng nằm ở hàng đầu. Không tạo level giả để lấp khoảng trống giá.
- [ ] Tính `Total[i] = sum(size[0..i])` riêng từng phía, trước khi làm tròn.
- [ ] Thanh độ sâu dùng `total / max(total cuối của hai phía đang hiển thị)`; mẫu số bằng 0 thì chiều rộng bằng 0.
- [ ] Bố cục bốn cột: `Total (BTC) | Price | Price | Total (BTC)`. Giá nằm gần trục giữa, totals nằm ngoài.
- [ ] Thanh bid mở rộng từ giữa sang trái; thanh ask từ giữa sang phải; màu nền nằm phía sau chữ và không vượt sang nửa còn lại.
- [ ] Dùng nền tối và màu tăng/giảm hiện có; chữ số tabular, giá có dấu phân cách hàng nghìn, Total cố định 5 số thập phân. Không hiện `NaN` hoặc `Infinity`.
- [ ] Menu aggregation dùng `Modal` và `Pressable`; nhãn BTC không có chevron theo lựa chọn BTC cố định tối giản.
- [ ] Render hàng bằng `View`, không thêm vùng cuộn lồng trong màn hình. Hàng tối thiểu 26dp, tăng chiều cao theo font scale; giữ hai phía ở chiều rộng 320dp.
- [ ] Loading giữ bố cục bằng skeleton; book rỗng hiện thông báo; phía thiếu level hiện ô trống, không lặp dữ liệu.
- [ ] Control có vùng chạm tối thiểu 44×44; accessibility đọc rõ bid/ask, giá và tổng cộng dồn.

**Hoàn thành khi:** bố cục và hướng thanh độ sâu giống ảnh; các tổng và tỷ lệ đúng với fixture; số liệu đọc được trên màn hình nhỏ.

## Phase 5 — Tích hợp tabs với chart hiện có

- [ ] Tạo `BtcMarketTabs` dưới market header trong [mobile/App.tsx](/Users/dinh/WebstormProjects/trading-app/mobile/App.tsx).
- [ ] Hiển thị bốn tab bằng nhau, underline teal cho tab đang chọn; mặc định `Order Book`.
- [ ] Chart và Order Book chuyển đổi được. Trades/Funding có trạng thái `disabled` và accessibility tương ứng.
- [ ] Mount panel khi được mở lần đầu, sau đó giữ mounted để bảo toàn grouping, timeframe và viewport khi đổi tab.
- [ ] Bổ sung `enabled?: boolean`, mặc định `true`, cho `HyperliquidBtcChart` và truyền xuống hook candle để tạm dừng dữ liệu khi tab bị ẩn.
- [ ] Panel ẩn không chiếm layout, không nhận tương tác hoặc focus accessibility. Panel hiển thị lại refresh dữ liệu; chart giữ chế độ xem lịch sử/Latest hiện có.

**Hoàn thành khi:** chuyển tab đúng, giữ trạng thái xem và chỉ panel đang hiển thị chạy kết nối dữ liệu của panel đó.

## Phase 6 — Kiểm thử và nghiệm thu

- [ ] Cấu hình `jest-expo` và script test từ dependency đã có; giữ nguyên các thay đổi đang tồn tại trong working tree.
- [ ] Unit test parser: payload hợp lệ/sai, numeric strings, sai coin, level bằng 0, book rỗng và thiếu một phía.
- [ ] Unit test sorting, tổng cộng dồn, độ rộng thanh, formatter và nhãn aggregation quanh mốc 100.000.
- [ ] Hook test REST/WebSocket race, snapshot thay thế, timestamp cũ, đổi preset nhanh, timeout, reconnect, fallback polling, Retry và cleanup.
- [ ] Component test loading/error/empty/reconnecting, menu aggregation, tabs disabled và giữ trạng thái khi chuyển tab.
- [ ] Kiểm tra thủ công iOS/Android ở 320dp, 375dp và tablet; tăng font, mất mạng/phục hồi, background/foreground và đổi tab liên tục.
- [ ] Chạy `npm run typecheck` và Jest suite; đối chiếu fixture với ảnh và smoke test dữ liệu Hyperliquid thật.

**Hoàn thành khi:** kiểm tra tự động vượt qua, UI đạt bố cục tham chiếu, chart/header vẫn hoạt động và không còn socket/timer sau khi dừng feature.

## Giả định đã chốt

- Chỉ BTC perpetual mainnet, Total bằng BTC; chưa có market picker hoặc đổi đơn vị.
- Labels UI dùng tiếng Anh để đồng bộ ứng dụng và ảnh; plan viết tiếng Việt.
- Không cần backend, API key hoặc runtime dependency mới.
- Tuân theo [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) khi triển khai.
