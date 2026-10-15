# Kịch bản demo SEApp 2026

Mục tiêu 5–7 phút: chứng minh một hồ sơ đi hết quy trình và giải thích tại sao gợi ý đáng kiểm tra. Cài sẵn dependencies, chạy bằng local mode; không phụ thuộc dịch vụ AI ngoài hoặc crawler trực tiếp để hoàn thành bài trình bày.

## Chuẩn bị trước buổi trình bày

- Chạy kiểm thử API, typecheck và build. Mở `/api/health`, kiểm tra `status: ok`.
- Dùng dữ liệu giả lập. Tạo sẵn PDF CV/bảng điểm mẫu với chữ “DEMO — không phải hồ sơ thật”; không dùng CV thành viên.
- Kiểm tra tài khoản sinh viên/giảng viên và lab đang nhận; bảo đảm chưa có đơn active trùng lab muốn demo. Có thể tạo sinh viên demo mới thay vì xóa DB đang có dữ liệu cần giữ.
- Xác nhận thời gian/thiết bị theo hướng dẫn ban tổ chức; tải sẵn video ngắn và ảnh chụp các bước làm backup.
- Thử màn hình điện thoại, bàn phím, trạng thái rỗng và thông báo lỗi; kiểm tra chữ tiếng Việt và zoom projector.

## Trình bày

| Thời lượng | Người nói | Thao tác và thông điệp |
|---|---|---|
| 0:00–0:40 | A | Nêu vấn đề: sinh viên khó tìm đúng hướng, giảng viên mất công lọc và theo dõi |
| 0:40–2:10 | A | Đăng nhập sinh viên, xem hồ sơ/GPA/skills, tìm lab; giải thích điểm và phần thiếu, mở chi tiết và nộp đơn |
| 2:10–3:40 | B | Đổi sang giảng viên, xem ứng viên và tài liệu đúng đơn, chuyển Submitted → Reviewing → Interview |
| 3:40–4:50 | C | Hỏi ReactJS + GPA >3.2 + AI; chỉ vào điều kiện cứng và nguồn; chứng minh giảng viên không thấy ứng viên của lab khác |
| 4:50–5:40 | C | Mở công trình có nguồn, phân loại chủ đề; giải thích preview/confirm và giới hạn nguồn crawl |
| 5:40–6:30 | B/A | Chấp nhận ứng viên; quay về sinh viên xem trạng thái, trình bày kết quả đánh giá đã có và kế hoạch pilot |

Nếu chưa có thực nghiệm, nói rõ “đây là bản triển khai và kế hoạch đánh giá”, không dùng số liệu giả để làm slide thuyết phục.

## Các tình huống nên chủ động kiểm tra

1. GPA không đạt: API từ chối với lý do rõ, không chỉ ẩn nút UI.
2. Nộp trùng: nhận conflict thay vì hai đơn active.
3. Sai quyền: sinh viên không chuyển hồ sơ sang accepted; giảng viên khác không xem file.
4. Chuyển bước sai: submitted không nhảy thẳng accepted.
5. Không có dữ liệu phù hợp: chatbot nói không có kết quả, không tạo người/bài báo mới.
6. Không có API key/mất mạng: local mode vẫn chạy. Nêu rõ đây là baseline từ khóa, không giả làm semantic embedding.
7. URL không được phép: import từ chối, giảng viên vẫn có thể nhập thông tin có quyền dùng thủ công.
8. Upload giả PDF/quá lớn: trả lỗi có thể xử lý; file không bị public.

## Điểm cần giải thích với hội đồng

- **Khoa học/ứng dụng:** hard filters tách khỏi tương đồng, baseline so sánh với embedding, tập câu hỏi có đáp án, nguồn và tiêu chí đánh giá minh bạch.
- **Hoàn thiện:** một chuỗi hai vai trò, lưu lịch sử trạng thái, kiểm tra trùng và capacity, chạy local khi thiếu dịch vụ ngoài.
- **Trải nghiệm:** giải thích “phù hợp ở đâu/còn thiếu gì”, hồ sơ dễ điền, trạng thái nhìn được, responsive và lỗi rõ.
- **Dữ liệu:** nguồn công trình có provenance; CV/bảng điểm riêng tư; AI không quyết định tuyển; consent trước external provider.

## Hồ sơ dự thi cần nhóm chuẩn bị

Mô tả bài toán và đối tượng, link/code nếu yêu cầu, hướng dẫn chạy, ảnh/video demo, poster theo mẫu ban tổ chức, phân công thành viên và báo cáo thử nghiệm. Đối chiếu PDF/thông báo chính thức để xác nhận đúng tài liệu cần nộp; danh sách này là gợi ý chuẩn bị của nhóm.
