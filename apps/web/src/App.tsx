import {
  useCallback,
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  Navigate,
  Link,
} from "react-router-dom";
import {
  LayoutDashboard,
  Compass,
  Layers3,
  Sparkles,
  UserRound,
  LogOut,
  ArrowUpRight,
  ArrowRight,
  Bell,
  Search,
  Menu,
  X,
  FlaskConical,
  ChevronDown,
  BookOpen,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import { api, json, errorMessage, ApiError } from "./api";
import type { User, Lab, Application, Match } from "./types";
import {
  Spinner,
  initials,
  Modal,
  Status,
  Empty,
  dateLabel,
} from "./components/ui";
import { Dashboard } from "./pages/Dashboard";
import { Explore } from "./pages/Explore";
import { Applications } from "./pages/Applications";
import { Assistant } from "./pages/Assistant";
import { Profile } from "./pages/Profile";
import { ManageLabs } from "./pages/ManageLabs";

interface AppData {
  user: User;
  labs: Lab[];
  applications: Application[];
  matches: Match[];
  refresh: () => Promise<void>;
  notify: (message: string, error?: boolean) => void;
  favorites: number[];
  toggleFavorite: (id: number) => void;
}
const DataContext = createContext<AppData | null>(null);
export const useApp = () => useContext(DataContext)!;

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]),
    [applications, setApplications] = useState<Application[]>([]),
    [matches, setMatches] = useState<Match[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const sessionVersion = useRef(0);
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  const boot = useCallback(async () => {
    setBooting(true);
    setBootError("");
    try {
      setUser((await api<{ user: User }>("/auth/me")).user);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401))
        setBootError(errorMessage(e));
    } finally {
      setBooting(false);
    }
  }, []);
  useEffect(() => {
    void boot();
  }, [boot]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const refresh = useCallback(async () => {
    const version = sessionVersion.current;
    const [u, l, a] = await Promise.all([
      api<User>("/profile"),
      api<Lab[]>("/labs"),
      api<Application[]>("/applications"),
    ]);
    if (version !== sessionVersion.current) return;
    setUser(u);
    setLabs(l);
    setApplications(a);
    if (u.role === "student") {
      try {
        const result = await api<Match[]>("/ai/matches");
        if (version === sessionVersion.current) setMatches(result);
      } catch {
        if (version === sessionVersion.current) setMatches([]);
      }
    }
  }, []);
  useEffect(() => {
    const expired = () => {
      sessionVersion.current++;
      setUser(null);
      setLabs([]);
      setApplications([]);
      setMatches([]);
      setFavorites([]);
    };
    window.addEventListener("lablink:unauthorized", expired);
    return () => window.removeEventListener("lablink:unauthorized", expired);
  }, []);
  useEffect(() => {
    if (user?.id) {
      void refresh().catch((e) => notify(errorMessage(e), true));
      try {
        const saved = JSON.parse(
          localStorage.getItem(`lablink-saved-${user.id}`) || "[]",
        );
        setFavorites(
          Array.isArray(saved)
            ? saved.filter((id): id is number => Number.isInteger(id) && id > 0)
            : [],
        );
      } catch {
        setFavorites([]);
      }
    }
  }, [user?.id, refresh, notify]);
  const toggleFavorite = (id: number) =>
    setFavorites((values) => {
      const next = values.includes(id)
        ? values.filter((x) => x !== id)
        : [...values, id];
      try {
        localStorage.setItem(`lablink-saved-${user?.id}`, JSON.stringify(next));
      } catch {
        /* Bookmarks remain available in memory. */
      }
      return next;
    });
  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
      sessionVersion.current++;
      setUser(null);
      setLabs([]);
      setApplications([]);
      setMatches([]);
      setFavorites([]);
    } catch (e) {
      notify(errorMessage(e), true);
    }
  };
  const login = (next: User) => {
    sessionVersion.current++;
    setUser(next);
  };
  return (
    <>
      {booting ? (
        <div className="boot">
          <Brand />
          <Spinner />
        </div>
      ) : !user ? (
        <Login onLogin={login} bootError={bootError} onRetry={boot} />
      ) : (
        <DataContext.Provider
          value={{
            user,
            labs,
            applications,
            matches,
            refresh,
            notify,
            favorites,
            toggleFavorite,
          }}
        >
          <Shell onLogout={logout}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/applications" element={<Applications />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/profile" element={<Profile />} />
              <Route
                path="/manage"
                element={
                  user.role === "lecturer" ? (
                    <ManageLabs />
                  ) : (
                    <Navigate to="/" />
                  )
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Shell>
        </DataContext.Provider>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role="status"
        >
          <span>{toast.message}</span>
          <button aria-label="Đóng thông báo" onClick={() => setToast(null)}>
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <i />
        <b>L</b>
      </span>
      <span>
        lablink<span className="brand-dot">.</span>
      </span>
    </div>
  );
}

function Login({
  onLogin,
  bootError,
  onRetry,
}: {
  onLogin: (u: User) => void;
  bootError: string;
  onRetry: () => void;
}) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const navigate = useNavigate();
  const submit = async (body: Record<string, string>, demo = false) => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ user: User }>(
        register && !demo ? "/auth/register" : "/auth/login",
        json("POST", body),
      );
      onLogin(result.user);
      navigate("/");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand />
        <div className="story-content">
          <span className="eyebrow light">MỘT Ý TƯỞNG. NHIỀU KHẢ NĂNG.</span>
          <h1>
            Nghiên cứu hay
            <br />
            bắt đầu từ một
            <br />
            <em>kết nối đúng.</em>
          </h1>
          <p>
            Tìm người hướng dẫn, khám phá phòng lab và đưa ý tưởng của bạn tiến
            xa hơn.
          </p>
          <div className="orbit-art" aria-hidden="true">
            <div className="orbit one" />
            <div className="orbit two" />
            <div className="orbit three" />
            <span className="orbit-node node-one">
              <FlaskConical size={24} />
            </span>
            <span className="orbit-node node-two">
              <BookOpen size={24} />
            </span>
            <span className="orbit-node node-three">
              <Sparkles size={24} />
            </span>
            <div className="orbit-center">
              <span>Ý TƯỞNG</span>
              <ArrowUpRight size={52} />
            </div>
          </div>
        </div>
        <div className="story-footer">
          <span>DỰ ÁN SINH VIÊN</span>
          <span>SEApp 2026 ↗</span>
        </div>
      </section>
      <section className="login-form-area">
        <div className="login-top">
          KHÔNG GIAN KẾT NỐI NGHIÊN CỨU <span>●</span>
        </div>
        <div className="login-form">
          <span className="eyebrow">CHÀO MỪNG ĐẾN LABLINK</span>
          <h2>{register ? "Bắt đầu hành trình." : "Chào bạn trở lại."}</h2>
          <p>
            {register
              ? "Tạo hồ sơ để khám phá cơ hội nghiên cứu phù hợp."
              : "Ý tưởng tiếp theo đang chờ bạn khám phá."}
          </p>
          {bootError && (
            <div className="notice notice-error">
              <div>
                {bootError}{" "}
                <button className="text-button" onClick={onRetry}>
                  Kết nối lại
                </button>
              </div>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = Object.fromEntries(
                new FormData(e.currentTarget),
              ) as Record<string, string>;
              void submit(data);
            }}
          >
            {register && (
              <label>
                Họ và tên
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Nguyễn Minh Anh"
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="ban@university.edu.vn"
              />
            </label>
            <label>
              Mật khẩu
              <input
                name="password"
                type="password"
                required
                minLength={register ? 10 : 1}
                maxLength={128}
                autoComplete={register ? "new-password" : "current-password"}
                placeholder={
                  register ? "Ít nhất 10 ký tự" : "Nhập mật khẩu của bạn"
                }
              />
            </label>
            {register && (
              <label>
                Bạn tham gia với vai trò
                <select name="role">
                  <option value="student">Sinh viên</option>
                  <option value="lecturer">Giảng viên / Quản lý lab</option>
                </select>
              </label>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy} className="button primary full">
              {busy ? <LoaderCircle size={18} className="spin" /> : null}
              {register ? "Tạo tài khoản" : "Đăng nhập"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="switch-auth">
            {register ? "Bạn đã có tài khoản?" : "Bạn chưa có tài khoản?"}{" "}
            <button
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
              className="text-button"
            >
              {register ? "Đăng nhập" : "Đăng ký ngay"}
            </button>
          </p>
          <div className="demo-divider">
            <span>KHÁM PHÁ BẢN DEMO</span>
          </div>
          <div className="demo-buttons">
            <button
              disabled={busy}
              className="button secondary"
              onClick={() =>
                void submit(
                  { email: "student@lablink.demo", password: "Demo@2026!" },
                  true,
                )
              }
            >
              <UserRound size={17} />
              Sinh viên
            </button>
            <button
              disabled={busy}
              className="button secondary"
              onClick={() =>
                void submit(
                  { email: "lecturer@lablink.demo", password: "Demo@2026!" },
                  true,
                )
              }
            >
              <FlaskConical size={17} />
              Giảng viên
            </button>
          </div>
          <p className="demo-note">
            Dữ liệu minh họa. Tài khoản demo dùng chung để trải nghiệm luồng ứng
            tuyển.
          </p>
        </div>
        <div className="login-bottom">
          <ShieldCheck size={15} />
          Quyền riêng tư là một phần của mọi kết nối.
        </div>
      </section>
    </div>
  );
}

function Shell({
  children,
  onLogout,
}: {
  children: ReactNode;
  onLogout: () => void;
}) {
  const { user, applications } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false),
    [notifications, setNotifications] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);
  const links = [
    { to: "/", icon: LayoutDashboard, label: "Tổng quan", exact: true },
    { to: "/explore", icon: Compass, label: "Khám phá phòng lab" },
    {
      to: "/applications",
      icon: Layers3,
      label: user.role === "lecturer" ? "Quản lý ứng tuyển" : "Hồ sơ ứng tuyển",
    },
    { to: "/assistant", icon: Sparkles, label: "Trợ lý nghiên cứu", ai: true },
    ...(user.role === "lecturer"
      ? [{ to: "/manage", icon: FlaskConical, label: "Phòng lab của tôi" }]
      : []),
    { to: "/profile", icon: UserRound, label: "Hồ sơ của tôi" },
  ];
  const current =
    links.find((l) => l.to === location.pathname)?.label || "Tổng quan";
  return (
    <div className="app-shell">
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <Link to="/" className="brand-link" aria-label="LabLink tổng quan">
          <Brand />
        </Link>
        <div className="workspace-pill">
          <span className="workspace-dot" />
          Không gian {user.role === "student" ? "sinh viên" : "giảng viên"}
          <ChevronDown size={13} />
        </div>
        <div className="nav-label">KHÔNG GIAN CỦA BẠN</div>
        <nav aria-label="Điều hướng chính">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.exact}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <l.icon size={19} strokeWidth={1.7} />
              <span>{l.label}</span>
              {l.ai && <span className="nav-ai">AI</span>}
              {l.to === "/applications" && applications.length > 0 && (
                <span className="nav-count">{applications.length}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div>
              <span className="note-star">✳</span>
              <span>Cùng tạo điều mới.</span>
            </div>
            <p>
              Một kết nối hôm nay.
              <br />
              Một khám phá ngày mai.
            </p>
            <Link to="/assistant">
              Tìm hướng nghiên cứu <ArrowUpRight size={16} />
            </Link>
          </div>
          <button className="sidebar-user" onClick={() => navigate("/profile")}>
            <span className="avatar">{initials(user.name)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>
                {user.role === "student" ? "Sinh viên" : "Giảng viên"}
              </small>
            </span>
            <ArrowUpRight size={15} />
          </button>
          <button className="logout-button" onClick={onLogout}>
            <LogOut size={15} />
            Đăng xuất
          </button>
          <div className="sidebar-footnote">
            LABLINK <span>SEAPP 2026</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Mở điều hướng"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={22} />
            </button>
            <span>Không gian làm việc</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{current}</strong>
          </div>
          <div className="topbar-actions">
            <button className="top-search" onClick={() => navigate("/explore")}>
              <Search size={16} />
              <span>Tìm phòng lab…</span>
              <span className="search-shortcut">↗</span>
            </button>
            <button
              className="icon-button notification-button"
              onClick={() => setNotifications(true)}
              aria-label="Xem cập nhật ứng tuyển"
            >
              <Bell size={19} />
            </button>
            <div className="top-avatar" title={user.name}>
              {initials(user.name)}
            </div>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="main-footer">
          <span>LabLink · Kết nối để khám phá.</span>
          <span>Dự án tham gia SEApp 2026</span>
        </footer>
      </div>
      {notifications && (
        <Modal
          title="Cập nhật ứng tuyển"
          subtitle="Trạng thái mới nhất của các hồ sơ bạn được phép xem."
          onClose={() => setNotifications(false)}
        >
          {applications.length ? (
            <div className="notification-list">
              {[...applications]
                .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
                .slice(0, 8)
                .map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setNotifications(false);
                      navigate("/applications");
                    }}
                  >
                    <div>
                      <strong>
                        {user.role === "lecturer" ? a.student_name : a.lab_name}
                      </strong>
                      <small>
                        {a.lab_name} · {dateLabel(a.updated_at)}
                      </small>
                    </div>
                    <Status status={a.status} />
                  </button>
                ))}
            </div>
          ) : (
            <Empty
              title="Chưa có cập nhật"
              text="Các thay đổi trạng thái ứng tuyển sẽ xuất hiện tại đây."
            />
          )}
        </Modal>
      )}
    </div>
  );
}
