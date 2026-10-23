import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { SYSTEM_NAME, UI_THEME } from "./settings";
import ErrorBoundary from "./ErrorBoundary";
import PasswordChangeForm from "./PasswordChangeForm";
import {
  currentUser,
  login,
  logout,
  observeSessionChanges,
  resumeRemembered,
} from "./storage";

// The workspace is a separate chunk: the sign-in screen loads without it and
// fetches it in the background, so it is usually ready by the time it is used.
const loadPortal = () => import("./App");
const Portal = lazy(loadPortal);

function App() {
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const authRequest = useRef(0);
  const busyRef = useRef(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [capsLock, setCapsLock] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void loadPortal().catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const verify = async () => {
      const request = ++authRequest.current;
      try {
        const ok = await resumeRemembered();
        if (active && request === authRequest.current) {
          setReady(ok);
          setChecking(false);
        }
      } catch {
        if (active && request === authRequest.current) {
          // A failed focus check must not discard an authenticated editor.
          setChecking(false);
          setError("Oturum kontrol edilemedi. Tekrar deneyin.");
        }
      }
    };
    const reset = () => {
      authRequest.current++;
      busyRef.current = false;
      setReady(false);
      setBusy(false);
      setPassword("");
      // A new Portal instance also clears selections, editors and child caches.
      setSessionKey((key) => key + 1);
    };
    const expired = () => {
      reset();
      setChecking(false);
    };
    const changed = () => {
      reset();
      setError("");
      setChecking(true);
      void verify();
    };
    const focus = () => {
      if (!busyRef.current && document.visibilityState === "visible")
        void verify();
    };
    window.addEventListener("session-expired", expired);
    window.addEventListener("session-changed", changed);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    const stop = observeSessionChanges();
    void verify();
    return () => {
      active = false;
      authRequest.current++;
      stop();
      window.removeEventListener("session-expired", expired);
      window.removeEventListener("session-changed", changed);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, []);
  useEffect(() => {
    document.title = SYSTEM_NAME;
  }, []);
  // Once the session check ends on the form, start typing the user name.
  useEffect(() => {
    if (!checking && !ready && !usernameRef.current?.value)
      usernameRef.current?.focus();
  }, [checking, ready]);

  if (ready && currentUser()?.mustChangePassword)
    return (
      <AuthLayout label="Şifre Belirleme">
        <div className="auth-heading">
          <h2>Şifrenizi Belirleyin</h2>
          <p>
            Hesabınız geçici bir şifreyle açıldı. Devam etmeden önce yalnız
            sizin bildiğiniz yeni bir şifre belirleyin.
          </p>
        </div>
        <PasswordChangeForm
          onDone={() => window.dispatchEvent(new Event("session-changed"))}
          onCancel={() => {
            void logout()
              .catch(() => {})
              .finally(() => window.location.reload());
          }}
          cancelLabel="Çıkış Yap"
        />
      </AuthLayout>
    );
  if (ready)
    return (
      <Suspense
        fallback={
          <p className="app-loading" role="status">
            Yükleniyor…
          </p>
        }
      >
        <Portal key={sessionKey} />
      </Suspense>
    );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const request = ++authRequest.current;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      await login(username, password, remember);
      if (request === authRequest.current) {
        setPassword("");
        setReady(true);
      }
    } catch (cause) {
      if (request === authRequest.current) setError((cause as Error).message);
    } finally {
      if (request === authRequest.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  return (
    <AuthLayout label="Hesap Girişi">
      <div className="auth-heading">
        <h2>Oturum Aç</h2>
        <p>Kurum kullanıcı adınız ve şifrenizle giriş yapın.</p>
      </div>
      <form className="auth-form" aria-label="Giriş Formu" onSubmit={submit}>
        <label htmlFor="login-username">Kullanıcı Adı</label>
        <div className="auth-field">
          <UserRound size={19} aria-hidden="true" />
          <input
            ref={usernameRef}
            id="login-username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Kullanıcı adınız"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
            disabled={checking || busy}
          />
        </div>
        <label htmlFor="login-password">Şifre</label>
        <div className="auth-field">
          <LockKeyhole size={19} aria-hidden="true" />
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Şifreniz"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) =>
              setCapsLock(event.getModifierState("CapsLock"))
            }
            onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
            onBlur={() => setCapsLock(false)}
            aria-describedby={capsLock ? "login-caps" : undefined}
            required
            disabled={checking || busy}
          />
          <button
            className="auth-visibility"
            type="button"
            aria-label={showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
        {capsLock && (
          <p className="auth-caps" id="login-caps" role="status">
            Caps Lock açık.
          </p>
        )}
        <label className="auth-remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            disabled={checking || busy}
          />
          <span>Beni Hatırla</span>
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="auth-submit"
          type="submit"
          disabled={checking || busy}
        >
          <span>
            {checking
              ? "Oturum Kontrol Ediliyor…"
              : busy
                ? "Giriş Yapılıyor…"
                : "Giriş Yap"}
          </span>
          {!checking && !busy && <ArrowRight size={19} aria-hidden="true" />}
        </button>
      </form>
    </AuthLayout>
  );
}

/** Vehicle photos (assets/login-vehicles, login.css data-vehicle); one is
 * picked at random each time the sign-in screen opens. */
const LOGIN_VEHICLES = 6;

function AuthLayout({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [vehicle] = useState(() => Math.floor(Math.random() * LOGIN_VEHICLES));
  return (
    <main className="auth-screen">
      <div className="auth-shell">
        {/* A vehicle photo; the logos sit under the form. */}
        <aside className="auth-brand">
          <div className="auth-brand-content">
            <h1>{SYSTEM_NAME}</h1>
            <p>
              Proje, takım ve çalışan kaynaklarını tek çalışma alanında yönetin.
            </p>
          </div>
          <div className="auth-brand-footer">
            Planlama - Kaynak Yönetimi - Raporlama
          </div>
          <div
            className="auth-brand-art"
            data-vehicle={vehicle}
            aria-hidden="true"
          />
        </aside>

        <section className="auth-panel" aria-label={label}>
          <div className="auth-panel-inner">{children}</div>
          <div className="auth-logos">
            <img
              src="/assets/otokar-logo.svg"
              alt="Otokar"
              width={70}
              height={19}
            />
            <span className="auth-koc-logo" role="img" aria-label="Koç" />
          </div>
        </section>
      </div>
    </main>
  );
}

document.documentElement.dataset.theme = UI_THEME;
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary scope="page">
    <App />
  </ErrorBoundary>,
);
