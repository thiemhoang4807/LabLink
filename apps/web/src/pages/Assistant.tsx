import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  ArrowUp,
  Plus,
  ArrowUpRight,
  BookOpen,
  ShieldCheck,
  LoaderCircle,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { useApp } from "../App";
import { api, json, errorMessage } from "../api";
import type { ChatReply } from "../types";
import { initials, Notice } from "../components/ui";
const modeLabels: Record<string, string> = {
  local: "Truy xuất cục bộ · vector + từ khóa",
  local_fallback: "Truy xuất cục bộ · dịch vụ AI chưa sẵn sàng",
  openai: "OpenAI embedding + LLM xếp hạng",
  openai_embeddings: "OpenAI embedding · xếp hạng cục bộ",
};
const safeSourceUrl = (url?: string) =>
  url &&
  (/^https?:\/\//.test(url) || /^\/api\/documents\/\d+\/download$/.test(url));

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  reply?: ChatReply;
  error?: boolean;
}
export function Assistant() {
  const { user } = useApp();
  const lecturer = user.role === "lecturer";
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);
  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const reply = await api<ChatReply>(
        "/ai/chat",
        json("POST", { message: text }),
      );
      setMessages((m) => [
        ...m,
        { role: "assistant", content: reply.answer, reply },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: errorMessage(e), error: true },
      ]);
    } finally {
      setBusy(false);
    }
  };
  const prompts = lecturer
    ? [
        "Tìm sinh viên có kỹ năng ReactJS, GPA > 3.2 và muốn làm về AI",
        "Ai có kinh nghiệm Python và quan tâm NLP?",
        "Tìm ứng viên có kỹ năng Computer Vision",
      ]
    : [
        "Tìm lab về AI phù hợp với kỹ năng của tôi",
        "Tôi muốn nghiên cứu NLP và có kỹ năng Python",
        "Lab nào nghiên cứu Software Engineering?",
      ];
  return (
    <div className="page assistant-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">TỪ MỘT CÂU HỎI, ĐẾN MỘT KẾT NỐI</div>
          <h1>
            Trợ lý nghiên cứu<span className="heading-dot">.</span>
          </h1>
          <p>Khám phá dữ liệu bằng ngôn ngữ của bạn.</p>
        </div>
        <button
          className="button secondary"
          disabled={busy || !messages.length}
          onClick={() => setMessages([])}
        >
          <Plus size={17} />
          Cuộc trò chuyện mới
        </button>
      </div>
      <div className="assistant-layout">
        <section className="chat-panel">
          <div className="chat-panel-header">
            <div>
              <span className="assistant-avatar">
                <Sparkles size={19} />
              </span>
              <div>
                <strong>LabLink Assistant</strong>
                <span>Tra cứu có nguồn tham chiếu</span>
              </div>
            </div>
            <span className="online-chip">
              <i />
              Sẵn sàng hỗ trợ
            </span>
          </div>
          <div
            className={`chat-messages ${!messages.length ? "chat-initial" : ""}`}
          >
            {!messages.length ? (
              <div className="chat-welcome">
                <span className="chat-welcome-icon">
                  <Sparkles size={32} strokeWidth={1.4} />
                </span>
                <span className="eyebrow">
                  CHÀO {user.name.split(" ").slice(-1)[0].toUpperCase()}
                </span>
                <h2>
                  {lecturer ? (
                    <>
                      Cộng sự tiếp theo của bạn
                      <br />
                      có thể đang ở đây.
                    </>
                  ) : (
                    <>
                      Bạn muốn khám phá
                      <br />
                      điều gì hôm nay?
                    </>
                  )}
                </h2>
                <p>
                  {lecturer
                    ? "Hỏi về kỹ năng, GPA và định hướng của ứng viên trong lab."
                    : "Mô tả điều bạn quan tâm, mình sẽ tìm trong dữ liệu phòng lab."}
                </p>
                <div className="prompt-list">
                  {prompts.map((p) => (
                    <button key={p} onClick={() => void send(p)}>
                      <MessageSquare size={16} />
                      <span>{p}</span>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <article
                  className={`chat-message ${m.role} ${m.error ? "chat-error" : ""}`}
                  key={i}
                >
                  <span
                    className={
                      m.role === "assistant" ? "assistant-avatar" : "avatar"
                    }
                  >
                    {m.role === "assistant" ? (
                      <Sparkles size={18} />
                    ) : (
                      initials(user.name)
                    )}
                  </span>
                  <div className="chat-message-content">
                    <strong>
                      {m.role === "assistant" ? "LabLink Assistant" : user.name}
                    </strong>
                    <div className="chat-text">{m.content}</div>
                    {m.reply && (
                      <>
                        <span className="retrieval-mode">
                          {modeLabels[m.reply.mode] || "Truy xuất dữ liệu"}
                        </span>
                        {m.reply.warning && <Notice>{m.reply.warning}</Notice>}
                        {m.reply.filters && (
                          <div className="filter-summary">
                            {JSON.stringify(m.reply.filters) !== "{}" && (
                              <span>
                                Điều kiện đã hiểu:{" "}
                                {Object.entries(m.reply.filters)
                                  .filter(
                                    ([, v]) =>
                                      v != null &&
                                      (!Array.isArray(v) || v.length > 0),
                                  )
                                  .map(
                                    ([k, v]) =>
                                      `${k === "skills" ? "kỹ năng" : k === "topics" ? "chủ đề" : k.toUpperCase()}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" ? Object.values(v as Record<string, unknown>).join(" ") : String(v)}`,
                                  )
                                  .join(" · ")}
                              </span>
                            )}
                          </div>
                        )}
                        {m.reply.sources?.length > 0 && (
                          <div className="chat-sources">
                            <small>
                              <BookOpen size={13} />
                              DỮ LIỆU THAM CHIẾU
                            </small>
                            {m.reply.sources.map((s, j) => (
                              <div className="source-card" key={`${s.id}-${j}`}>
                                <span>{j + 1}</span>
                                <div>
                                  {safeSourceUrl(s.url) ? (
                                    <a
                                      target="_blank"
                                      rel="noreferrer"
                                      href={s.url}
                                    >
                                      {s.title}
                                      <ArrowUpRight size={13} />
                                    </a>
                                  ) : s.type === "lab" && s.entity_id ? (
                                    <Link to={`/explore?lab=${s.entity_id}`}>
                                      {s.title}
                                      <ArrowUpRight size={13} />
                                    </Link>
                                  ) : (
                                    <strong>{s.title}</strong>
                                  )}
                                  {s.excerpt && <p>{s.excerpt}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </article>
              ))
            )}
            {busy && (
              <div className="chat-thinking" role="status">
                <Sparkles className="pulse" size={18} />
                <span>Đang đối chiếu dữ liệu phù hợp…</span>
                <LoaderCircle className="spin" size={16} />
              </div>
            )}
            <div ref={bottom} />
          </div>
          <div className="chat-composer-area">
            <form
              className="chat-composer"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <textarea
                aria-label="Nhập câu hỏi cho trợ lý nghiên cứu"
                rows={2}
                value={input}
                maxLength={2000}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  lecturer
                    ? "Ví dụ: Tìm sinh viên có ReactJS, GPA > 3.2 và thích AI…"
                    : "Ví dụ: Tôi biết Python và muốn nghiên cứu NLP…"
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
              />
              <button
                className="send-button"
                disabled={busy || !input.trim()}
                aria-label="Gửi câu hỏi"
              >
                {busy ? (
                  <LoaderCircle size={20} className="spin" />
                ) : (
                  <ArrowUp size={22} />
                )}
              </button>
            </form>
            <p>
              Enter để gửi · Shift + Enter để xuống dòng · Hãy kiểm tra nguồn
              trước khi quyết định.
            </p>
          </div>
        </section>
        <aside className="assistant-sidebar">
          <div className="assistant-info">
            <span className="info-icon">
              <BookOpen size={23} />
            </span>
            <h3>Đi từ dữ liệu thật.</h3>
            <p>
              Câu trả lời dựa trên hồ sơ và công trình đã được lưu trong hệ
              thống. Khi không tìm thấy, trợ lý sẽ thông báo rõ.
            </p>
            <div className="info-rule" />
            <h4>
              {lecturer
                ? "Không gian truy vấn của bạn"
                : "Mình có thể giúp bạn"}
            </h4>
            <ul>
              {lecturer ? (
                <>
                  <li>Tìm trong ứng viên của lab bạn</li>
                  <li>Lọc theo GPA và kỹ năng</li>
                  <li>Đối chiếu định hướng nghiên cứu</li>
                </>
              ) : (
                <>
                  <li>Tìm phòng lab theo chủ đề</li>
                  <li>Khám phá yêu cầu kỹ năng</li>
                  <li>Gợi ý từ hồ sơ của bạn</li>
                </>
              )}
            </ul>
          </div>
          <div className="assistant-privacy">
            <ShieldCheck size={22} />
            <h4>Bạn luôn là người quyết định.</h4>
            <p>
              AI hỗ trợ tìm kiếm và đối chiếu. Quyết định ứng tuyển hoặc tuyển
              chọn thuộc về sinh viên và giảng viên.
            </p>
            <Link to="/profile">
              Quản lý quyền dùng AI
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <button
            className="text-button"
            disabled={busy || !messages.length}
            onClick={() => {
              setMessages([]);
              setInput("");
            }}
          >
            <RotateCcw size={14} />
            Xóa cuộc trò chuyện trên màn hình
          </button>
        </aside>
      </div>
    </div>
  );
}
