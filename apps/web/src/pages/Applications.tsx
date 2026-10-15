import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  FileText,
  GripVertical,
  Mail,
  Clock3,
  LoaderCircle,
  MessageSquareText,
  Layers3,
} from "lucide-react";
import { useApp } from "../App";
import { api, json, errorMessage } from "../api";
import type { Application, ApplicationStatus } from "../types";
import {
  Status,
  Modal,
  Tags,
  Empty,
  Notice,
  dateLabel,
  initials,
  statusLabel,
} from "../components/ui";

const columns: ApplicationStatus[] = [
  "submitted",
  "reviewing",
  "interview",
  "accepted",
];
const transitions: Record<ApplicationStatus, ApplicationStatus[]> = {
  submitted: ["reviewing", "rejected"],
  reviewing: ["interview", "rejected"],
  interview: ["accepted", "rejected"],
  accepted: [],
  rejected: [],
  withdrawn: [],
};
export function Applications() {
  const { user, applications, labs, refresh, notify } = useApp();
  const lecturer = user.role === "lecturer";
  const [selected, setSelected] = useState<number | null>(null),
    [labFilter, setLabFilter] = useState("all"),
    [tab, setTab] = useState("active"),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [dragOver, setDragOver] = useState("");
  const detail = applications.find((a) => a.id === selected);
  const scoped = applications.filter(
    (a) => labFilter === "all" || a.lab_id === Number(labFilter),
  );
  const visible = scoped.filter(
    (a) =>
      tab === "all" ||
      (tab === "active"
        ? !["rejected", "withdrawn"].includes(a.status)
        : ["rejected", "withdrawn"].includes(a.status)),
  );
  const changeStatus = async (
    application: Application,
    status: ApplicationStatus,
  ) => {
    setBusy(true);
    setError("");
    try {
      await api(
        `/applications/${application.id}/status`,
        json("PATCH", { status, note }),
      );
      await refresh();
      setNote("");
      notify(`Đã cập nhật: ${statusLabel[status]}.`);
    } catch (e) {
      setError(errorMessage(e));
      notify(errorMessage(e), true);
    } finally {
      setBusy(false);
    }
  };
  const openDetail = (a: Application) => {
    setSelected(a.id);
    setNote("");
    setError("");
  };
  return (
    <div className="page applications-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MỖI KẾT NỐI, MỘT HÀNH TRÌNH</div>
          <h1>
            {lecturer ? "Bảng tuyển chọn" : "Hồ sơ ứng tuyển"}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {lecturer
              ? "Xem hồ sơ, ghi chú và cùng ứng viên tiến đến bước tiếp theo."
              : "Theo dõi tiến trình và chuẩn bị cho cơ hội tiếp theo của bạn."}
          </p>
        </div>
        <Link
          to={lecturer ? "/assistant" : "/explore"}
          className="button primary"
        >
          {lecturer ? "Tìm ứng viên với AI" : "Tìm cơ hội mới"}
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="application-summary">
        {columns.map((c, i) => (
          <div key={c}>
            <span className={`step-index step-${c}`}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <strong>{scoped.filter((a) => a.status === c).length}</strong>
              <span>{statusLabel[c]}</span>
            </div>
            {i < 3 && <ArrowRight className="step-arrow" size={17} />}
          </div>
        ))}
      </div>
      <div className="pipeline-toolbar">
        <div className="segmented">
          {[
            { id: "active", label: "Đang theo dõi" },
            { id: "closed", label: "Đã khép lại" },
            { id: "all", label: "Tất cả" },
          ].map((t) => (
            <button
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
              key={t.id}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="inline-label">
          Phòng lab
          <select
            value={labFilter}
            onChange={(e) => setLabFilter(e.target.value)}
            aria-label="Lọc hồ sơ theo phòng lab"
          >
            <option value="all">Tất cả phòng lab</option>
            {labs
              .filter((l) =>
                lecturer
                  ? l.owner_id === user.id
                  : applications.some((a) => a.lab_id === l.id),
              )
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      {lecturer && tab === "active" ? (
        <>
          <div className="kanban-hint">
            <GripVertical size={15} />
            Kéo thẻ sang bước kế tiếp, hoặc mở hồ sơ để cập nhật trạng thái.
          </div>
          <div className="kanban">
            {columns.map((col, i) => (
              <section
                className={`kanban-column ${dragOver === col ? "drag-over" : ""}`}
                key={col}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col);
                }}
                onDragLeave={() => setDragOver("")}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver("");
                  const a = applications.find(
                    (x) =>
                      x.id === Number(e.dataTransfer.getData("text/plain")),
                  );
                  if (a && transitions[a.status].includes(col) && !busy)
                    void changeStatus(a, col);
                  else
                    notify(
                      "Chỉ có thể chuyển hồ sơ sang bước kế tiếp trong quy trình.",
                      true,
                    );
                }}
              >
                <div className="kanban-column-head">
                  <span className={`column-dot dot-${col}`} />
                  <h2>{i === 0 ? "Nộp hồ sơ" : statusLabel[col]}</h2>
                  <span className="column-count">
                    {visible.filter((a) => a.status === col).length}
                  </span>
                </div>
                <div className="kanban-cards">
                  {visible
                    .filter((a) => a.status === col)
                    .map((a) => (
                      <article
                        className="candidate-card"
                        key={a.id}
                        draggable={!busy && transitions[a.status].length > 0}
                        onDragStart={(e) =>
                          e.dataTransfer.setData("text/plain", String(a.id))
                        }
                      >
                        <div className="candidate-top">
                          <span className="avatar candidate-avatar">
                            {initials(a.student_name)}
                          </span>
                          <GripVertical size={16} />
                        </div>
                        <button
                          className="candidate-name"
                          onClick={() => openDetail(a)}
                        >
                          {a.student_name}
                          <ArrowUpRight size={16} />
                        </button>
                        <p>{a.lab_name}</p>
                        <Tags values={a.student_skills} limit={3} />
                        <div className="candidate-footer">
                          <span>
                            GPA{" "}
                            <strong>{a.student_gpa?.toFixed(2) || "—"}</strong>
                          </span>
                          <small>{dateLabel(a.created_at)}</small>
                        </div>
                        <button
                          className="candidate-open"
                          onClick={() => openDetail(a)}
                        >
                          Xem hồ sơ
                          <ArrowRight size={14} />
                        </button>
                      </article>
                    ))}
                  {!visible.some((a) => a.status === col) && (
                    <div className="kanban-empty">
                      <Layers3 size={22} />
                      <p>Chưa có hồ sơ ở bước này</p>
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : visible.length ? (
        <div className="application-list">
          {visible.map((a) => (
            <article className="application-card" key={a.id}>
              <div className="application-icon">
                <FileText size={23} />
              </div>
              <div className="application-copy">
                <div>
                  <h3>{lecturer ? a.student_name : a.lab_name}</h3>
                  <Status status={a.status} />
                </div>
                <p>
                  {lecturer ? a.lab_name : "Ứng tuyển thành viên nghiên cứu"}
                </p>
                <span>
                  <Clock3 size={13} />
                  Nộp ngày {dateLabel(a.created_at)} · Cập nhật{" "}
                  {dateLabel(a.updated_at)}
                </span>
              </div>
              <button
                className="button secondary small"
                onClick={() => openDetail(a)}
              >
                Xem hồ sơ
                <ArrowUpRight size={15} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Chưa có hồ sơ trong danh sách này"
          text={
            lecturer
              ? "Hồ sơ ứng tuyển vào lab của bạn sẽ được quản lý tại đây."
              : "Tìm một hướng nghiên cứu bạn yêu thích và gửi lời giới thiệu đến giảng viên."
          }
          action={
            !lecturer ? (
              <Link to="/explore" className="button secondary">
                Khám phá phòng lab
                <ArrowRight size={16} />
              </Link>
            ) : undefined
          }
        />
      )}
      {detail && (
        <Modal
          title={lecturer ? detail.student_name : detail.lab_name}
          subtitle={`Hồ sơ #${detail.id} · Nộp ngày ${dateLabel(detail.created_at)}`}
          wide
          onClose={() => setSelected(null)}
        >
          <div className="application-detail-top">
            <Status status={detail.status} />
            <span>
              GPA{" "}
              <strong>
                {detail.student_gpa?.toFixed(2) || "Chưa cập nhật"}
              </strong>
            </span>
          </div>
          <div className="detail-sections">
            <section>
              <h3>Ứng viên & phòng lab</h3>
              <p>
                <strong>{detail.student_name}</strong> → {detail.lab_name}
              </p>
              <a className="text-link" href={`mailto:${detail.student_email}`}>
                <Mail size={15} />
                {detail.student_email}
              </a>
            </section>
            <section>
              <h3>Kỹ năng & định hướng</h3>
              <Tags
                values={[...detail.student_skills, ...detail.student_interests]}
              />
            </section>
            <section>
              <h3>Lời giới thiệu</h3>
              <p className="preserve-lines">{detail.cover_letter}</p>
            </section>
            <section>
              <h3>
                <FileText size={18} />
                Tài liệu đính kèm
              </h3>
              {detail.documents?.length ? (
                <div className="document-links">
                  {detail.documents.map((d) => (
                    <a
                      href={`/api/documents/${d.id}/download`}
                      key={d.id}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FileText size={17} />
                      {d.filename}
                      <span>{d.kind === "cv" ? "CV" : "Bảng điểm"}</span>
                      <ArrowUpRight size={15} />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  Không có tài liệu đính kèm khi nộp hồ sơ.
                </p>
              )}
            </section>
            <section>
              <h3>
                <MessageSquareText size={18} />
                Lịch sử xử lý
              </h3>
              <div className="timeline">
                {detail.history?.map((h, i) => (
                  <div key={i}>
                    <span className="timeline-dot" />
                    <div>
                      <strong>
                        {statusLabel[
                          (h.to_status || h.status) as ApplicationStatus
                        ] || h.to_status}
                      </strong>
                      <small>{h.created_at && dateLabel(h.created_at)}</small>
                      {h.note && <p>{h.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <div className="application-actions">
            {error && <Notice error>{error}</Notice>}
            {lecturer && transitions[detail.status].length > 0 ? (
              <>
                <label>
                  Ghi chú cho bước xử lý
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="Ghi chú này cũng hiển thị cho sinh viên…"
                  />
                </label>
                <div className="form-actions">
                  {transitions[detail.status].map((s) => (
                    <button
                      key={s}
                      disabled={busy}
                      className={`button ${s === "rejected" ? "danger-outline" : "primary"}`}
                      onClick={() => void changeStatus(detail, s)}
                    >
                      {busy ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : null}
                      {s === "rejected"
                        ? "Chưa phù hợp"
                        : `Chuyển: ${statusLabel[s]}`}
                      {s !== "rejected" && <ArrowRight size={16} />}
                    </button>
                  ))}
                </div>
              </>
            ) : !lecturer &&
              !["rejected", "withdrawn", "accepted"].includes(detail.status) ? (
              <>
                <Notice>
                  Rút hồ sơ sẽ kết thúc lượt ứng tuyển này. Bạn có thể nộp lại
                  khi lab còn tuyển.
                </Notice>
                <button
                  className="button danger-outline"
                  disabled={busy}
                  onClick={() => void changeStatus(detail, "withdrawn")}
                >
                  Rút hồ sơ ứng tuyển
                </button>
              </>
            ) : (
              <p className="muted">Quy trình của hồ sơ này đã hoàn tất.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
