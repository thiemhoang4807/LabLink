# Chạy, bảo trì và chuẩn bị pilot

## Hai cách chạy

**Local:** SQLite, Python `.venv`, Vite. Không cần PostgreSQL, Docker hay API key; phù hợp chuẩn bị và backup demo. `npm run dev` tìm Python trong `.venv` tại gốc repository, không dùng Python ngẫu nhiên trên PATH.

**Compose:** PostgreSQL/pgvector, API không đặc quyền root trong container và Nginx. `docker compose up --build` chạy hệ thống, healthcheck database trước API và API trước web. PostgreSQL không publish port. Web/API chỉ bind `127.0.0.1`, dùng `localhost:8080` trên máy chạy Docker.

Trong Compose, Nginx có IP `172.28.240.2`; Uvicorn chỉ tin forwarded headers từ IP đó. Mạng nội bộ dùng subnet `172.28.240.0/24`; nếu subnet này xung đột với mạng có sẵn, hãy đổi subnet và đồng bộ địa chỉ tĩnh của web/API/database cùng `--forwarded-allow-ips` trong `compose.yaml`. Nginx ghi đè `X-Forwarded-For` bằng địa chỉ kết nối mà chính Nginx nhận được.

Tất cả cấu hình trong Compose hiện là **local demo**. `APP_ENV=development`, `SEED_DEMO=true`, cookie không Secure và mật khẩu development là lựa chọn phục vụ demo HTTP, không phải mặc định public.

## Trước khi mở pilot với dữ liệu thật

Đây là phần việc triển khai cần làm, không phải các tích hợp đã có:

1. Có sự đồng ý của đơn vị phụ trách dữ liệu, chính sách mục đích sử dụng/retention, và quy trình hỗ trợ xuất/xóa. Chỉ thu dữ liệu cần cho tuyển lab.
2. Xác minh tư cách giảng viên, ngăn tự đăng ký lecturer không kiểm soát; thêm SSO/email verification và quy trình quản trị nếu trường chấp thuận.
3. Cấu hình domain, TLS, `COOKIE_SECURE=true`, đúng `FRONTEND_ORIGINS`, `APP_ENV=production`, `SEED_DEMO=false`. Không đưa tài khoản demo vào database pilot.
4. Dùng secret store/biến môi trường an toàn, khóa DB quyền tối thiểu; provision `CREATE EXTENSION vector` bằng tài khoản vận hành trước khi giảm quyền tài khoản ứng dụng.
5. Dùng migration Alembic đã review thay vì tự đổi bảng đang chạy. Backup và diễn tập restore trước khi nâng cấp.
6. Thêm object storage riêng, quét mã độc/giới hạn tài nguyên PDF parser, retention và kiểm tra quyền mỗi lần tải; không mở volume upload thành static URL.
7. Đặt reverse proxy có giới hạn request, timeout, rate limit; auth limiter trong tiến trình không thay thế cơ chế nhiều instance.
8. Theo dõi lỗi và độ trễ bằng metadata, không log prompt/CV/bảng điểm/email/token. Thiết kế công cụ audit và thu hồi truy cập cho người vận hành.
9. Nếu bật provider AI, xác nhận chính sách xử lý dữ liệu của provider, consent đúng đối tượng và chi phí. Gắn cảnh báo mode rõ trong UI và thử fallback khi hết quota/mất mạng.

Không có job deploy public hoặc email gửi bên ngoài được cấu hình trong repository.

## Backup dữ liệu local

Dừng API bằng Ctrl+C để bản copy SQLite nhất quán. Backup **cả** `apps/api/data/lablink.db` và thư mục upload, giữ quyền truy cập chặt; không commit bản backup. Nếu `DATABASE_URL`/`STORAGE_DIR` đã đổi thì dùng đúng đường dẫn thực tế. Không reset DB để sửa một lỗi migration của dữ liệu thật.

Với Compose, named volume `postgres_data` chứa database và `api_data` chứa file. `docker compose down` giữ dữ liệu. Lệnh có `down -v` sẽ xóa volume; chỉ dùng khi đã chủ động quyết định bỏ toàn bộ dữ liệu và có backup cần thiết.

Backup PostgreSQL nên dùng `pg_dump` định kỳ bởi công cụ vận hành, lưu ngoài máy/container, mã hóa và kiểm tra restore sang database khác. Backup file phải đồng bộ được với metadata document trong DB. Mật khẩu không đưa thẳng vào command có thể lưu trong shell history.

## Chẩn đoán nhanh

| Triệu chứng | Kiểm tra và xử lý |
|---|---|
| `npm run dev` báo chưa có `.venv` | Tạo đúng `.venv` tại gốc theo README; cài requirements bằng Python trong môi trường đó |
| Vite không khởi động | Node >=22.12; `npm install`; kiểm tra cổng 5173 |
| API không khởi động | Cài requirements, kiểm tra cổng 8000 và URL DB; xem traceback terminal |
| Đăng nhập 403 | Header `X-Requested-With: LabLink`; origin có trong allowlist; gọi cùng host đã mở frontend |
| Đăng nhập được nhưng request sau 401 | Client cần `credentials: include`; không trộn localhost/127.0.0.1; cookie Secure chỉ dùng với HTTPS |
| Upload lỗi | File PDF thật, <=5 MiB/40 trang, không mã hóa; không vượt 10 tệp; multipart có boundary đúng |
| Không nộp được hồ sơ | Kiểm tra GPA, lab mở, capacity, đơn active hiện có và thư ngỏ >=20 ký tự |
| Crawler từ chối | Host HTTPS thuộc allowlist, DNS IP public, robots cho phép; dùng nhập thủ công nếu nguồn không cho đọc |
| AI trả local dù bật openai | Kiểm tra khóa, consent của người hỏi/ứng viên, cấu hình model/network; fallback local là hành vi có chủ đích |
| Schema cũ thiếu cột | `create_all()` không migration bảng cũ; tạo migration. Chỉ với dữ liệu demo có thể tạo database mới sau khi chủ động lưu lại dữ liệu cần giữ |
| Compose api unhealthy | `docker compose logs api db`; chờ DB sẵn sàng, kiểm tra mật khẩu và extension vector |

Xem trạng thái Compose:

```powershell
docker compose ps
docker compose logs --tail 100 api
```

Log có thể chứa URL và thông tin lỗi nội bộ; không công bố nguyên log nếu chưa kiểm tra dữ liệu cá nhân hoặc secret.

## Ngân sách và hiệu năng

Baseline local chạy không phát sinh phí provider. Chi phí AI ngoài phụ thuộc số token/embedding và số truy vấn; repository không gắn một mức giá giả định. Trước pilot đặt giới hạn ngân sách phía nhà cung cấp, đo p50/p95, tỷ lệ fallback và số chunk trên mỗi câu hỏi.

SQLite phù hợp demo nhỏ và ít ghi đồng thời; PostgreSQL là lựa chọn cho nhiều người dùng. Crawler/index đồng bộ có giới hạn; nếu crawl nhiều nguồn cần worker và queue. Không có benchmark công bố nên không suy ra khả năng phục vụ hàng nghìn tài khoản từ việc build chạy thành công.
