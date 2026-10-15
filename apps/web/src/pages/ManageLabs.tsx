import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  FlaskConical,
  ArrowUpRight,
  BookOpen,
  Globe,
  Sparkles,
  LoaderCircle,
  Check,
  Link2,
  Save,
} from "lucide-react";
import { useApp } from "../App";
import { api, json, errorMessage } from "../api";
import type { Lab, ImportPreview } from "../types";
import { Modal, Tags, Notice, Empty } from "../components/ui";

const emptyForm = {
  name: "",
  summary: "",
  description: "",
  topics: "",
  skills: "",
  min_gpa: "2.5",
  capacity: "5",
  location: "UIT · TP. Hồ Chí Minh",
  website: "",
  is_open: true,
};
const tags = (s: string) => [
  ...new Set(
    s
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  ),
];
export function ManageLabs() {
  const { user, labs, refresh, notify } = useApp();
  const owned = labs.filter((l) => l.owner_id === user.id);
  const [editing, setEditing] = useState<Lab | null | undefined>(undefined),
    [form, setForm] = useState(emptyForm),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [research, setResearch] = useState<Lab | null>(null),
    [researchTab, setResearchTab] = useState("manual"),
    [importUrl, setImportUrl] = useState(""),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [savedImports, setSavedImports] = useState<number[]>([]);
  useEffect(() => {
    if (editing === undefined) return;
    setError("");
    setForm(
      editing
        ? {
            name: editing.name,
            summary: editing.summary,
            description: editing.description,
            topics: editing.topics.join(", "),
            skills: editing.skills.join(", "),
            min_gpa: String(editing.min_gpa),
            capacity: String(editing.capacity),
            location: editing.location,
            website: editing.website || "",
            is_open: editing.is_open,
          }
        : emptyForm,
    );
  }, [editing]);
  const field = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api(
        editing ? `/labs/${editing.id}` : "/labs",
        json(editing ? "PATCH" : "POST", {
          ...form,
          topics: tags(form.topics),
          skills: tags(form.skills),
          min_gpa: Number(form.min_gpa),
          capacity: Number(form.capacity),
        }),
      );
      await refresh();
      setEditing(undefined);
      notify(editing ? "Đã cập nhật phòng lab." : "Đã tạo phòng lab mới.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const classify = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ topics: string[]; keywords: string[] }>(
        "/ai/classify",
        json("POST", {
          text: `${form.name} ${form.summary} ${form.description}`,
        }),
      );
      field("topics", data.topics.join(", "));
      notify("Đã gợi ý chủ đề. Hãy kiểm tra và chỉnh sửa trước khi lưu.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const openResearch = (lab: Lab) => {
    setResearch(lab);
    setError("");
    setPreview(null);
    setImportUrl("");
    setSavedImports([]);
    setResearchTab("manual");
  };
  const addPublication = async (
    values: Record<string, FormDataEntryValue>,
    formElement: HTMLFormElement,
  ) => {
    if (!research) return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/labs/${research.id}/publications`,
        json("POST", {
          title: values.title,
          abstract: values.abstract,
          url: values.url,
          year: values.year ? Number(values.year) : null,
        }),
      );
      await refresh();
      formElement.reset();
      notify("Đã thêm công trình nghiên cứu.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const crawl = async () => {
    if (!research) return;
    setBusy(true);
    setError("");
    setPreview(null);
    setSavedImports([]);
    try {
      setPreview(
        await api<ImportPreview>(
          "/ai/import",
          json("POST", { lab_id: research.id, url: importUrl }),
        ),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const confirmImport = async (index: number) => {
    if (!research || !preview) return;
    const p = preview.publications[index];
    setBusy(true);
    setError("");
    try {
      await api(
        "/ai/import/confirm",
        json("POST", {
          lab_id: research.id,
          source_url: preview.source_url,
          title: p.title,
          abstract: p.abstract || preview.summary || "",
          year: p.year || null,
        }),
      );
      setSavedImports((v) => [...v, index]);
      await refresh();
      notify("Đã xác nhận và lưu công trình từ nguồn tham chiếu.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">KHÔNG GIAN CHO NHỮNG Ý TƯỞNG</div>
          <h1>
            Phòng lab của tôi<span className="heading-dot">.</span>
          </h1>
          <p>Giới thiệu hướng nghiên cứu và chào đón những cộng sự mới.</p>
        </div>
        <button className="button primary" onClick={() => setEditing(null)}>
          <Plus size={18} />
          Tạo phòng lab
        </button>
      </div>
      {owned.length ? (
        <div className="manage-grid">
          {owned.map((l) => (
            <article key={l.id} className="panel manage-card">
              <div className="manage-card-top">
                <div className={`lab-icon tone-${l.id % 4}`}>
                  <FlaskConical size={27} />
                </div>
                <span className={`open-label ${!l.is_open ? "closed" : ""}`}>
                  <i />
                  {l.is_open ? "Đang tuyển" : "Tạm ngừng tuyển"}
                </span>
              </div>
              <h2>{l.name}</h2>
              <p>{l.summary}</p>
              <Tags values={l.topics} />
              <div className="manage-numbers">
                <div>
                  <strong>{l.capacity}</strong>
                  <span>Vị trí tuyển</span>
                </div>
                <div>
                  <strong>{l.min_gpa.toFixed(1)}</strong>
                  <span>GPA tối thiểu</span>
                </div>
                <div>
                  <strong>{l.publication_count}</strong>
                  <span>Công trình</span>
                </div>
              </div>
              <div className="manage-actions">
                <button
                  className="button secondary small"
                  onClick={() => setEditing(l)}
                >
                  <Pencil size={15} />
                  Chỉnh sửa
                </button>
                <button
                  className="button secondary small"
                  onClick={() => openResearch(l)}
                >
                  <BookOpen size={15} />
                  Thêm nghiên cứu
                </button>
                <a
                  className="icon-button"
                  href={`/explore?lab=${l.id}`}
                  aria-label={`Xem ${l.name}`}
                >
                  <ArrowUpRight size={19} />
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Phòng lab đầu tiên bắt đầu từ bạn"
          text="Thêm hướng nghiên cứu, kỹ năng mong đợi và công trình để sinh viên tìm thấy bạn."
          action={
            <button className="button primary" onClick={() => setEditing(null)}>
              Tạo phòng lab
              <Plus size={16} />
            </button>
          }
        />
      )}
      {editing !== undefined && (
        <Modal
          title={
            editing ? "Chỉnh sửa phòng lab" : "Tạo một không gian nghiên cứu"
          }
          subtitle="Thông tin này hiển thị cho thành viên trong hệ thống."
          wide
          onClose={() => setEditing(undefined)}
        >
          <form
            className="modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label>
              Tên phòng lab
              <input
                required
                minLength={3}
                maxLength={160}
                value={form.name}
                onChange={(e) => field("name", e.target.value)}
                placeholder="Human-centered AI Lab"
              />
            </label>
            <label>
              Giới thiệu ngắn
              <textarea
                required
                maxLength={500}
                rows={2}
                value={form.summary}
                onChange={(e) => field("summary", e.target.value)}
                placeholder="Một câu chuyện ngắn giúp sinh viên hiểu lab của bạn."
              />
            </label>
            <label>
              Mô tả & hướng nghiên cứu
              <textarea
                rows={5}
                maxLength={12000}
                value={form.description}
                onChange={(e) => field("description", e.target.value)}
              />
            </label>
            <div className="label-action">
              <span>Chủ đề nghiên cứu (phân cách bằng dấu phẩy)</span>
              <button
                type="button"
                className="text-button"
                disabled={busy || !form.summary}
                onClick={() => void classify()}
              >
                <Sparkles size={14} />
                Gợi ý tự động
              </button>
            </div>
            <input
              aria-label="Chủ đề nghiên cứu"
              value={form.topics}
              onChange={(e) => field("topics", e.target.value)}
              placeholder="NLP, AI, Human-Computer Interaction"
            />
            <label>
              Kỹ năng mong đợi
              <input
                value={form.skills}
                onChange={(e) => field("skills", e.target.value)}
                placeholder="Python, PyTorch, React"
              />
            </label>
            <div className="form-grid">
              <label>
                GPA tối thiểu (thang 4)
                <input
                  type="number"
                  min="0"
                  max="4"
                  step="0.1"
                  required
                  value={form.min_gpa}
                  onChange={(e) => field("min_gpa", e.target.value)}
                />
              </label>
              <label>
                Số vị trí tuyển
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={form.capacity}
                  onChange={(e) => field("capacity", e.target.value)}
                />
              </label>
              <label>
                Địa điểm
                <input
                  maxLength={200}
                  value={form.location}
                  onChange={(e) => field("location", e.target.value)}
                />
              </label>
              <label>
                Website
                <input
                  type="url"
                  maxLength={500}
                  value={form.website}
                  onChange={(e) => field("website", e.target.value)}
                  placeholder="https://…"
                />
              </label>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.is_open}
                onChange={(e) => field("is_open", e.target.checked)}
              />
              Đang nhận hồ sơ ứng tuyển
            </label>
            {error && <Notice error>{error}</Notice>}
            <div className="form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditing(undefined)}
              >
                Hủy
              </button>
              <button disabled={busy} className="button primary">
                {busy ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Save size={16} />
                )}
                Lưu phòng lab
              </button>
            </div>
          </form>
        </Modal>
      )}
      {research && (
        <Modal
          title="Bổ sung công trình nghiên cứu"
          subtitle={research.name}
          wide
          onClose={() => setResearch(null)}
        >
          <div className="modal-form">
            <div className="segmented">
              <button
                className={researchTab === "manual" ? "active" : ""}
                onClick={() => {
                  setResearchTab("manual");
                  setError("");
                }}
              >
                <Pencil size={15} />
                Nhập thủ công
              </button>
              <button
                className={researchTab === "import" ? "active" : ""}
                onClick={() => {
                  setResearchTab("import");
                  setError("");
                }}
              >
                <Globe size={15} />
                Nhập từ website trường
              </button>
            </div>
            {researchTab === "manual" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const el = e.currentTarget;
                  void addPublication(Object.fromEntries(new FormData(el)), el);
                }}
              >
                <label>
                  Tên công trình
                  <input name="title" required minLength={3} maxLength={500} />
                </label>
                <label>
                  Tóm tắt
                  <textarea name="abstract" rows={5} maxLength={12000} />
                </label>
                <div className="form-grid">
                  <label>
                    Nguồn tham chiếu
                    <input
                      type="url"
                      name="url"
                      maxLength={1000}
                      placeholder="https://…"
                    />
                  </label>
                  <label>
                    Năm xuất bản
                    <input
                      name="year"
                      type="number"
                      min="1950"
                      max="2100"
                      defaultValue="2026"
                    />
                  </label>
                </div>
                <button className="button primary" disabled={busy}>
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Thêm công trình
                </button>
              </form>
            ) : (
              <>
                <Notice>
                  Nhập trang HTTPS công khai thuộc tên miền được cho phép (mặc
                  định uit.edu.vn). Hệ thống kiểm tra robots.txt. Với Google
                  Scholar, hãy nhập thủ công tên bài và đường dẫn nguồn.
                </Notice>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void crawl();
                  }}
                >
                  <label>
                    URL trang giảng viên / công trình
                    <div className="input-with-icon">
                      <Link2 size={17} />
                      <input
                        type="url"
                        required
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="https://…uit.edu.vn/…"
                      />
                    </div>
                  </label>
                  <button className="button primary" disabled={busy}>
                    {busy ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <Globe size={16} />
                    )}
                    Đọc & xem trước
                  </button>
                </form>
                {preview && (
                  <div className="import-preview">
                    <span className="eyebrow">KIỂM TRA TRƯỚC KHI LƯU</span>
                    <h3>{preview.title}</h3>
                    <p>{preview.summary}</p>
                    <Tags values={preview.topics} />
                    {preview.warning && <Notice>{preview.warning}</Notice>}
                    <div className="publications">
                      {preview.publications.map((p, i) => (
                        <article key={i}>
                          <h4>{p.title}</h4>
                          <p>{p.abstract}</p>
                          <button
                            className={`button small ${savedImports.includes(i) ? "secondary" : "primary"}`}
                            disabled={busy || savedImports.includes(i)}
                            onClick={() => void confirmImport(i)}
                          >
                            {savedImports.includes(i) ? (
                              <>
                                <Check size={15} />
                                Đã lưu
                              </>
                            ) : (
                              <>
                                <Plus size={15} />
                                Xác nhận & lưu
                              </>
                            )}
                          </button>
                        </article>
                      ))}
                    </div>
                    {!preview.publications.length && (
                      <Notice>
                        Chưa trích xuất được công trình riêng. Bạn có thể chuyển
                        sang nhập thủ công và giữ đường dẫn nguồn.
                      </Notice>
                    )}
                  </div>
                )}
              </>
            )}
            {error && <Notice error>{error}</Notice>}
          </div>
        </Modal>
      )}
    </div>
  );
}
