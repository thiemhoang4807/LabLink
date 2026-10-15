import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  FlaskConical,
  FileText,
  CalendarDays,
  CircleCheck,
  Sparkles,
  Check,
  Plus,
  TrendingUp,
} from "lucide-react";
import { useApp } from "../App";
import { LabCard, Status, dateLabel, Empty } from "../components/ui";

export function Dashboard() {
  const { user, labs, applications, matches, favorites, toggleFavorite } =
    useApp();
  const navigate = useNavigate();
  const lecturer = user.role === "lecturer";
  const steps = [
    { label: "Thông tin cá nhân", done: !!user.bio },
    {
      label: "Kỹ năng & định hướng",
      done: !!user.skills?.length && !!user.interests?.length,
    },
    {
      label: "Bảng điểm & CV",
      done:
        !!user.documents?.some((d) => d.kind === "cv") &&
        !!user.documents?.some((d) => d.kind === "transcript"),
    },
  ];
  const percent = Math.round(
    (steps.filter((s) => s.done).length / steps.length) * 100,
  );
  const ranked = [...labs].sort(
    (a, b) =>
      (matches.find((m) => m.lab_id === b.id)?.score || 0) -
      (matches.find((m) => m.lab_id === a.id)?.score || 0),
  );
  const stats = [
    {
      label: lecturer ? "Phòng lab của bạn" : "Phòng lab đang mở",
      value: labs.filter((l) => (lecturer ? l.owner_id === user.id : l.is_open))
        .length,
      icon: FlaskConical,
      hint: lecturer
        ? "Không gian nghiên cứu của bạn"
        : "Cơ hội để bắt đầu khám phá",
      tone: "green",
    },
    {
      label: lecturer ? "Hồ sơ nhận được" : "Hồ sơ đã ứng tuyển",
      value: applications.length,
      icon: FileText,
      hint: lecturer
        ? "Ứng viên trong các lab của bạn"
        : "Đang theo dõi tại một nơi",
      tone: "blue",
    },
    {
      label: "Đang phỏng vấn",
      value: applications.filter((a) => a.status === "interview").length,
      icon: CalendarDays,
      hint: "Chủ động trao đổi bước tiếp theo",
      tone: "orange",
    },
    {
      label: "Đã chấp nhận",
      value: applications.filter((a) => a.status === "accepted").length,
      icon: CircleCheck,
      hint: "Một khởi đầu cho hành trình mới",
      tone: "purple",
    },
  ];
  return (
    <div className="page dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">GÓC NHÌN TỔNG QUAN</div>
          <h1>
            Chào {user.name.split(" ").slice(-2).join(" ")},
            <span className="greeting-wave"> ✳</span>
          </h1>
          <p>
            {lecturer
              ? "Cùng tìm những cộng sự cho ý tưởng nghiên cứu tiếp theo."
              : "Hành trình nghiên cứu của bạn bắt đầu từ đây."}
          </p>
        </div>
        <Link
          className="button secondary heading-action"
          to={lecturer ? "/manage" : "/profile"}
        >
          <Plus size={17} />
          {lecturer ? "Quản lý phòng lab" : "Cập nhật hồ sơ"}
        </Link>
      </div>
      <section className="welcome-banner">
        <div className="welcome-copy">
          <div className="banner-label">
            <span />
            KẾT NỐI TIỀM NĂNG, MỞ LỐI NGHIÊN CỨU
          </div>
          <h2>
            {lecturer ? (
              <>
                Tìm cộng sự phù hợp.
                <br />
                <em>Cùng làm điều ý nghĩa.</em>
              </>
            ) : (
              <>
                Đúng phòng lab.
                <br />
                <em>Đúng hướng phát triển.</em>
              </>
            )}
          </h2>
          <p>
            {lecturer
              ? "Từ hồ sơ đến phỏng vấn, một quy trình gọn gàng để bạn dành thời gian cho nghiên cứu."
              : "Khám phá những nhóm nghiên cứu phù hợp với kỹ năng, sở thích và điều bạn muốn theo đuổi."}
          </p>
          <Link
            to={lecturer ? "/applications" : "/explore"}
            className="button lime"
          >
            {lecturer ? "Xem hồ sơ ứng tuyển" : "Khám phá phòng lab"}
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <div className="art-ring ring-a" />
          <div className="art-ring ring-b" />
          <div className="art-ring ring-c" />
          <div className="art-label label-top">
            <span className="art-dot" />
            Sự tò mò
          </div>
          <div className="art-label label-bottom">
            <span className="art-dot" />
            Cơ hội mới
          </div>
          <div className="art-square">
            <FlaskConical size={48} strokeWidth={1.2} />
            <span>
              GROW
              <br />
              TOGETHER.
            </span>
          </div>
          <div className="art-spark">✳</div>
          <div className="art-mini">
            <TrendingUp size={23} />
          </div>
        </div>
      </section>
      <section className="stats-grid" aria-label="Số liệu tổng quan">
        {stats.map((s) => (
          <button
            className="stat-card"
            key={s.label}
            onClick={() =>
              navigate(
                s.label.includes("lab") || s.label.includes("Lab")
                  ? lecturer
                    ? "/manage"
                    : "/explore"
                  : "/applications",
              )
            }
          >
            <div className="stat-top">
              <span>{s.label}</span>
              <span className={`stat-icon ${s.tone}`}>
                <s.icon size={18} strokeWidth={1.7} />
              </span>
            </div>
            <strong>{s.value.toString().padStart(2, "0")}</strong>
            <small>{s.hint}</small>
          </button>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="recommendations">
          <div className="section-title">
            <div>
              <h2>
                {lecturer ? "Khám phá cộng đồng lab" : "Có thể bạn sẽ hứng thú"}
                <span className="subtle-spark">
                  <Sparkles size={16} />
                </span>
              </h2>
              <p>
                {lecturer
                  ? "Các hướng nghiên cứu trong không gian LabLink."
                  : "Gợi ý từ kỹ năng và định hướng trong hồ sơ của bạn."}
              </p>
            </div>
            <Link to="/explore">
              Xem tất cả
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="lab-grid dashboard-labs">
            {ranked.slice(0, 2).map((lab, i) => (
              <LabCard
                key={lab.id}
                lab={lab}
                index={i}
                match={matches.find((m) => m.lab_id === lab.id)}
                saved={favorites.includes(lab.id)}
                onSave={() => toggleFavorite(lab.id)}
                onOpen={() => navigate(`/explore?lab=${lab.id}`)}
              />
            ))}
          </div>
          {!labs.length && (
            <Empty
              title="Chưa có phòng lab"
              text="Các phòng lab sẽ xuất hiện sau khi được tạo."
            />
          )}
        </section>
        <aside className="profile-widget">
          <div className="profile-widget-head">
            <span className="eyebrow">
              {lecturer ? "QUY TRÌNH TUYỂN CHỌN" : "HỒ SƠ CỦA BẠN"}
            </span>
            <span className="small-arrow">
              <ArrowUpRight size={17} />
            </span>
          </div>
          {lecturer ? (
            <>
              <div className="profile-progress-number">
                {applications.filter((a) => a.status === "submitted").length}
                <small> hồ sơ mới</small>
              </div>
              <h3>Sẵn sàng cho kết nối mới?</h3>
              <p>
                Mở từng hồ sơ, ghi chú và chuyển bước để giữ mọi thứ rõ ràng.
              </p>
              <div className="pipeline-mini">
                <span>Tiếp nhận</span>
                <ArrowRight size={14} />
                <span>Phỏng vấn</span>
                <ArrowRight size={14} />
                <span>Kết nối</span>
              </div>
              <Link to="/applications" className="button secondary full">
                Mở bảng tuyển chọn
                <ArrowRight size={16} />
              </Link>
            </>
          ) : (
            <>
              <div className="profile-progress-number">
                {percent}
                <small>%</small>
              </div>
              <h3>Thêm một chút về bạn.</h3>
              <p>Hồ sơ đầy đủ giúp giảng viên hiểu rõ tiềm năng của bạn hơn.</p>
              <div className="progress-track">
                <span style={{ width: `${percent}%` }} />
              </div>
              <div className="checklist">
                {steps.map((s) => (
                  <div key={s.label}>
                    <span className={s.done ? "check done" : "check"}>
                      {s.done && <Check size={12} />}
                    </span>
                    {s.label}
                  </div>
                ))}
              </div>
              <Link to="/profile" className="button secondary full">
                Hoàn thiện hồ sơ
                <ArrowRight size={16} />
              </Link>
            </>
          )}
        </aside>
      </div>
      <section className="panel activity-panel">
        <div className="section-title">
          <div>
            <h2>{lecturer ? "Ứng viên gần đây" : "Hành trình ứng tuyển"}</h2>
            <p>Mỗi bước tiến đều đáng được theo dõi.</p>
          </div>
          <Link to="/applications">
            Xem chi tiết
            <ArrowRight size={16} />
          </Link>
        </div>
        {applications.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{lecturer ? "ỨNG VIÊN" : "PHÒNG LAB"}</th>
                  <th>NGÀY NỘP</th>
                  <th>TRẠNG THÁI</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...applications]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .slice(0, 4)
                  .map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>
                          {lecturer ? a.student_name : a.lab_name}
                        </strong>
                        <small>
                          {lecturer
                            ? a.lab_name
                            : "Ứng tuyển thành viên nghiên cứu"}
                        </small>
                      </td>
                      <td>{dateLabel(a.created_at)}</td>
                      <td>
                        <Status status={a.status} />
                      </td>
                      <td>
                        <Link
                          className="icon-button"
                          to="/applications"
                          aria-label={`Xem hồ sơ ${a.lab_name}`}
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Câu chuyện của bạn đang chờ được viết"
            text="Khám phá một lab phù hợp và gửi hồ sơ đầu tiên."
            action={
              <Link to="/explore" className="button secondary">
                Khám phá ngay
                <ArrowRight size={16} />
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
