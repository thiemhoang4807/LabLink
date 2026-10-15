import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  LoaderCircle,
  CircleCheck,
  CircleAlert,
  SearchX,
  ArrowUpRight,
  FlaskConical,
  Bookmark,
  MapPin,
  Users,
  Sparkles,
} from "lucide-react";
import type { ApplicationStatus, Lab, Match } from "../types";

export const statusLabel: Record<ApplicationStatus, string> = {
  submitted: "Đã nộp",
  reviewing: "Đang duyệt CV",
  interview: "Phỏng vấn",
  accepted: "Đã chấp nhận",
  rejected: "Chưa phù hợp",
  withdrawn: "Đã rút",
};
export const dateLabel = (value: string) =>
  new Date(
    value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value) ? value : value + "Z",
  ).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
export const initials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export function Status({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`status status-${status}`}>
      <i />
      {statusLabel[status]}
    </span>
  );
}
export function Spinner({ label = "Đang tải dữ liệu…" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={23} />
      <span>{label}</span>
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <SearchX size={28} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? "notice-error" : ""}`}
      role={error ? "alert" : undefined}
    >
      {error ? <CircleAlert size={18} /> : <CircleCheck size={18} />}
      <div>{children}</div>
    </div>
  );
}
export function Tags({
  values,
  limit = 20,
}: {
  values?: string[];
  limit?: number;
}) {
  return (
    <div className="tags">
      {(values || []).slice(0, limit).map((v) => (
        <span className="tag" key={v}>
          {v}
        </span>
      ))}
      {(values?.length || 0) > limit && (
        <span className="tag">+{values!.length - limit}</span>
      )}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
        );
        if (!nodes?.length) return;
        if (
          e.shiftKey &&
          (document.activeElement === nodes[0] ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          nodes[nodes.length - 1].focus();
        } else if (
          !e.shiftKey &&
          document.activeElement === nodes[nodes.length - 1]
        ) {
          e.preventDefault();
          nodes[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "modal-wide" : ""}`}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" aria-label="Đóng" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function LabCard({
  lab,
  match,
  saved,
  onSave,
  onOpen,
  index = 0,
}: {
  lab: Lab;
  match?: Match;
  saved?: boolean;
  onSave?: () => void;
  onOpen: () => void;
  index?: number;
}) {
  return (
    <article className="lab-card" style={{ animationDelay: `${index * 45}ms` }}>
      <div className="lab-card-top">
        <div className={`lab-icon tone-${lab.id % 4}`}>
          <FlaskConical size={25} strokeWidth={1.6} />
        </div>
        {onSave && (
          <button
            className={`icon-button bookmark ${saved ? "is-saved" : ""}`}
            onClick={onSave}
            aria-label={saved ? `Bỏ lưu ${lab.name}` : `Lưu ${lab.name}`}
            aria-pressed={!!saved}
          >
            <Bookmark size={19} fill={saved ? "currentColor" : "none"} />
          </button>
        )}
      </div>
      <div className="lab-eyebrow">
        {lab.topics[0] || "Nghiên cứu liên ngành"}
      </div>
      <button className="card-title" onClick={onOpen}>
        <h3>{lab.name}</h3>
        <ArrowUpRight size={20} />
      </button>
      <p className="lab-supervisor">{lab.lecturer_name}</p>
      <p className="lab-summary">{lab.summary}</p>
      <Tags values={lab.skills} limit={3} />
      <div className="lab-meta">
        <span>
          <MapPin size={14} />
          {lab.location || "Chưa cập nhật"}
        </span>
        <span>
          <Users size={14} />
          {lab.capacity} vị trí
        </span>
      </div>
      <div className="lab-card-footer">
        <span className={`open-label ${!lab.is_open ? "closed" : ""}`}>
          <i />
          {lab.is_open ? "Đang tuyển thành viên" : "Tạm ngừng tuyển"}
        </span>
        {match && (
          <span
            className="match-score"
            title="Điểm gợi ý tương đối, không phải xác suất trúng tuyển"
          >
            <Sparkles size={13} />
            {Math.round(match.score)}%
            phù hợp
          </span>
        )}
      </div>
    </article>
  );
}
