# LabLink — phạm vi sản phẩm và kế hoạch SEApp 2026

## Bài toán

Sinh viên khó biết giảng viên đang làm chủ đề nào và lab còn nhận người hay không. Giảng viên phải đọc nhiều hồ sơ rời rạc, khó lọc điều kiện và theo dõi tiến trình. LabLink kết nối hai phía bằng hồ sơ có cấu trúc, bộ lọc rõ ràng, gợi ý có nguồn và một quy trình tuyển chọn dùng chung.

**Người dùng chính:** sinh viên tìm hướng nghiên cứu; giảng viên quản lý lab và tuyển trợ lý nghiên cứu. Ban quản trị cấp trường, SSO và liên thông hệ thống đào tạo thuộc giai đoạn sau.

## Phạm vi bản chạy đầu tiên

| Luồng | Kết quả cần đạt |
|---|---|
| Đăng ký/đăng nhập | Phân biệt vai trò sinh viên và giảng viên; bảo vệ API bằng xác thực |
| Sinh viên | Sửa GPA, kỹ năng, định hướng; tải CV/bảng điểm; tìm lab và nộp hồ sơ |
| Giảng viên | Sửa thông tin nghiên cứu; quản lý lab/cơ hội tuyển; xem và chuyển trạng thái hồ sơ |
| Nguồn nghiên cứu | Nhập công trình thủ công; nhập nội dung từ trang công khai được hỗ trợ; lưu nguồn |
| Tìm kiếm/gợi ý | Lọc điều kiện cứng; xếp hạng mức phù hợp và giải thích từ dữ liệu có sẵn |
| Chatbot | Hỏi bằng tiếng Việt, nhận đề xuất có nguồn theo quyền truy cập |
| Theo dõi tuyển chọn | Nộp hồ sơ → duyệt CV → phỏng vấn → chấp nhận; có từ chối/rút đơn khi phù hợp |

AI hỗ trợ đọc và tìm dữ liệu. Quyết định tuyển dụng luôn thuộc giảng viên. Bản chạy local dùng dữ liệu demo giả lập, không kết nối hệ thống nội bộ trường.

## Bám theo tài liệu cuộc thi

Nguồn: PDF “Kế hoạch tổ chức Phát triển ứng dụng SEAPP 2026” do người dùng cung cấp. Các mốc dưới đây được trích từ tài liệu; cần xác nhận lại thông báo của ban tổ chức trước khi nộp.

- Nhóm 3 người phù hợp giới hạn 1–6 người; ứng dụng web nằm trong hình thức dự thi cho phép.
- Nội dung khoa học/khả năng ứng dụng chiếm 60%, mức độ hoàn thiện 20%, trải nghiệm/giao diện 20% trong tiêu chí đánh giá sản phẩm.
- Kết quả tại triển lãm gồm 80% hội đồng và 20% bình chọn. Không nhầm tỷ trọng này với ba nhóm tiêu chí trên.

| Mốc công bố | Ngày theo múi giờ Việt Nam |
|---|---|
| Đăng ký sản phẩm | 28/09–10/12/2026 |
| Danh sách được chấp nhận | 14/12/2026 |
| Chuẩn bị/nộp poster | 14–16/12/2026 |
| Triển lãm | 17/12/2026 |
| Trao giải | 17–20/12/2026 |

## Kế hoạch đề xuất từ 15/10/2026

| Giai đoạn | Thời gian | Sản phẩm kiểm chứng |
|---|---|---|
| Xác thực nhu cầu | 15–21/10 | Phỏng vấn khoảng 5 sinh viên và 3 giảng viên; chốt thang GPA, quyền xem hồ sơ, định nghĩa lab/cơ hội |
| Luồng chính | 22/10–04/11 | Hồ sơ → tìm lab → nộp đơn → giảng viên nhận và chuyển trạng thái; demo hai vai |
| Dữ liệu và AI | 05–18/11 | Nguồn dữ liệu có phép, trích xuất chủ đề, bộ lọc cứng, tập đánh giá gợi ý/RAG |
| Hoàn thiện | 19/11–02/12 | Sửa UX trên điện thoại, kiểm thử quyền, lỗi file/crawl/AI, demo không có mạng |
| Đóng gói và đăng ký | 03–10/12 | Freeze tính năng, video demo, mô tả, README; hoàn tất đăng ký trước hạn |
| Triển lãm | 11–17/12 | Chỉ sửa lỗi; poster khi có hướng dẫn 14–16/12; diễn tập và bản backup local |

Lịch này là kế hoạch nhóm đề xuất, không phải thời hạn bổ sung của ban tổ chức.

## Chia việc cho nhóm 3 người

| Thành viên | Trách nhiệm chính | Người review |
|---|---|---|
| A | UX/UI, React, responsive, luồng nộp đơn và Kanban, video | B review API contract; C kiểm thử trải nghiệm |
| B | FastAPI, database, xác thực/phân quyền, file, hạ tầng chạy | C review quyền và dữ liệu; A kiểm tra tích hợp |
| C | Nguồn nghiên cứu, NLP/RAG/matching, tập đánh giá, tài liệu thực nghiệm | B review an toàn; A review khả năng hiểu giải thích |

Mỗi tuần nên có một bản tích hợp chạy được và một buổi demo 15 phút. Hai ngày cuối mỗi giai đoạn dành cho tích hợp, tránh gom toàn bộ phần AI vào tuần cuối.

## Đo hiệu quả thay vì chỉ demo chatbot

- **Độ đúng bộ lọc:** mọi kết quả thỏa điều kiện GPA/skill đã áp dụng; không có ứng viên ngoài phạm vi giảng viên được quyền xem.
- **Retrieval:** xây 30–50 câu hỏi có đáp án nguồn, tính Recall@5 và MRR theo tập đã gán nhãn thủ công; so sánh baseline từ khóa với embedding khi triển khai.
- **Matching:** dùng nhãn của 2 người độc lập cho các cặp sinh viên–lab; đo Precision@5, ghi rõ độ đồng thuận và cỡ mẫu.
- **RAG:** chấm câu trả lời có nguồn đúng, phát biểu được nguồn hỗ trợ, và khả năng từ chối khi không có dữ liệu. Báo cáo số câu, phiên bản dữ liệu, mô hình, chi phí và độ trễ.
- **Khả dụng:** đo tỷ lệ hoàn tất nộp hồ sơ và thời gian tìm 3 ứng viên phù hợp với 5–8 người thử; lấy phản hồi định tính.

Các con số trên là thiết kế đánh giá. Repository không khẳng định đã đạt chỉ số nào khi chưa thực nghiệm.

## Sau cuộc thi

SSO trường và xác minh giảng viên; migration Alembic; object storage và quét mã độc; kiểm soát chia sẻ hồ sơ; pgvector/HNSW; worker crawl/index; email theo sự đồng ý; lịch phỏng vấn; audit log đầy đủ; quy trình xuất/xóa dữ liệu; chống spam/rate limit tập trung. Chỉ mở rộng sau khi luồng tuyển thật được xác thực.
