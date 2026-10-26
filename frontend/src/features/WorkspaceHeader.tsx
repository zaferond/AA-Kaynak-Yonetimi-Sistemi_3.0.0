import { useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import NotificationBell from "./workspace/NotificationBell";
import {
  Users,
  Minimize2,
  Maximize2,
  ChevronDown,
  Download,
  Upload,
  Search,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Principal } from "../access";
import { allowedDefaultTabs } from "../navigation";
import { TAB_LABELS } from "../settings";

type Props = {
  user: Principal | null;
  defaultTab: string;
  setOpeningTab: (tab: string) => void;
  onExportBackup: () => void;
  onRestoreBackup: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onLogout: () => Promise<void>;
  /** The open screen's menu name; stays in view while the page scrolls. */
  location?: string;
  /** Opens the Ctrl+K search. */
  onSearch?: () => void;
  /** Opens the screen a notification is about. */
  onOpenTab?: (tab: string) => void;
};
export default function WorkspaceHeader({
  user,
  defaultTab,
  setOpeningTab,
  onExportBackup,
  onRestoreBackup,
  onLogout,
  location,
  onSearch,
  onOpenTab,
}: Props) {
  const isAdmin = user?.role === "admin",
    isManager = user?.role === "manager";
  const roleLabel = isAdmin
    ? "Admin"
    : isManager
      ? "Yönetici"
      : user?.projectEditor
        ? "Normal-Proje"
        : "Normal Kullanıcı";
  const [menuOpen, setMenuOpen] = useState(false);
  const restoreInput = useRef<HTMLInputElement>(null);
  const mastRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const mast = mastRef.current;
    const app = mast?.parentElement;
    if (!mast || !app) return;
    const update = () => {
      const scale =
        Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
      app.style.setProperty(
        "--workspace-mast-height",
        mast.getBoundingClientRect().height / scale + "px",
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(mast);
    return () => {
      observer.disconnect();
      app.style.removeProperty("--workspace-mast-height");
    };
  }, []);
  return (
    <header className="mast" ref={mastRef}>
      <div className="mastbrandrow">
        <button
          type="button"
          className="mast-home-link"
          aria-label="Otokar — Ana Sayfa’ya git"
          title="Ana Sayfa’ya git"
          data-risk-leave
          onClick={() => onOpenTab?.("home")}
        >
          <img
            className="mast-company-logo"
            src="/assets/otokar-logo.svg"
            alt="Otokar"
            width={74}
            height={20}
          />
        </button>
        {location && <span className="mast-location">{location}</span>}
        {onSearch && (
          <button
            type="button"
            className="mast-search"
            onClick={onSearch}
            aria-keyshortcuts="Control+K Meta+K"
          >
            <Search size={15} aria-hidden="true" />
            <span>Ara…</span>
            <kbd>
              {/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"}
            </kbd>
          </button>
        )}
        <div className="masttopright">
          {user && onOpenTab && (
            <NotificationBell userId={user.id} onOpen={onOpenTab} />
          )}
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="mastuser mastuser-trigger"
                aria-label={"Kullanıcı menüsü: " + (user?.username || "")}
              >
                <Users size={15} />
                <span>
                  {user?.username} · {roleLabel}
                </span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="user-menu">
              <div className="user-menu-head">
                <strong>{user?.username}</strong>
                <span>{roleLabel}</span>
              </div>
              <label className="user-menu-field">
                <span>Varsayılan sekme</span>
                <select
                  aria-label="Varsayılan Sekme"
                  value={defaultTab}
                  onChange={(e) => setOpeningTab(e.target.value)}
                >
                  {allowedDefaultTabs(user).map((id) => (
                    <option key={id} value={id}>
                      {TAB_LABELS[id as keyof typeof TAB_LABELS]}
                    </option>
                  ))}
                </select>
                <small>Her girişte açılacak ekran; hesabınızda saklanır.</small>
              </label>
              {isAdmin && (
                <div className="user-menu-section">
                  <span className="user-menu-title">Veri yedeği</span>
                  <button
                    type="button"
                    className="button"
                    data-risk-leave
                    onClick={() => {
                      setMenuOpen(false);
                      onExportBackup();
                    }}
                  >
                    <Download size={14} aria-hidden="true" />
                    Veri Yedeği İndir
                  </button>
                  <button
                    type="button"
                    className="button"
                    data-risk-leave
                    onClick={() => {
                      setMenuOpen(false);
                      restoreInput.current?.click();
                    }}
                  >
                    <Upload size={14} aria-hidden="true" />
                    Yedek Yükle
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          {/* Outside the menu: the menu unmounts on close, the chooser must not. */}
          {isAdmin && (
            <input
              ref={restoreInput}
              hidden
              type="file"
              accept=".json"
              onChange={onRestoreBackup}
            />
          )}
          <div className="mastglobalactions">
            <button className="button" data-risk-leave onClick={onLogout}>
              Çıkış
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function FullPlanHeader({
  browserFullScreen,
  toggleBrowserFullscreen,
}: {
  browserFullScreen: boolean;
  toggleBrowserFullscreen: () => Promise<void>;
}) {
  return (
    <div className="full-plan-header">
      <div>
        <strong>Kaynak Planlama</strong>
        <span>Geniş Çalışma Alanı</span>
      </div>
      <div className="full-plan-header-actions">
        <button
          type="button"
          className="button"
          onClick={toggleBrowserFullscreen}
        >
          {browserFullScreen ? (
            <Minimize2 size={15} />
          ) : (
            <Maximize2 size={15} />
          )}{" "}
          {browserFullScreen ? "Ekran görünümünden çık" : "Ekranı kapla"}
        </button>
        <a className="button" href="/">
          Normal Görünüme Dön
        </a>
      </div>
    </div>
  );
}
