import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  FlaskConical,
  MapPin,
  Users,
  BookOpen,
  Sparkles,
  Check,
  LoaderCircle,
  ArrowRight,
  Bookmark,
} from "lucide-react";
import { useApp } from "../App";
import { api, json, errorMessage } from "../api";
import type { Lab } from "../types";
import { LabCard, Modal, Tags, Notice, Empty, Spinner } from "../components/ui";

export function Explore() {
  const {
    user,
    labs,
    matches,
    favorites,
    toggleFavorite,
    applications,
    refresh,
    notify,
  } = useApp();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(""),
    [topic, setTopic] = useState("Tất cả"),
    [openOnly, setOpenOnly] = useState(false),
    [savedOnly, setSavedOnly] = useState(false),
    [sort, setSort] = useState("match");
  const [detail, setDetail] = useState<Lab | null>(null),
    [loading, setLoading] = useState(false),
    [apply, setApply] = useState(false),
    [busy, setBusy] = useState(false),
    [letter, setLetter] = useState(""),
    [error, setError] = useState("");
  const labId = params.get("lab");
  useEffect(() => {
    let valid = true;
    setDetail(null);
    setApply(false);
    setError("");
    setLoading(!!labId);
    if (labId) {
      void api<Lab>(`/labs/${labId}`)
        .then((l) => {
          if (valid) setDetail(l);
        })
        .catch((e) => {
          if (valid) {
            notify(errorMessage(e), true);
            setParams({});
          }
        })
        .finally(() => {
          if (valid) setLoading(false);
        });
    }
    return () => {
      valid = false;
    };
  }, [labId, notify, setParams]);
  const topics = ["Tất cả", ...new Set(labs.flatMap((l) => l.topics))];
  const filtered = useMemo(
    () =>
      labs
        .filter(
          (l) =>
            (!openOnly || l.is_open) &&
            (!savedOnly || favorites.includes(l.id)) &&
            (topic === "Tất cả" || l.topics.includes(topic)) &&
            `${l.name} ${l.lecturer_name} ${l.summary} ${l.skills.join(" ")} ${l.topics.join(" ")}`
              .toLocaleLowerCase("vi")
              .includes(search.toLocaleLowerCase("vi")),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name)
            : sort === "gpa"
              ? a.min_gpa - b.min_gpa
              : (matches.find((m) => m.lab_id === b.id)?.score || 0) -
                (matches.find((m) => m.lab_id === a.id)?.score || 0),
        ),
    [labs, openOnly, savedOnly, favorites, topic, search, sort, matches],
  );
  const sendApplication = async () => {
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      await api(
        "/applications",
        json("POST", { lab_id: detail.id, cover_letter: letter }),
      );
      await refresh();
      setApply(false);
      notify("Đã gửi hồ sơ. Bạn có thể theo dõi tiến trình tại mục Ứng tuyển.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const match = detail
    ? matches.find((m) => m.lab_id === detail.id)
    : undefined;
  const existing =
    detail &&
    applications.some(
      (a) =>
        a.lab_id === detail.id && !["withdrawn", "rejected"].includes(a.status),
    );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">KẾT NỐI VỚI ĐIỀU BẠN QUAN TÂM</div>
          <h1>
            Khám phá phòng lab<span className="heading-dot">.</span>
          </h1>
          <p>Một không gian phù hợp có thể mở ra nhiều khả năng.</p>
        </div>
        <Link className="button secondary" to="/assistant">
          <Sparkles size={17} />
          Nhờ trợ lý tìm giúp
        </Link>
      </div>
      <div className="explore-search">
        <Search size={21} />
        <input
          aria-label="Tìm tên lab, giảng viên hoặc kỹ năng"
          placeholder="Tìm theo tên lab, giảng viên, kỹ năng hoặc chủ đề…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="search-filter-icon">
          <SlidersHorizontal size={19} />
        </span>
      </div>
      <div className="topic-tabs" role="group" aria-label="Chủ đề nghiên cứu">
        {topics.map((t) => (
          <button
            key={t}
            className={topic === t ? "active" : ""}
            onClick={() => setTopic(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="explore-toolbar">
        <p>
          <strong>{filtered.length}</strong> phòng lab{" "}
          <span>đang chờ bạn khám phá</span>
        </p>
        <div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => setOpenOnly(e.target.checked)}
            />
            Đang tuyển
          </label>
          <button
            className={`button small ${savedOnly ? "primary" : "secondary"}`}
            onClick={() => setSavedOnly(!savedOnly)}
            aria-pressed={savedOnly}
          >
            <Bookmark size={15} />
            Đã lưu
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sắp xếp phòng lab"
          >
            <option value="match">Phù hợp với bạn</option>
            <option value="name">Tên A–Z</option>
            <option value="gpa">GPA yêu cầu tăng dần</option>
          </select>
        </div>
      </div>
      <div className="lab-grid explore-grid">
        {filtered.map((lab, i) => (
          <LabCard
            key={lab.id}
            lab={lab}
            index={i}
            match={matches.find((m) => m.lab_id === lab.id)}
            saved={favorites.includes(lab.id)}
            onSave={() => toggleFavorite(lab.id)}
            onOpen={() => setParams({ lab: String(lab.id) })}
          />
        ))}
      </div>
      {!filtered.length && (
        <Empty
          title="Chưa tìm thấy kết nối phù hợp"
          text="Thử một từ khóa khác hoặc mở rộng bộ lọc chủ đề."
          action={
            <button
              className="button secondary"
              onClick={() => {
                setSearch("");
                setTopic("Tất cả");
                setOpenOnly(false);
                setSavedOnly(false);
              }}
            >
              Đặt lại bộ lọc
            </button>
          }
        />
      )}
      <p className="data-footnote">
        Thông tin trong bản demo là giả lập. Điểm phù hợp là gợi ý dựa trên hồ
        sơ, không phải xác suất được nhận.
      </p>
      {(detail || loading) && (
        <Modal
          title={detail?.name || "Đang mở phòng lab"}
          subtitle={detail?.lecturer_name}
          wide
          onClose={() => setParams({})}
        >
          {loading ? (
            <Spinner />
          ) : (
            detail && (
              <>
                <div className="lab-detail-banner">
                  <div className={`lab-icon large tone-${detail.id % 4}`}>
                    <FlaskConical size={36} />
                  </div>
                  <div>
                    <Tags values={detail.topics} />
                    <div className="lab-meta">
                      <span>
                        <MapPin size={15} />
                        {detail.location}
                      </span>
                      <span>
                        <Users size={15} />
                        {detail.capacity} vị trí
                      </span>
                      <span>GPA tối thiểu {detail.min_gpa.toFixed(1)}/4.0</span>
                    </div>
                  </div>
                </div>
                <div className="detail-sections">
                  <section>
                    <h3>Không gian nghiên cứu</h3>
                    <p className="preserve-lines">
                      {detail.description || detail.summary}
                    </p>
                  </section>
                  <section>
                    <h3>Kỹ năng phù hợp</h3>
                    <Tags values={detail.skills} />
                  </section>
                  {match && (
                    <section className="match-explanation">
                      <h3>
                        <Sparkles size={17} />
                        Vì sao lab này phù hợp?
                      </h3>
                      {match.reasons.map((r, i) => (
                        <p key={i}>
                          <Check size={15} />
                          {r}
                        </p>
                      ))}
                      {match.gaps.map((g, i) => (
                        <small key={i}>{g}</small>
                      ))}
                    </section>
                  )}
                  <section>
                    <h3>
                      <BookOpen size={18} />
                      Công trình nghiên cứu ({detail.publications?.length || 0})
                    </h3>
                    {detail.publications?.length ? (
                      <div className="publications">
                        {detail.publications.map((p) => (
                          <article key={p.id}>
                            <span>{p.year || "Nghiên cứu"}</span>
                            <h4>{p.title}</h4>
                            {p.abstract && <p>{p.abstract}</p>}
                            {p.url && /^https?:\/\//.test(p.url) && (
                              <a href={p.url} target="_blank" rel="noreferrer">
                                Xem nguồn
                                <ArrowUpRight size={14} />
                              </a>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">
                        Giảng viên chưa bổ sung công trình công khai.
                      </p>
                    )}
                  </section>
                  {detail.website && /^https?:\/\//.test(detail.website) && (
                    <a
                      className="text-link"
                      href={detail.website}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Website phòng lab
                      <ArrowUpRight size={16} />
                    </a>
                  )}
                </div>
                {user.role === "student" && (
                  <div className="detail-apply">
                    {existing ? (
                      <Notice>
                        Bạn đã ứng tuyển vào lab này.{" "}
                        <Link to="/applications">Theo dõi hồ sơ →</Link>
                      </Notice>
                    ) : !detail.is_open ? (
                      <Notice>Phòng lab hiện tạm ngừng nhận hồ sơ.</Notice>
                    ) : apply ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void sendApplication();
                        }}
                      >
                        <label>
                          Lời giới thiệu với giảng viên
                          <textarea
                            value={letter}
                            onChange={(e) => setLetter(e.target.value)}
                            minLength={20}
                            maxLength={5000}
                            rows={5}
                            required
                            placeholder="Bạn quan tâm hướng nghiên cứu nào? Kinh nghiệm hoặc dự án nào bạn muốn chia sẻ? (ít nhất 20 ký tự)"
                          />
                        </label>
                        <p className="muted small-text">
                          CV và bảng điểm hiện có sẽ được đính kèm hồ sơ. Giảng
                          viên của lab này có thể xem các tài liệu đó.
                        </p>
                        {error && <Notice error>{error}</Notice>}
                        <div className="form-actions">
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => setApply(false)}
                          >
                            Quay lại
                          </button>
                          <button className="button primary" disabled={busy}>
                            {busy && (
                              <LoaderCircle className="spin" size={16} />
                            )}
                            Gửi hồ sơ
                            <ArrowRight size={17} />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="apply-row">
                        <div>
                          <strong>Sẵn sàng cho hành trình mới?</strong>
                          <small>
                            Chia sẻ câu chuyện của bạn với giảng viên.
                          </small>
                        </div>
                        <button
                          className="button primary"
                          onClick={() => setApply(true)}
                        >
                          Ứng tuyển vào lab
                          <ArrowUpRight size={17} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          )}
        </Modal>
      )}
    </div>
  );
}
