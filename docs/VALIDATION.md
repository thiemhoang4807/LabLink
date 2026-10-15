# Phạm vi kiểm chứng bản đầu

Ghi nhận khi dựng repository ngày **15/10/2026**. Đây là kết quả trên môi trường phát triển, không phải chứng nhận vận hành production hoặc benchmark hiệu quả tuyển chọn.

| Kiểm tra | Kết quả/phạm vi |
|---|---|
| Backend | 40 kiểm thử pytest đạt; chạy bằng SQLite và fixture cục bộ |
| Frontend | TypeScript typecheck và Vite production build đạt |
| Trình duyệt smoke | 11 bước đạt, không có uncaught JavaScript error; viewport 390 px không tràn ngang |
| E2E chức năng | 11 bước đạt bằng Edge headless trên Windows, runner thoát exit 0 và cleanup không lỗi; dữ liệu/DB riêng: hồ sơ → PDF → nộp đơn → RAG → giảng viên xem CV → reviewing/interview/accepted → sinh viên thấy lịch sử → xử lý session hết hạn |
| Tài liệu/script | Link Markdown local hợp lệ; `node --check scripts/dev.mjs` và `git diff --check` đạt |
| Docker/PostgreSQL | Có cấu hình Compose/pgvector và đối chiếu đường dẫn/env; chưa chạy tích hợp Docker/PostgreSQL trên máy này |
| Nhà cung cấp AI ngoài | Có code và kiểm thử mock payload/fallback; chưa gọi OpenAI thật, chưa đánh giá chất lượng embedding |
| Crawl live | Có test kiểm soát URL/import; chưa xác nhận một website trường cụ thể bằng request live |
| Đánh giá người dùng | Chưa thực nghiệm Recall@5, MRR, Precision@5 hoặc usability với người dùng thật |

Các nhóm hồi quy chính bao gồm xác thực/phân quyền, trùng đơn, chuyển trạng thái/capacity, giới hạn file/request, hard filters và alias kỹ năng, truy xuất đúng phạm vi lab, consent/provider fallback, nguồn có thật, và CV theo snapshot liên kết đơn. Kiểm thử AI kiểm tra CV upload sau không lọt vào đơn cũ, không index bảng điểm, không đưa CV/tên/email/bio/query nguyên văn vào payload ngoài. Hồi quy bổ sung kiểm tra ẩn dữ liệu đơn đã rút với giảng viên và không giảm capacity dưới số đã nhận.

Các kiểm thử dùng dữ liệu giả lập, không gửi hồ sơ thật lên dịch vụ ngoài. E2E chặn request ra ngoài và xác nhận không phát sinh external call hoặc lỗi JavaScript chưa xử lý. Lượt cuối xác nhận `passed: true`, 11 checks, `pageErrors: []`, `externalRequests: []`, `cleanupErrors: []`, exit code 0. Báo cáo trên máy phát triển: `tmp/e2e/2861e87f-5146-4e39-8440-10aa02dea159/report.json`; đây là artifact tạm đã ignore, không được đóng gói vào Git. Cách kiểm chứng lâu dài là chạy lại script để tạo report theo run ID mới.

## Tái lập E2E

Chạy `npm run test:e2e` tại gốc sau khi cài requirements Python vào `.venv` và chạy `npm install`/`npm ci`. Trên Windows mặc định dùng Edge; trên Linux/macOS cần `npx playwright install chromium`. Nếu muốn dùng Chromium trên Windows, cài bằng lệnh trên và đặt `BROWSER_CHANNEL=chromium` trước khi chạy. Có thể đặt `PYTHON_PATH` để chọn Python khác có đủ requirements.

Script chỉ bind loopback, cần cổng 8001/5174 trống, tạo database và thư mục upload riêng theo run ID; không dùng database hay tài khoản development. Có thể chạy khi phiên development trên 8000/5173 đang mở. Ảnh chụp, log, SQLite và `report.json` nằm trong `tmp/e2e/<run-id>/` và đã được ignore. Một số dữ liệu ban đầu được tạo qua API; các bước sửa hồ sơ, upload, nộp đơn và chuyển trạng thái được thao tác qua UI thật. Suite không thay thế kiểm thử crawl/AI ngoài hoặc kiểm tra thủ công trên thiết bị mục tiêu trước buổi trình bày.

Runner cần quyền dừng cây tiến trình con do chính nó tạo. Trên môi trường sandbox hạn chế quyền `taskkill` của Windows, cleanup có thể bị chặn dù các bước chức năng đã đạt; lượt xác minh cuối chạy với quyền cho phép cleanup đúng các PID thuộc suite. Lỗi cleanup được ghi vào report và khiến suite thất bại thay vì coi các assertions chức năng là thành công toàn bộ.

Lệnh tái lập nằm trong README. Mỗi khi chỉnh sửa thêm, chạy lại phần kiểm tra phù hợp và cập nhật ghi nhận này nếu kết quả/phạm vi thay đổi. CI đã được cấu hình trong repository; chưa tuyên bố một workflow GitHub đã chạy khi chưa có kết quả remote.
