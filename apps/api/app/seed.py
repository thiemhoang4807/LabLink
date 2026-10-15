"""Fictitious demo data only. No real lecturer identities or student records."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.models import Application, ApplicationEvent, Lab, Publication, User

DEMO_PASSWORD = "Demo@2026!"


def seed_demo(db: Session):
    if db.scalar(select(User.id).limit(1)) is not None:
        return
    lecturer = User(name="TS. Nguyễn Minh An", email="lecturer@lablink.demo", role="lecturer", password_hash=hash_password(DEMO_PASSWORD),
                    bio="Nhân vật minh họa. Nghiên cứu xử lý ngôn ngữ tự nhiên, RAG và đánh giá hệ thống AI.",
                    skills=["Python", "PyTorch", "NLP"], interests=["NLP", "Generative AI"], university="Đại học Demo", consent_ai=False)
    other = User(name="TS. Trần Khánh Linh", email="lecturer2@lablink.demo", role="lecturer", password_hash=hash_password(DEMO_PASSWORD),
                bio="Nhân vật minh họa. Nghiên cứu hệ thống phần mềm và dữ liệu.", skills=["ReactJS", "TypeScript", "SQL"],
                interests=["Software Engineering", "Data Science"], university="Đại học Demo", consent_ai=False)
    db.add_all([lecturer, other])
    students_data = [
        ("Nguyễn Hoàng Nam", "student@lablink.demo", 3.6, ["Python", "ReactJS", "SQL", "PyTorch"], ["NLP", "Generative AI"], "Mong muốn xây dựng trợ lý nghiên cứu tiếng Việt có nguồn dẫn rõ ràng."),
        ("Lê Thảo Vy", "vy@lablink.demo", 3.85, ["Python", "PyTorch", "NLP", "Hugging Face"], ["NLP", "Generative AI"], "Đã thực hiện dự án tìm kiếm ngữ nghĩa và đánh giá RAG."),
        ("Phạm Đức Huy", "huy@lablink.demo", 3.45, ["Python", "OpenCV", "PyTorch"], ["Computer Vision", "Medical AI"], "Quan tâm mô hình thị giác trong ảnh y tế, thích thực nghiệm có kiểm soát."),
        ("Trần Ngọc Mai", "mai@lablink.demo", 3.7, ["ReactJS", "TypeScript", "Python", "Git"], ["Software Engineering", "Human Computer Interaction"], "Muốn phát triển sản phẩm nghiên cứu có trải nghiệm người dùng tốt."),
        ("Võ Minh Khoa", "khoa@lablink.demo", 3.3, ["Python", "SQL", "Pandas", "Statistics"], ["Data Science", "Machine Learning"], "Yêu thích phân tích dữ liệu, thống kê và tính tái lập nghiên cứu."),
        ("Đặng Bảo Anh", "anh@lablink.demo", 3.9, ["Python", "PyTorch", "ReactJS", "NLP"], ["NLP", "AI"], "Đã xây dựng chatbot hỗ trợ sinh viên và cần hướng dẫn đánh giá mô hình."),
    ]
    students = []
    for name, email, gpa, skills, interests, bio in students_data:
        student = User(name=name, email=email, role="student", password_hash=hash_password(DEMO_PASSWORD), gpa=gpa,
                       skills=skills, interests=interests, bio=bio, major="Công nghệ thông tin", year=3, university="Đại học Demo", consent_ai=False)
        students.append(student)
        db.add(student)
    db.flush()
    lab_data = [
        (lecturer, "Language & Knowledge Lab", "language-knowledge", "Biến dữ liệu thành tri thức. Cùng xây dựng AI hiểu tiếng Việt.",
         "Nhóm nghiên cứu xử lý ngôn ngữ tự nhiên, truy xuất tăng cường sinh và đánh giá độ tin cậy của LLM. Sinh viên tham gia đọc bài báo hàng tuần, xây dựng bộ dữ liệu và phát triển prototype có khả năng kiểm chứng. Ưu tiên tinh thần học hỏi và khả năng làm việc nhóm.",
         ["NLP", "Generative AI", "Information Retrieval"], ["Python", "PyTorch", "NLP"], 3.2, 6, "Tòa A · Phòng 402"),
        (lecturer, "Vision Intelligence Lab", "vision-intelligence", "Khám phá thị giác máy tính và các mô hình học sâu ứng dụng.",
         "Nghiên cứu nhận dạng hình ảnh, phân đoạn ảnh y tế và học đa phương thức. Nhóm hướng dẫn cách thiết kế thực nghiệm, quản lý dữ liệu và trình bày kết quả khoa học.",
         ["Computer Vision", "Medical AI", "Deep Learning"], ["Python", "OpenCV", "PyTorch"], 3.0, 5, "Tòa B · Phòng 305"),
        (lecturer, "Human–AI Interaction Lab", "human-ai", "Thiết kế AI dễ hiểu, hữu ích và lấy con người làm trung tâm.",
         "Khảo sát trải nghiệm người dùng trong sản phẩm AI, giải thích mô hình và thiết kế giao diện tương tác. Kết hợp phương pháp nghiên cứu định tính với prototype web.",
         ["Human Computer Interaction", "AI", "UX Research"], ["ReactJS", "TypeScript", "Python"], 2.8, 4, "Tòa A · Phòng 501"),
        (other, "Software Systems Lab", "software-systems", "Xây dựng hệ thống phần mềm đáng tin cậy từ ý tưởng tới vận hành.",
         "Tập trung kiểm thử tự động, kiến trúc dịch vụ, DevOps và công cụ hỗ trợ lập trình viên. Sinh viên phát triển sản phẩm thực tế và đo lường chất lượng phần mềm.",
         ["Software Engineering", "Cloud Computing"], ["ReactJS", "TypeScript", "Git", "SQL"], 3.0, 6, "Tòa C · Phòng 201"),
        (other, "Data & Decision Lab", "data-decision", "Tìm quy luật trong dữ liệu để hỗ trợ những quyết định tốt hơn.",
         "Nghiên cứu phân tích dữ liệu, học máy có giám sát và dự báo chuỗi thời gian. Chú trọng thống kê, khả năng giải thích và đánh giá mô hình công bằng.",
         ["Data Science", "Machine Learning", "Statistics"], ["Python", "SQL", "Pandas", "Statistics"], 3.1, 5, "Tòa B · Phòng 204"),
        (other, "Secure Computing Lab", "secure-computing", "Bảo vệ dữ liệu, ứng dụng và các hệ thống kết nối.",
         "Nghiên cứu bảo mật ứng dụng, quyền riêng tư dữ liệu và phát hiện bất thường. Sinh viên thực hành phân tích lỗ hổng trên hệ thống thử nghiệm được cấp phép.",
         ["Cybersecurity", "Privacy", "Software Engineering"], ["Python", "Linux", "Networking"], 3.0, 4, "Tòa C · Phòng 403"),
    ]
    labs = []
    for owner, name, slug, summary, description, topics, skills, min_gpa, capacity, location in lab_data:
        lab = Lab(owner_id=owner.id, name=name, slug=slug, summary=summary, description=description, topics=topics,
                  skills=skills, min_gpa=min_gpa, capacity=capacity, location=location, website="", is_open=True)
        db.add(lab)
        labs.append(lab)
    db.flush()
    titles = [
        [("Đánh giá truy xuất tri thức cho trợ lý học thuật tiếng Việt", "Nghiên cứu minh họa về retrieval augmented generation, semantic search, NLP và nguồn dẫn đáng tin cậy."), ("Học biểu diễn ngữ nghĩa với dữ liệu tiếng Việt ít tài nguyên", "Bài báo minh họa về language models, embeddings và đánh giá khả năng khái quát.")],
        [("Phân đoạn ảnh y tế bằng mô hình thị giác gọn nhẹ", "Bài báo minh họa về computer vision, medical image segmentation, PyTorch và OpenCV.")],
        [("Thiết kế giao diện giải thích độ tin cậy của trợ lý AI", "Nghiên cứu minh họa về human computer interaction, UX research và thiết kế ReactJS.")],
        [("Kiểm thử chất lượng trong hệ thống ứng dụng nhiều dịch vụ", "Nghiên cứu minh họa về software engineering, integration testing, TypeScript và DevOps.")],
        [("Dự báo chuỗi thời gian với dữ liệu không đầy đủ", "Bài báo minh họa về statistics, machine learning, Python và phân tích dữ liệu bằng Pandas.")],
        [("Phát hiện truy cập bất thường trong ứng dụng học thuật", "Nghiên cứu minh họa về cybersecurity, privacy và giám sát quyền truy cập.")],
    ]
    for lab, papers in zip(labs, titles):
        for title, abstract in papers:
            db.add(Publication(lab_id=lab.id, title=title, abstract=abstract, year=2026, source="demo-fictional", topics=lab.topics, keywords=lab.skills))
    applications = [(students[0], labs[1], "reviewing"), (students[0], labs[4], "submitted"),
                    (students[1], labs[0], "submitted"), (students[2], labs[0], "reviewing"),
                    (students[3], labs[0], "interview"), (students[4], labs[2], "accepted"),
                    (students[5], labs[0], "submitted")]
    path = ["submitted", "reviewing", "interview", "accepted"]
    for student, lab, status in applications:
        application = Application(student_id=student.id, lab_id=lab.id, status=status,
                                  cover_letter=f"Em quan tâm đến hướng nghiên cứu của {lab.name}. {student.bio} Em có thể dành 12 giờ mỗi tuần để tham gia nhóm và hoàn thành các nhiệm vụ được giao.")
        db.add(application)
        db.flush()
        previous = None
        for step in path[:path.index(status) + 1]:
            db.add(ApplicationEvent(application_id=application.id, actor_id=student.id if step == "submitted" else lab.owner_id,
                                    from_status=previous, to_status=step, note="Dữ liệu minh họa"))
            previous = step
    db.commit()
