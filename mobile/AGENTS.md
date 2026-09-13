# AGENTS.md
## Coding rules
* Khi truy cập thuộc tính lồng nhau của object, ưu tiên sử dụng `get` của Lodash thay cho optional chaining.
```ts 
// Không ưu tiên 
object?.a?.b 
// Ưu tiên 
get(object, 'a.b', defaultvalue) 
``` 
* Thiết kế component với số lượng props tối thiểu cần thiết, dưới 5 props là đủ.
* Tránh truyền quá nhiều props vào một component. Nếu component có nhiều props, hãy cân nhắc:
* Chia component thành các component nhỏ hơn.
* Gom các props có liên quan thành một object có type rõ ràng.
* Đưa business logic vào custom hook.
* Sử dụng composition khi phù hợp.
* Tránh tạo inline callback nếu callback chỉ truyền nguyên event vào handler.
* Handler phải nhận trực tiếp event và tự xử lý dữ liệu bên trong. Tránh tạo inline callback trong JSX chỉ để lấy value.
```tsx 
// Không nên 
const handleChange = (value: string) => { 
setValue(value) 
} 
<input onChange={(event) => handleChange(event.currentTarget.value)} /> 
// Nên 
const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => { 
setValue(event.currentTarget.value) 
} 
<input onChange={handleChange} /> 
``` 
* Không sử dụng toán tử ba ngôi để quyết định giá trị trả về. Ưu tiên if kết hợp với early return để code dễ đọc hơn.
```tsx 
// Không nên 
return condition ? <ComponentA /> : <ComponentB /> 
// Nên 
if (condition) { 
 return <ComponentA /> 
} 
return <ComponentB /> 
``` 
* Không import get trực tiếp từ package lodash. Hãy import riêng module lodash/get để tránh đưa các phần không cần thiết của Lodash vào bundle.
```tsx 
// Không nên 
import { get } from 'lodash' 
// Nên 
import _get from 'lodash/get' 
``` 
* Không sử dụng magic number hoặc magic string
  Đưa các giá trị mang ý nghĩa nghiệp vụ vào constant có tên mô tả rõ mục đích.
  Có thể viết trực tiếp các giá trị hiển nhiên, chỉ dùng một lần và không mang ý nghĩa nghiệp vụ.
```tsx 
// Không nên: 
const discountedPrice = price - price * 0.1 
Nên: 
 const DISCOUNT_RATE = 0.1 
const discountedPrice = price - price * DISCOUNT_RATE 
``` 
* Hạn chế sử dụng nhiều câu lệnh `if` lồng nhau. Nếu các điều kiện không có logic xử lý riêng, hãy gộp chúng thành một điều kiện duy nhất.
```tsx 
// Không nên 
if (conditionA) { 
 if (conditionB) { 
 if (conditionC) { 
 handleAction() 
 } 
 } 
} 
``` 
```tsx 
// Nên 
if (conditionA && conditionB && conditionC) { 
 handleAction() 
} 
``` 
* Tránh sử dụng số trực tiếp để đại diện cho loại hoặc trạng thái vì chúng khó đọc và dễ nhầm lẫn. Hãy sử dụng constant object với tên có ý nghĩa.
```tsx 
// Không nên 
const EMAIL_ACCOUNT_INDEX = 0 
const QR_ACCOUNT_INDEX = 1 
const INITIAL_ACCOUNT_INDEX = EMAIL_ACCOUNT_INDEX 
``` 
```tsx 
// Nên 
const ACCOUNT_TYPE = { 
 EMAIL: 'EMAIL', 
 QR: 'QR', 
} 
const INITIAL_ACCOUNT_TYPE = ACCOUNT_TYPE.EMAIL 
``` 
* Sử dụng `useMemo` cho các giá trị dạng array hoặc object được tạo từ phép biến đổi dữ liệu và truyền xuống component con, khi cần giữ reference ổn định giữa các lần render.
```tsx 
// Không nên 
<SegmentTab 
 options={LOGIN_ACCOUNT_TYPES.map(({ key, labelKey }) => ({ 
 key, 
 testID: `tab_${key}`, 
 label: translate(labelKey), 
 }))} 
/> 
``` 
```tsx 
// Nên 
const loginAccountOptions = useMemo( 
 () => 
 LOGIN_ACCOUNT_TYPES.map(({ key, labelKey }) => ({ 
 key, 
 testID: `tab_${key}`, 
 label: translate(labelKey), 
 })), 
 [translate] 
) 
return <SegmentTab options={loginAccountOptions} /> 
``` 
* Không lạm dụng `useMemo` cho các giá trị đơn giản hoặc phép tính không ảnh hưởng đáng kể đến hiệu năng.
* Không tạo hàm `render...()` chỉ để trả về một component. Hãy truyền JSX trực tiếp hoặc tách thành một React component có tên rõ ràng.
```tsx 
// Không nên 
const renderFooter = () => { 
 return <Footer /> 
} 
return <Component footer={renderFooter()} /> 
``` 
```tsx 
// Nên — truyền trực tiếp 
return <Component footer={<Footer />} /> 
``` 
```tsx 
// Nên — tách component nếu có logic hoặc giao diện riêng 
const LoginFooter = () => { 
 return <Footer /> 
} 
return <Component footer={<LoginFooter />} /> 
``` 
* Không khai báo biến `let` rồi gán JSX theo điều kiện. Khi giá trị JSX cần giữ reference ổn định, hãy tạo nó bằng `useMemo` và truyền trực tiếp vào props.
```tsx 
// Không nên 
function LoginPage() { 
 let content: React.ReactNode 
 if (isEmailLogin) { 
 content = <EmailLogin /> 
 } 
 return <Page content={content} /> 
} 
``` 
```tsx 
// Nên 
function LoginPage() { 
 const content = useMemo(() => { 
 if (isEmailLogin) { 
 return <EmailLogin /> 
 } 
 return <QrLogin /> 
 }, [isEmailLogin]) 
 return <Page content={content} /> 
} 
``` 
* Biến chứa JSX phải sử dụng camelCase như `content`, không đặt tên PascalCase như `ComponentA`.
* Kết quả của `useMemo` trong trường hợp này là một `ReactNode`, vì vậy hãy truyền `content={content}`, không sử dụng `<Content />`.
* Không lạm dụng `useCallback` cho các hàm đơn giản nếu không cần giữ reference ổn định.
```tsx 
// Không nên 
const closeQrModal = useCallback(() => { 
 setIsQrModalMounted(false) 
}, []) 
``` 
```tsx 
// Nên 
const closeQrModal = () => { 
 setIsQrModalMounted(false) 
} 
``` 
* Chỉ sử dụng `useCallback` khi function:
* Được truyền xuống component đã tối ưu bằng `React.memo`.
* Được dùng làm dependency của hook khác.
* Cần giữ reference ổn định để đăng ký và hủy event listener.
* Không truyền component reference vào prop được thiết kế để nhận `ReactNode`. Hãy khởi tạo component dưới dạng JSX element và truyền trực tiếp vào prop.
* Ưu tiên sử dụng explicit `return` trong component thay vì implicit return.
```tsx 
// Không nên 
const Login = () => <ComponentLogin /> 
return <Component login={Login} /> 
``` 
```tsx 
// Nên 
const Login = () => { 
 return <ComponentLogin /> 
} 
return <Component login={<Login />} /> 
``` 
* Nếu component trung gian không có logic hoặc giao diện riêng, hãy truyền component gốc trực tiếp.
```tsx 
// Ưu tiên hơn 
return <Component login={<ComponentLogin />} /> 
``` 
* Không gọi trực tiếp function bên trong câu lệnh `if`. Hãy tách kết quả thành một biến boolean có tên rõ nghĩa để điều kiện dễ đọc và dễ tái sử dụng.
```tsx 
// Không nên 
if (isFailedStatus(vneidSSO)) { 
 handleFailedStatus() 
} 
``` 
```tsx 
// Nên 
const isFailed = isFailedStatus(vneidSSO) 
if (isFailed) { 
 handleFailedStatus() 
} 
```