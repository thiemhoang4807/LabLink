# LabLink — SEApp 2026

Nền tảng kết nối sinh viên với giảng viên/phòng lab: hồ sơ nghiên cứu, CV và bảng điểm, tìm kiếm có giải thích, chatbot truy xuất dữ liệu và pipeline tuyển chọn. Monorepo dành cho nhóm 3 người, có thể chạy local với dữ liệu giả lập.

## Công nghệ và phạm vi

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Giao diện | React 19, TypeScript, Vite 8 | Một giao diện web responsive dùng trên máy tính và điện thoại |
| API | Python 3.12, FastAPI, Pydantic, SQLAlchemy | Dễ chia sẻ code với phần xử lý văn bản/AI; API có tài liệu tương tác |
| Dữ liệu local | SQLite + file trên đĩa | Khởi động nhanh, không bắt buộc Docker |
| Dữ liệu Docker | PostgreSQL 17 + pgvector | Dữ liệu quan hệ và vector trong cùng database |
| AI mặc định | Vector từ khóa băm, phân loại theo từ điển và matching có giải thích | Chạy không cần khóa API; đây là baseline từ khóa, không phải mô hình hiểu ngữ nghĩa |
| AI tùy chọn | Embedding và reranking qua API tương thích OpenAI | Cần khóa và kiểm tra sự đồng ý; xem giới hạn dữ liệu trong tài liệu kiến trúc |
| Triển khai demo | Docker Compose, Nginx | Web và API cùng origin, dữ liệu được lưu qua volume |

Không cần ứng dụng mobile riêng ở giai đoạn thi; đầu tư vào web responsive và một luồng tuyển hoàn chỉnh. Kiến trúc, ranh giới quyền truy cập và đường nâng cấp nằm ở [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Chạy nhanh trên Windows

Cần **Python 3.12** và **Node.js 22.12 trở lên**. Mở PowerShell tại thư mục repository:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r apps/api/requirements.txt
npm install
npm run dev
```

Lệnh `npm run dev` chạy API và web cùng nhau. Dừng bằng `Ctrl+C`.

- Giao diện: [http://localhost:5173](http://localhost:5173).
- API/Swagger: [http://localhost:8000/docs](http://localhost:8000/docs).
- Health: [http://localhost:8000/api/health](http://localhost:8000/api/health).

Database SQLite và file upload được tạo trong `apps/api/data/`, đã được loại khỏi Git. Lần đầu chạy môi trường development sẽ tự tạo dữ liệu demo.

Linux/macOS:

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r apps/api/requirements.txt
npm install
npm run dev
```

Nếu muốn chạy riêng hai terminal:

```powershell
# Terminal 1, từ thư mục repository
Set-Location apps/api
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```powershell
# Terminal 2, từ thư mục repository
npm run dev:web
```

## Tài khoản và hành trình demo

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Sinh viên | `student@lablink.demo` | `Demo@2026!` |
| Giảng viên | `lecturer@lablink.demo` | `Demo@2026!` |

Tất cả tên người, lab và công trình trong seed đều phục vụ minh họa; không phải hồ sơ thật hoặc xác nhận của nhà trường. Không dùng tài khoản demo cho hệ thống public.

1. Đăng nhập sinh viên, xem/sửa hồ sơ, bổ sung kỹ năng và hướng nghiên cứu.
2. Tìm lab, xem tiêu chí, đọc lý do phù hợp; tải CV/bảng điểm PDF của dữ liệu giả lập.
3. Nộp hồ sơ có thư ngỏ và theo dõi trạng thái.
4. Đăng xuất, đăng nhập giảng viên; xem hồ sơ lab, tìm ứng viên, chuyển đơn qua các bước tuyển.
5. Hỏi chatbot: “Tìm sinh viên có ReactJS, GPA > 3.2 và quan tâm AI”; kiểm tra điều kiện lọc và nguồn trả về. Truy xuất CV local chỉ dùng tệp đã đính kèm đơn thuộc lab được quyền xem, không dùng bảng điểm hoặc CV tải sau khi nộp.
6. Vào “Phòng lab của tôi” → “Thêm nghiên cứu”: nhập công trình thủ công hoặc xem trước website trường được phép. Chỉ có nút xác nhận lưu bài báo khi trang có citation metadata; trang giảng viên thông thường có thể chỉ cho preview và cần nhập thủ công.

Kịch bản trình bày 5–7 phút, trường hợp lỗi và checklist trước buổi thi: [docs/DEMO.md](./docs/DEMO.md).

## Chạy bằng Docker

Cần Docker Engine/Desktop với Compose v2:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Mở [http://localhost:8080](http://localhost:8080). Database PostgreSQL chỉ mở trong mạng Compose. Cổng web/API chỉ bind loopback. Dữ liệu nằm trong các named volume; `docker compose down` dừng container và giữ dữ liệu.

Đây là cấu hình demo local có tài khoản seed, cookie HTTP và mật khẩu development. Các bước trước khi mở public, backup và xử lý sự cố nằm ở [docs/OPERATIONS.md](./docs/OPERATIONS.md).

## Cấu hình

API đọc biến môi trường và `apps/api/.env`. Thông thường không cần sửa cấu hình để chạy local. Sao chép `apps/api/.env.example` sang `apps/api/.env` khi cần thay đổi. Tệp `.env` ở gốc phục vụ Compose; hai tệp có mục đích khác nhau.

| Biến | Mặc định/ý nghĩa |
|---|---|
| `APP_ENV` | `development`; production phải cấu hình bảo mật phù hợp |
| `DATABASE_URL` | SQLite local; PostgreSQL dùng `postgresql+psycopg://...` |
| `STORAGE_DIR` | Thư mục lưu file upload, mặc định `apps/api/data/uploads` |
| `COOKIE_SECURE` | `false` cho HTTP local; `true` khi HTTPS public |
| `SESSION_HOURS` | `24`; session được lưu phía máy chủ |
| `SEED_DEMO` | Bật mặc định chỉ khi development; tắt trên môi trường thật |
| `FRONTEND_ORIGINS` | Các origin frontend phân cách bởi dấu phẩy |
| `AI_MODE` | `local` mặc định; `openai` bật tích hợp tùy chọn |
| `OPENAI_API_KEY` | Khóa riêng, không đưa vào frontend hoặc Git |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` |
| `EMBEDDING_MODEL` | `text-embedding-3-small`, vector 256 chiều |
| `CHAT_MODEL` | `gpt-4.1-mini`, dùng trong chế độ tùy chọn |
| `CRAWL_ALLOWED_HOSTS` | `uit.edu.vn` và subdomain; mở rộng có chủ đích |

Chế độ local không gọi dịch vụ AI ngoài. Bật `AI_MODE=openai` chưa đủ để gửi dữ liệu: API kiểm tra `consent_ai` của người yêu cầu và các hồ sơ sinh viên liên quan; nếu không đủ điều kiện sẽ dùng baseline local. Dữ liệu ứng viên ra ngoài chỉ gồm GPA, kỹ năng, chủ đề; ngữ cảnh câu hỏi chỉ gồm bộ lọc đã trích xuất và kỹ năng/định hướng của sinh viên khi cần. Không gửi tên, email, bio, câu hỏi nguyên văn, CV/bảng điểm hoặc văn bản trích từ chúng. Nội dung lab/công trình công khai có thể được gửi. Xem chi tiết ở [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Kiểm tra trước khi tích hợp

```powershell
npm run typecheck
npm run build
Push-Location apps/api
..\..\.venv\Scripts\python.exe -m pytest tests -q
Pop-Location
```

Đã chạy **45 kiểm thử backend**, typecheck và build frontend thành công. E2E độc lập bằng Edge headless trên Windows kiểm tra luồng ứng tuyển, bảo toàn nháp khi upload/xóa CV, điểm matching 1%, pipeline, hết hạn session và đăng xuất cho cả hai vai; runner thoát exit 0, không có lỗi JavaScript hoặc request ra ngoài. Phạm vi, giới hạn và cách tái lập: [docs/VALIDATION.md](./docs/VALIDATION.md). CI được cấu hình chạy lại build/typecheck và pytest, không cần secret.

Chạy E2E bằng Playwright sau khi đã cài dependencies và `.venv`:

```powershell
npm run test:e2e
```

Windows mặc định dùng Microsoft Edge đã cài. Linux/macOS dùng Chromium của Playwright; trước lần đầu chạy:

```bash
npx playwright install chromium
npm run test:e2e
```

Script tạo database/upload giả lập riêng, chạy cổng **8001/5174**, không sửa dịch vụ development 8000/5173. Hai cổng test phải đang trống. Báo cáo, ảnh và log giữ trong `tmp/e2e/<run-id>/`, đã bỏ khỏi Git và Docker context; không dùng chúng như fixture dữ liệu thật.

## Cấu trúc repository

```text
SEApp/
├─ apps/
│  ├─ web/                 # React: pages, components, API client, styles
│  └─ api/
│     ├─ app/
│     │  ├─ main.py        # FastAPI app, middleware, startup
│     │  ├─ config.py      # Cấu hình môi trường
│     │  ├─ database.py    # Engine và session SQLAlchemy
│     │  ├─ models.py      # Database models/constraints
│     │  ├─ routers/       # Endpoint theo nghiệp vụ
│     │  └─ services/      # Matching, retrieval, nhập nguồn
│     ├─ tests/            # Hành vi API và ranh giới bảo mật
│     └─ requirements.txt
├─ docs/                   # Kiến trúc, database, API, vận hành, kế hoạch
├─ scripts/dev.mjs         # Chạy hai dịch vụ trong development
├─ .github/workflows/ci.yml
├─ compose.yaml
├─ AGENTS.md               # Hướng dẫn coding agent
└─ README.md
```

- [Thiết kế database, ERD và ràng buộc](./docs/DATABASE.md)
- [API và ví dụ tích hợp](./docs/API.md)
- [Kế hoạch nhóm 3 người, tiêu chí SEApp và lộ trình](./docs/PRODUCT.md)
- [Vận hành và giới hạn hiện tại](./docs/OPERATIONS.md)

Không đính kèm lại PDF cuộc thi vào repository. Tài liệu gốc là nguồn tham khảo; lịch và quy định cần đối chiếu thông báo mới của ban tổ chức trước khi đăng ký.
