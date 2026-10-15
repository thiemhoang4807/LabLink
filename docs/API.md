# Hợp đồng API

Base URL local: `http://localhost:8000`. JSON UTF-8. Tài liệu request/response tương tác tại `/docs`, OpenAPI tại `/openapi.json` là nguồn chính xác theo phiên bản đang chạy. Ví dụ dưới đây dùng tài khoản giả lập.

## Session và mutation

Đăng nhập tạo cookie `lablink_session` HttpOnly, SameSite=Lax. Frontend gọi với `credentials: 'include'`; không đọc token từ JavaScript. Mọi request khác GET/HEAD/OPTIONS phải gửi header **`X-Requested-With: LabLink`**, kể cả login/register, chat và import. Có `Origin` thì origin phải nằm trong `FRONTEND_ORIGINS`.

| Mã | Ý nghĩa thường gặp |
|---|---|
| 400 | Request không hợp lệ |
| 401 | Chưa đăng nhập hoặc session hết hạn |
| 403 | Sai vai trò/quyền, thiếu header bảo vệ hoặc origin không được cho phép |
| 404 | Không tồn tại hoặc không thuộc phạm vi được xem |
| 409 | Trùng đơn active, lab đầy, trùng dữ liệu hoặc bước chuyển không hợp lệ |
| 413 | Request/file quá lớn |
| 422 | Không đạt schema/điều kiện GPA, file/URL không hỗ trợ |
| 429 | Giới hạn thử đăng nhập/đăng ký |

Lỗi có trường `detail`; lỗi Pydantic có thể là danh sách vị trí/trường, không luôn là chuỗi. Auth có giới hạn bộ nhớ theo IP trong tiến trình để bảo vệ demo; pilot nhiều worker cần bộ đếm dùng chung.

## Danh mục endpoint

| Method | Path | Quyền và tác dụng |
|---|---|---|
| GET | `/api/health` | Health và kiểm tra kết nối database |
| POST | `/api/auth/register` | `{name,email,password,role}`; role student/lecturer, mật khẩu tối thiểu 10 ký tự |
| POST | `/api/auth/login` | `{email,password}`; trả `{user}` và cookie |
| GET | `/api/auth/me` | User đang đăng nhập |
| POST | `/api/auth/logout` | Xóa session và cookie |
| GET | `/api/profile` | Hồ sơ hiện tại, gồm metadata file |
| PATCH | `/api/profile` | Cập nhật các trường hồ sơ và `consent_ai` |
| GET | `/api/labs?q=&topic=` | Danh sách lab công khai, tối đa 500; query/topic tùy chọn |
| GET | `/api/labs/{id}` | Chi tiết lab và công trình |
| POST | `/api/labs` | Giảng viên tạo lab của mình |
| PATCH | `/api/labs/{id}` | Chủ lab sửa thông tin/tiêu chí/mở nhận |
| POST | `/api/labs/{id}/publications` | Chủ lab thêm công trình thủ công |
| POST | `/api/documents` | Sinh viên upload multipart `kind` và `file` |
| GET | `/api/documents/{id}/download` | Chính chủ hoặc giảng viên có đơn gắn file được quyền xem; trả file attachment |
| DELETE | `/api/documents/{id}` | Chủ file xóa file và các liên kết đính kèm đơn |
| GET | `/api/applications` | Sinh viên xem đơn mình; giảng viên xem đơn của lab mình |
| POST | `/api/applications` | Sinh viên gửi `{lab_id,cover_letter}` |
| PATCH | `/api/applications/{id}/status` | Giảng viên chuyển bước; sinh viên rút đơn của mình |
| GET | `/api/dashboard` | Thống kê đúng phạm vi tài khoản |
| GET | `/api/ai/matches` | Sinh viên nhận gợi ý lab mở và lý do |
| POST | `/api/ai/chat` | Người đăng nhập hỏi tìm lab/ứng viên theo quyền |
| POST | `/api/ai/classify` | Phân loại chủ đề/keyword theo từ điển local |
| POST | `/api/ai/import` | Chủ lab xem trước trang công khai được phép |
| POST | `/api/ai/import/confirm` | Chủ lab xác nhận công trình từ preview để lưu |

API list hiện trả array trực tiếp, chưa có pagination kiểu cursor; không tích hợp dữ liệu quy mô lớn bằng cách bỏ giới hạn mà không thiết kế phân trang.

## Ví dụ PowerShell

```powershell
$base = 'http://localhost:8000'
$headers = @{ 'X-Requested-With' = 'LabLink' }
$login = @{ email = 'student@lablink.demo'; password = 'Demo@2026!' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" -Headers $headers `
  -ContentType 'application/json' -Body $login -SessionVariable lablinkSession

Invoke-RestMethod -Uri "$base/api/profile" -WebSession $lablinkSession

$question = @{ message = 'Tôi biết Python, muốn tìm lab NLP' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$base/api/ai/chat" -Headers $headers `
  -ContentType 'application/json' -Body $question -WebSession $lablinkSession
```

Ví dụ JavaScript cùng origin:

```ts
const response = await fetch('/api/applications', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'LabLink' },
  body: JSON.stringify({
    lab_id: 1,
    cover_letter: 'Em quan tâm xử lý ngôn ngữ và muốn tham gia dự án nghiên cứu của lab.',
  }),
});
const result = await response.json();
if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Hồ sơ không hợp lệ');
```

Lab ID 1 chỉ là ví dụ, phải lấy ID từ `/api/labs`. Request có thể bị từ chối nếu GPA không đạt, lab đóng/đầy hoặc đã có đơn active.

## Hồ sơ và file

```json
{
  "gpa": 3.55,
  "skills": ["Python", "ReactJS", "SQL"],
  "interests": ["NLP", "AI"],
  "major": "Kỹ thuật phần mềm",
  "year": 3,
  "consent_ai": false
}
```

PATCH chỉ đổi trường có mặt trong request. GPA/năm học cho phép null để xóa giá trị; không gửi null thay cho danh sách trống. GPA thang 4; tags tối đa 30 mục, mỗi mục 1–80 ký tự.

Upload dùng `FormData`, trường `kind` là `cv` hoặc `transcript`. Không tự đặt `Content-Type` khi gửi FormData; browser cần tự tạo boundary. Chỉ PDF hợp lệ không mã hóa, tối đa 5 MiB/tệp, 40 trang, tối đa 10 tài liệu/hồ sơ. Parser có timeout 8 giây và giới hạn 50.000 ký tự trích xuất. Tệp scan không có lớp văn bản được chấp nhận nhưng không tự có OCR. Văn bản trích xuất không được trả qua API hồ sơ hoặc dùng cho external AI.

Khi nộp đơn, toàn bộ tài liệu hiện có của sinh viên được gắn vào đơn. Upload sau không tự gắn vào đơn trước. **Xóa tài liệu cũng gỡ tệp khỏi các đơn đã nộp**, do đó linkage không phải kho lưu trữ bất biến.

## Pipeline

```json
{ "status": "reviewing", "note": "Đã xem CV, phù hợp chủ đề nghiên cứu." }
```

Giảng viên chuyển `submitted → reviewing → interview → accepted`; có thể `rejected` từ ba bước đầu. Sinh viên được chuyển ba bước đầu sang `withdrawn`. Các trạng thái kết thúc không mở lại qua endpoint hiện tại. Khi accepted, API kiểm tra capacity trong transaction; sửa lab cũng không được giảm capacity dưới số accepted hiện có.

Sau khi rút đơn, API list của giảng viên vẫn có trạng thái/lịch sử nhưng ẩn thông tin cá nhân, thư ngỏ và file của đơn đã rút; sinh viên vẫn thấy thông tin đơn của mình. Truy xuất AI/tải file không được cấp quyền chỉ từ đơn withdrawn.

## AI và nguồn

```json
{ "message": "Tìm sinh viên có ReactJS, GPA > 3.2 và quan tâm AI" }
```

Chat trả `answer`, `mode`, `sources`, `filters`, `vector_store`, `warning`. Nguồn có `id` chuỗi như `student:3`/`lab:1`, `entity_id` số nguyên, `type`, `title`, `url` nếu có, `excerpt`, `score`, và tùy trường hợp `document_id`. URL nguồn có thể là URL HTTP(S) công khai hoặc đường dẫn tải tài liệu `/api/documents/{id}/download` cần session. `history` được chấp nhận để tương thích UI nhưng không lưu/index/gửi nhà cung cấp; mỗi câu được giải quyết độc lập. Không hứa hội thoại nhiều lượt ghi nhớ các điều kiện từ lượt trước.

Ở local mode, giảng viên có thể nhận đoạn bằng chứng CV đã gắn vào đơn không rút của lab mình. Không truy xuất bảng điểm hoặc CV upload sau đơn chưa có liên kết. Điều kiện cứng vẫn theo trường hồ sơ khai báo, văn bản CV chỉ hỗ trợ retrieval mềm. Chế độ ngoài chỉ gửi GPA/skills/topics ứng viên, bộ lọc/ngữ cảnh có cấu trúc, và nội dung nghiên cứu công khai; không gửi tên/email/bio, câu hỏi nguyên văn hay bất kỳ văn bản CV/bảng điểm nào.

| Mode | Ý nghĩa |
|---|---|
| `local` | Baseline từ khóa local, gồm trường hợp chưa đủ consent để bật provider |
| `local_fallback` | Provider embedding lỗi; đã dựng lại index local |
| `openai` | Embedding và bước rerank qua provider đã chạy |
| `openai_embeddings` | Embedding provider đã chạy nhưng rerank không thành công; giữ retrieval và trả warning |

`GET /api/ai/matches` chỉ dành cho sinh viên; trả điểm, lý do và phần còn thiếu theo profile hiện tại. `POST /api/ai/classify` nhận `{text}` và dùng taxonomy local, kể cả khi cấu hình AI ngoài.

Import hai bước:

```json
{ "lab_id": 1, "url": "https://www.uit.edu.vn/duong-dan-cong-khai" }
```

Sau khi xem preview, gọi confirm với:

```json
{
  "lab_id": 1,
  "source_url": "https://www.uit.edu.vn/duong-dan-cong-khai",
  "title": "Tiêu đề nghiên cứu đã kiểm tra",
  "abstract": "Tóm tắt có quyền sử dụng và đã được giảng viên xác nhận.",
  "year": 2026
}
```

Đường dẫn trên là ví dụ định dạng, không khẳng định trang đó tồn tại. Không dùng import để crawl Google Scholar hoặc nguồn ngoài allowlist. Preview chỉ đưa phần tử vào `publications` khi có `citation_title`; trang giảng viên thông thường có thể trả summary/topics nhưng danh sách bài báo rỗng. UI khi đó hướng dẫn nhập thủ công. Xác nhận không tự tải lại trang, do đó giảng viên chịu trách nhiệm kiểm tra nội dung trước khi lưu.
