import { useEffect, useState } from "react";
import {
  Save,
  Upload,
  FileText,
  Download,
  Trash2,
  ShieldCheck,
  LoaderCircle,
  UserRound,
  LockKeyhole,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "../App";
import { api, json, errorMessage } from "../api";
import { Notice, initials } from "../components/ui";

const splitTags = (s: string) => [
  ...new Set(
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  ),
];
export function Profile() {
  const { user, refresh, notify } = useApp();
  const [form, setForm] = useState({
    name: "",
    bio: "",
    gpa: "",
    skills: "",
    interests: "",
    major: "",
    year: "",
    university: "",
    website: "",
    consent_ai: false,
  });
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(""),
    [fileKind, setFileKind] = useState("cv");
  useEffect(() => {
    setForm({
      name: user.name,
      bio: user.bio || "",
      gpa: user.gpa?.toString() || "",
      skills: (user.skills || []).join(", "),
      interests: (user.interests || []).join(", "),
      major: user.major || "",
      year: user.year?.toString() || "",
      university: user.university || "",
      website: user.website || "",
      consent_ai: user.consent_ai,
    });
    // Refreshes after document changes replace the user object. Preserve an
    // unsaved draft for the same account; initialize only when the account changes.
  }, [user.id]);
  const field = (name: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [name]: value }));
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api(
        "/profile",
        json("PATCH", {
          ...form,
          gpa: form.gpa === "" ? null : Number(form.gpa),
          year: form.year === "" ? null : Number(form.year),
          skills: splitTags(form.skills),
          interests: splitTags(form.interests),
        }),
      );
      await refresh();
      notify("Đã lưu hồ sơ của bạn.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError("Tài liệu cần nhỏ hơn hoặc bằng 5 MB.");
      setUploading(false);
      return;
    }
    const body = new FormData();
    body.append("file", file);
    body.append("kind", fileKind);
    try {
      await api("/documents", { method: "POST", body });
      await refresh();
      notify(
        "Đã tải tài liệu lên. Hãy kiểm tra lại hồ sơ trước khi ứng tuyển.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };
  const remove = async (id: number) => {
    try {
      await api(`/documents/${id}`, { method: "DELETE" });
      await refresh();
      notify("Đã xóa tài liệu.");
    } catch (e) {
      notify(errorMessage(e), true);
    }
  };
  return (
    <div className="page profile-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CÂU CHUYỆN CỦA BẠN</div>
          <h1>
            Hồ sơ của tôi<span className="heading-dot">.</span>
          </h1>
          <p>Để cơ hội phù hợp tìm đến đúng bạn.</p>
        </div>
        <span className="private-label">
          <LockKeyhole size={15} />
          Thông tin cá nhân được phân quyền
        </span>
      </div>
      <div className="profile-layout">
        <aside>
          <div className="profile-identity panel">
            <span className="profile-big-avatar">{initials(user.name)}</span>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
            <span className="role-chip">
              <UserRound size={14} />
              {user.role === "student" ? "Sinh viên" : "Giảng viên"}
            </span>
            <div className="identity-rule" />
            <div className="identity-item">
              <span>Kỹ năng</span>
              <strong>{user.skills?.length || 0}</strong>
            </div>
            <div className="identity-item">
              <span>Hướng quan tâm</span>
              <strong>{user.interests?.length || 0}</strong>
            </div>
            <div className="identity-item">
              <span>Tài liệu</span>
              <strong>{user.documents?.length || 0}</strong>
            </div>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={26} />
            <h3>Bạn làm chủ hồ sơ.</h3>
            <p>
              {user.role === "student"
                ? "Giảng viên chỉ xem được hồ sơ và tài liệu đính kèm khi bạn ứng tuyển vào lab của họ."
                : "Bạn chỉ có thể truy vấn hồ sơ của các sinh viên đã ứng tuyển vào phòng lab của mình."}
            </p>
          </div>
        </aside>
        <div className="profile-forms">
          <form
            className="panel form-panel"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="section-title">
              <div>
                <h2>
                  Thông tin{" "}
                  {user.role === "student" ? "sinh viên" : "giảng viên"}
                </h2>
                <p>Những điều giúp kết nối phù hợp hơn.</p>
              </div>
              <span className="form-section-number">01</span>
            </div>
            <div className="form-grid">
              <label>
                Họ và tên
                <input
                  value={form.name}
                  onChange={(e) => field("name", e.target.value)}
                  minLength={2}
                  maxLength={120}
                  required
                  autoComplete="name"
                />
              </label>
              <label>
                Trường / Đơn vị
                <input
                  value={form.university}
                  onChange={(e) => field("university", e.target.value)}
                  maxLength={200}
                  placeholder="Đại học Công nghệ Thông tin"
                />
              </label>
              <label>
                Ngành học / Chuyên môn
                <input
                  value={form.major}
                  onChange={(e) => field("major", e.target.value)}
                  maxLength={160}
                  placeholder="Kỹ thuật phần mềm"
                />
              </label>
              {user.role === "student" && (
                <>
                  <label>
                    Năm học
                    <select
                      aria-label="Năm học"
                      value={form.year}
                      onChange={(e) => field("year", e.target.value)}
                    >
                      <option value="">Chưa cập nhật</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => (
                        <option value={y} key={y}>
                          Năm {y}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    GPA (thang 4.0)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="4"
                      value={form.gpa}
                      onChange={(e) => field("gpa", e.target.value)}
                      placeholder="3.50"
                    />
                  </label>
                </>
              )}
              <label>
                Website / GitHub / Portfolio
                <input
                  type="url"
                  maxLength={500}
                  value={form.website}
                  onChange={(e) => field("website", e.target.value)}
                  placeholder="https://github.com/username"
                />
              </label>
            </div>
            <label>
              Giới thiệu bản thân
              <textarea
                rows={4}
                maxLength={4000}
                value={form.bio}
                onChange={(e) => field("bio", e.target.value)}
                placeholder="Điều gì khiến bạn muốn làm nghiên cứu? Hãy kể về một dự án hoặc mục tiêu bạn đang theo đuổi."
              />
            </label>
            <div className="form-rule" />
            <div className="section-title">
              <div>
                <h2>Kỹ năng & định hướng</h2>
                <p>Phân cách các mục bằng dấu phẩy.</p>
              </div>
              <span className="form-section-number">02</span>
            </div>
            <label>
              Kỹ năng hiện có
              <input
                value={form.skills}
                onChange={(e) => field("skills", e.target.value)}
                maxLength={2000}
                placeholder="Python, ReactJS, PyTorch, SQL"
              />
            </label>
            <label>
              Chủ đề nghiên cứu quan tâm
              <input
                value={form.interests}
                onChange={(e) => field("interests", e.target.value)}
                maxLength={2000}
                placeholder="NLP, Computer Vision, Software Engineering"
              />
            </label>
            <div className="consent-box">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.consent_ai}
                  onChange={(e) => field("consent_ai", e.target.checked)}
                />
                <span>
                  Cho phép sử dụng hồ sơ tóm tắt với dịch vụ AI bên ngoài
                </span>
              </label>
              <p>
                Khi bật chế độ OpenAI, GPA, kỹ năng, định hướng và điều kiện tìm
                kiếm đã trích xuất có thể được gửi để tạo embedding và xếp hạng.
                Tên, email, phần giới thiệu, nội dung chat nguyên văn, CV và
                bảng điểm không được gửi. Thông tin nghiên cứu công khai của lab
                có thể được dùng. Bạn có thể tắt lựa chọn này; tìm kiếm cục bộ
                vẫn hoạt động.
              </p>
            </div>
            {error && <Notice error>{error}</Notice>}
            <div className="form-actions">
              <span className="muted small-text">
                Hãy kiểm tra thông tin trước khi nộp hồ sơ.
              </span>
              <button disabled={busy} className="button primary">
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Save size={17} />
                )}
                Lưu thay đổi
              </button>
            </div>
          </form>
          {user.role === "student" && (
            <section className="panel form-panel">
              <div className="section-title">
                <div>
                  <h2>CV & bảng điểm</h2>
                  <p>Tài liệu PDF, tối đa 5 MB mỗi tệp.</p>
                </div>
                <span className="form-section-number">03</span>
              </div>
              <label>
                Loại tài liệu
                <select
                  value={fileKind}
                  onChange={(e) => setFileKind(e.target.value)}
                >
                  <option value="cv">CV cá nhân</option>
                  <option value="transcript">Bảng điểm</option>
                </select>
              </label>
              <label className={`upload-zone ${uploading ? "uploading" : ""}`}>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void upload(file);
                    e.target.value = "";
                  }}
                />
                {uploading ? (
                  <LoaderCircle className="spin" size={30} />
                ) : (
                  <Upload size={30} strokeWidth={1.4} />
                )}
                <strong>
                  {uploading
                    ? "Đang đọc và lưu tài liệu…"
                    : "Chọn một tài liệu PDF"}
                </strong>
                <span>Chọn tệp từ thiết bị của bạn · tối đa 5 MB</span>
              </label>
              <div className="document-list">
                {user.documents?.map((d) => (
                  <div className="document-row" key={d.id}>
                    <div className="document-icon">
                      <FileText size={22} />
                    </div>
                    <div>
                      <strong>{d.filename}</strong>
                      <small>
                        {d.kind === "cv" ? "CV cá nhân" : "Bảng điểm"} · PDF
                      </small>
                    </div>
                    <a
                      className="icon-button"
                      href={`/api/documents/${d.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Tải xuống ${d.filename}`}
                    >
                      <Download size={17} />
                    </a>
                    <button
                      className="icon-button delete-button"
                      onClick={() => void remove(d.id)}
                      aria-label={`Xóa ${d.filename}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
              <Notice>
                Tài liệu chỉ được chia sẻ với lab nhận hồ sơ. Tệp tải lên sau
                khi ứng tuyển sẽ không tự thêm vào hồ sơ cũ.
              </Notice>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
