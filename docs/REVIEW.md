# Rà soát chức năng LabLink

Ngày rà soát/cập nhật: **16/10/2026**. Đối chiếu mã nguồn với ý tưởng ban đầu và ghi lại cả lỗi đã sửa trong nhánh này lẫn phần sản phẩm còn thiếu.

## Kết luận

Luồng MVP **hồ sơ → tìm lab → nộp đơn → giảng viên duyệt qua Kanban → sinh viên theo dõi** đã chạy. Nhánh này sửa tám lỗi chức năng đã tái hiện, gồm đăng xuất trên màn hình nhỏ, GPA theo vai trò, bộ lọc chatbot, điểm matching, bảo toàn bản nháp, truy vấn lab sau 500 bản ghi và forwarded IP trong Compose. Sản phẩm vẫn tập trung vào ứng tuyển lab; các giới hạn và phần chưa triển khai được nêu bên dưới.

Các kiểm thử hiện có đạt không có nghĩa mọi chức năng hoặc mọi cách diễn đạt truy vấn đã được bao phủ.

## Đối chiếu yêu cầu

| Yêu cầu | Hiện trạng thực tế | Phần còn thiếu hoặc hạn chế |
|---|---|---|
| Hồ sơ sinh viên | Có GPA, kỹ năng, định hướng, giới thiệu, ngành, năm học, trường, website và tài liệu | Giảng viên chưa xem được phần lớn các trường ngoài tên/email/GPA/kỹ năng/định hướng |
| CV và bảng điểm | Upload, tải xuống và xóa PDF; kiểm tra quyền và giới hạn tài nguyên | Chưa chọn riêng bộ tài liệu khi nộp từng đơn; GPA vẫn tự khai, không xác minh bằng bảng điểm |
| Hồ sơ giảng viên | Chủ tài khoản có thể sửa hồ sơ cá nhân; tên giảng viên hiển thị ở lab | Chưa có trang công khai/danh sách/tìm kiếm hồ sơ nghiên cứu giảng viên độc lập |
| Quản lý lab | Tạo/sửa thông tin, tiêu chí, số lượng và đóng/mở nhận hồ sơ | Lab là đích ứng tuyển duy nhất; chưa có đơn xin người hướng dẫn trực tiếp |
| Quản lý công trình | Thêm thủ công hoặc xác nhận nội dung import; tự gắn topic/keyword | Chưa sửa/xóa công trình đã thêm; công trình gắn lab, chưa gắn hồ sơ giảng viên độc lập |
| Crawl nghiên cứu | Đọc một URL HTTPS công khai trong allowlist; robots, redirect, timeout, preview | Chưa thu thập danh sách bài báo từ trang giảng viên; chỉ tạo paper khi trang có citation metadata; không có Google Scholar crawler hoặc đồng bộ định kỳ |
| Phân loại chủ đề/keyword | Taxonomy/từ điển và trích từ khóa local | Không phải bộ phân loại học máy/LLM; `/classify` vẫn local khi cấu hình AI ngoài |
| Smart matching | Có điểm 0–100, lý do và gap; điểm biên được kiểm tra trong E2E | Điểm matching không được hiệu chỉnh bằng nhãn thực tế |
| Chatbot/RAG | Có persistent chunks, truy xuất có nguồn, phạm vi theo quyền; parser xử lý GPA nhiều điều kiện, khoảng, OR/phủ định đơn giản và custom skill rõ ràng | Cách diễn đạt tự do ngoài mẫu parser vẫn có thể chưa được hiểu; chưa có bộ lọc cấu trúc để sửa ý định; lịch sử chat không được dùng để hiểu câu tiếp theo |
| Vector database | SQLite JSON cho local; có nhánh PostgreSQL/pgvector cosine | Nhánh PostgreSQL và provider AI ngoài chưa được kiểm thử live trong môi trường này |
| Nộp nhiều lab | Có thể nộp từng lab riêng và chống trùng đơn active | Chưa chọn nhiều lab để nộp hàng loạt; đây là cải tiến UX, không đồng nghĩa không thể ứng tuyển nhiều lab |
| Pipeline/Kanban | Có bốn bước chính, từ chối/rút đơn, ghi chú và lịch sử; có nút chuyển và kéo thẻ | Chưa có lịch phỏng vấn hoặc thông báo chủ động; không thuộc bốn bước bắt buộc ban đầu |
| Mobile | Web responsive | Chưa có app native; web là lựa chọn phạm vi đã nêu trong README |
| Tài liệu và vận hành | Có README, AGENTS, ERD, API, roadmap nhóm 3 người, Compose, CI và E2E | Chưa có migration schema theo phiên bản; Docker/PostgreSQL chưa chạy tích hợp thực tế |

## Lỗi đã sửa và cách xác minh

### UX01 — Nút đăng xuất của giảng viên khuất ở viewport thấp

**Mức độ: P2. Trạng thái: Đã sửa.** Nút trước đây chỉ nằm cuối sidebar cố định. Sidebar giảng viên có thêm mục điều hướng, nên trên màn hình thấp phần đáy có thể nằm ngoài vùng nhìn thấy; API logout vốn không giới hạn theo vai. Đã thêm nút đăng xuất ở header cho cả hai vai và luôn hiện icon trên mobile. E2E xác nhận ở viewport 390×620 rằng giảng viên đăng xuất được, trở về màn hình đăng nhập và session server bị thu hồi.

### B01 — GPA của sinh viên bị áp vào GPA tối thiểu của lab

**Mức độ: P2, ưu tiên cao trong luồng tìm lab.**

**Trạng thái: Đã sửa.** Với truy vấn GPA của sinh viên, API so GPA hồ sơ với mức tối thiểu của từng lab; nếu thiếu GPA thì không khẳng định đủ điều kiện. Hồi quy kiểm tra lab min 3.0 được nhận với GPA 3.2, còn lab min 3.8 bị loại.

- Câu tái hiện: `Tìm lab phù hợp với GPA 3.2 của tôi, hướng AI`.
- Dữ liệu giả lập: một lab yêu cầu GPA 3.0, một lab yêu cầu 3.8.
- Trước sửa: chatbot loại lab 3.0 và trả lab 3.8, vì `lab.min_gpa` bị so sánh `>= 3.2`.
- Mong đợi: trong ngữ cảnh GPA của người hỏi, xét điều kiện người đó có đáp ứng yêu cầu lab hay không; nếu câu hỏi không rõ phải làm rõ, không khẳng định kết quả phù hợp.
- Nguồn: [GPA matching và retrieval](../apps/api/app/services/intelligence.py).

### B02 — Parser bỏ qua một phần điều kiện nhưng vẫn khẳng định kết quả phù hợp

**Mức độ: P2, ưu tiên cao trong tìm ứng viên.**

**Trạng thái: Đã sửa trong phạm vi parser local đã nêu.** Thêm kiểm tra điều kiện GPA kép/khoảng, nhóm OR, phủ định rõ và custom skill viết hoa. Các kiểu câu khác vẫn cần kiểm tra `filters` trả về.

Các trường hợp đã tái hiện với dữ liệu giả lập:

| Câu hỏi | Hành vi trước sửa |
|---|---|
| `React hoặc Python` | Chỉ giữ người có cả hai kỹ năng |
| `React nhưng không biết Python` | Vẫn yêu cầu có cả React và Python |
| `GPA từ 3.2 đến 3.5` | Vẫn có thể trả GPA 3.8 |
| `GPA > 3.2 và GPA < 3.5` | Chỉ xét biểu thức đầu, vẫn có thể trả GPA 3.8 |
| `React và Kubernetes` | Có thể trả người chỉ có React vì Kubernetes không nằm trong từ điển |

Trước sửa, parser chỉ trích một điều kiện GPA; kỹ năng/chủ đề nhận diện được luôn kết hợp AND. Giao diện hiện vẫn chỉ hiển thị bộ lọc đã hiểu, chưa cho sửa chúng bằng điều khiển có cấu trúc.

Phần còn lại là bộ điều khiển để chỉnh filter đã parse và cảnh báo điều kiện chưa hiểu. Parser không hỗ trợ mọi câu tự do. Nguồn: [trích điều kiện](../apps/api/app/services/intelligence.py), [so khớp](../apps/api/app/services/intelligence.py).

### B03 — Điểm matching 1% hiển thị thành 100%

**Mức độ: P2.**

**Trạng thái: Đã sửa.** UI dùng thẳng thang điểm API 0–100; E2E tạo lab 30 kỹ năng có điểm 1 và xác nhận hiển thị `1%`.

API trả điểm nguyên theo thang 0–100, nhưng UI trước đây nhân 100 cho mọi điểm không quá 1. Trường hợp hợp lệ: lab có 30 kỹ năng, sinh viên chỉ trùng Python, không trùng chủ đề; API trả `score: 1`, thẻ lab hiển thị `100% phù hợp`.

Nguồn: [công thức API](../apps/api/app/services/intelligence.py), [render UI](../apps/web/src/components/ui.tsx).

### B04 — Upload/xóa tài liệu làm mất bản nháp hồ sơ chưa lưu

**Mức độ: P2. Đã tái hiện bằng trình duyệt với API giả lập.**

**Trạng thái: Đã sửa.** Hồ sơ khởi tạo lại khi đổi tài khoản, không khi cùng user được refresh sau upload/xóa. E2E sửa GPA/kỹ năng chưa lưu rồi tải lên và xóa PDF; các giá trị còn nguyên.

1. Mở hồ sơ đang có GPA 3.5, kỹ năng Python.
2. Sửa thành GPA 3.9 và `Python, ReactJS`, chưa bấm lưu.
3. Upload một CV.
4. Tài liệu xuất hiện nhưng GPA tự trở về 3.5, kỹ năng trở về Python; không cảnh báo mất thay đổi.

Trước sửa, upload và xóa gọi refresh toàn bộ user; effect theo object `user` ghi đè toàn bộ form. Hiện form chỉ khởi tạo lại khi đổi tài khoản. Nguồn: [Profile](../apps/web/src/pages/Profile.tsx).

### B05 — Prompt gợi ý cá nhân hóa không dùng kỹ năng của người hỏi

**Mức độ: P2.**

**Trạng thái: Đã sửa.** Khi sinh viên hỏi cá nhân hóa, hồ sơ được dùng làm tín hiệu xếp hạng cả khi truy vấn cũng có topic/skill cứng. Điều kiện cứng vẫn lọc trước; dữ liệu cá nhân chỉ gửi ngoài khi đủ consent và theo trường cho phép.

Prompt mẫu `Tìm lab về AI phù hợp với kỹ năng của tôi` có topic AI nên không chạy nhánh bổ sung hồ sơ. Tái hiện với hai người có kỹ năng React và Python: cùng nhận React Lab/Python Lab theo cùng thứ tự, đều 35 điểm trong fixture. Endpoint `/ai/matches` riêng vẫn tính hồ sơ.

Trước sửa, cá nhân hóa chỉ được thêm khi không có hard constraint. Hiện yêu cầu cá nhân hóa được nhận diện riêng và dùng hồ sơ để xếp hạng; filter cứng vẫn chạy trước. Nguồn: [answer_query](../apps/api/app/services/intelligence.py).

### B06 — Lab sau bản ghi thứ 500 không tìm thấy trong danh sách

**Mức độ: P2, đã sửa lỗi thiếu kết quả.**

API trước đây lấy 500 bản ghi đầu rồi mới lọc tên/topic trong Python. Tái hiện SQLite với hơn 500 lab: gọi detail thấy lab cuối, nhưng tìm đúng tên hoặc topic riêng trả danh sách rỗng.

**Trạng thái: Đã sửa thiếu kết quả và thêm offset pagination tùy chọn.** Bộ lọc chạy trước phân trang; request không truyền `limit` vẫn trả đầy đủ kết quả để client hiện tại dùng được. API hiện tải toàn bộ danh sách vào bộ nhớ trước khi lọc, nên cần chuyển filter xuống DB nếu dữ liệu tăng lớn. Nguồn: [list_labs](../apps/api/app/routers/labs.py).

### B07 — Hạn mức đăng nhập có thể bị dùng chung phía sau Nginx

**Mức độ: P2, kết luận từ cấu hình; chưa tái hiện trong Docker.**

**Trạng thái: Đã cấu hình giới hạn proxy tin cậy; chưa chạy Docker trên máy này.** Compose gán IP cố định cho Nginx, Uvicorn chỉ tin IP đó, Nginx ghi đè `X-Forwarded-For`; request trực tiếp vào API không được tin header do client gửi. Cần kiểm tra tích hợp trên Docker trước khi dùng Compose.

Trước sửa, Uvicorn không tin IP Nginx; rate limit có thể gom khách phía sau proxy thành một địa chỉ. Cấu hình mới chỉ tin Nginx container cụ thể. Nguồn: [Compose](../compose.yaml), [Nginx](../apps/web/nginx.conf), [auth limiter](../apps/api/app/routers/auth.py).

## Chức năng nên bổ sung theo thứ tự

1. Hoàn thiện CRUD công trình: sửa/xóa, kiểm tra chủ sở hữu, cập nhật/invalidation RAG sau thay đổi.
2. Bổ sung hồ sơ giảng viên công khai có thông tin nghiên cứu do chủ tài khoản chọn hiển thị; hỗ trợ tìm người hướng dẫn độc lập với lab.
3. Cho giảng viên xem thêm trường sinh viên đã khai khi có đơn thuộc quyền, giữ quy tắc thu hồi khi rút đơn; không mở tìm hồ sơ sinh viên toàn hệ thống.
4. Bổ sung bộ lọc GPA/kỹ năng/chủ đề có thể chỉnh sửa và báo những điều kiện parser chưa hiểu.
5. Hoàn thiện import danh sách công trình từ nguồn trường thực tế được phép; không coi import một citation page là đồng bộ toàn bộ hồ sơ nghiên cứu.
6. Cho sinh viên chọn CV/bảng điểm cụ thể khi ứng tuyển thay vì tự gắn toàn bộ tệp hiện có.
7. Chạy tích hợp PostgreSQL/pgvector, Docker và provider AI thật; tạo tập đánh giá retrieval/matching cho phần khoa học của cuộc thi.

Đăng ký giảng viên đang tự khai vai trò, chưa có xác minh/duyệt; chưa có quên/đổi mật khẩu và quản trị tài khoản. Đây là phần cần chốt trước pilot thật. Email/push, lịch phỏng vấn, nộp nhiều lab một lần, bookmark đồng bộ và native mobile là cải tiến sau luồng chính, không phải toàn bộ đều là yêu cầu bắt buộc ban đầu.

## Kiểm chứng lần rà soát này

- Toàn bộ backend: **45 pytest đạt**, một cảnh báo deprecation từ Starlette TestClient; chạy bằng SQLite/fixture giả lập.
- `npm run typecheck`, `npm run build`: đạt.
- `npm run test:e2e`: **13 bước đạt**, exit 0, không lỗi JavaScript, không request ngoài, cleanup không lỗi; dùng database và file PDF giả lập riêng.
- Hồi quy bao gồm GPA theo vai trò, parser OR/phủ định/khoảng/custom skill, prompt cá nhân hóa, lab sau bản ghi 500, điểm UI 1%, giữ draft khi upload/xóa, và logout cả hai vai.
- Chưa chạy Docker/PostgreSQL, provider AI ngoài hoặc crawl website trường live. Cấu hình trusted proxy B07 chưa được kiểm tra end-to-end trên Docker.

E2E tạo giảng viên/lab/công trình ban đầu qua API. Chưa bao phủ sửa/xóa nghiên cứu, câu hỏi ngôn ngữ phức tạp ngoài mẫu parser, kéo thả Kanban hoặc nhiều người dùng thực qua reverse proxy.
