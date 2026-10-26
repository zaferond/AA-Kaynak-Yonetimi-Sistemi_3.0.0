import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  renewSessionActivity,
  sessionIdleDeadline,
  sessionAbsoluteDeadline,
  logout,
  resumeRemembered,
} from "./storage";

/** Only real interaction renews idle time; polling and background reads never do. */
export default function SessionActivity() {
  const [warning, setWarning] = useState(false);
  const [absoluteWarning, setAbsoluteWarning] = useState(false);
  const dismissedUntil = useRef(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      pending = true,
      sent = 0,
      busy = false;
    const renew = async () => {
      if (!active || busy || !pending) return;
      busy = true;
      pending = false;
      sent = Date.now();
      try {
        await renewSessionActivity();
        if (active) setError("");
      } catch {
        pending = true;
        if (active)
          setError("Oturum süresi yenilenemedi. Bağlantınızı kontrol edin.");
      } finally {
        busy = false;
      }
    };
    const interact = (event: Event) => {
      if (!event.isTrusted) return;
      pending = true;
      if (Date.now() - sent >= 60000) void renew();
    };
    const check = () => {
      const deadline = sessionIdleDeadline();
      if (deadline) {
        const remaining = deadline - Date.now();
        const absolute = sessionAbsoluteDeadline();
        setAbsoluteWarning(absolute > 0 && absolute - Date.now() <= 5 * 60000);
        setWarning(
          remaining <= 5 * 60000 && Date.now() >= dismissedUntil.current,
        );
        if (remaining <= 0 && !busy) {
          busy = true;
          void resumeRemembered()
            .catch(() => {})
            .finally(() => {
              busy = false;
            });
        }
      }
      if (pending && Date.now() - sent >= 60000) void renew();
    };
    void renew(); // An explicit page opening/reload is user activity.
    for (const name of ["pointerdown", "keydown", "wheel"])
      window.addEventListener(name, interact, { passive: true });
    window.addEventListener("session-deadline", check);
    const timer = setInterval(check, 5000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("session-deadline", check);
      for (const name of ["pointerdown", "keydown", "wheel"])
        window.removeEventListener(name, interact);
    };
  }, []);
  return (
    <Dialog open={warning} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Oturumunuz sona ermek üzere</DialogTitle>
          <DialogDescription>
            {absoluteWarning
              ? "Azami oturum süreniz doluyor ve bu süre uzatılamaz. Çalışmanızı kaydedip yeniden giriş yapın."
              : "Hareketsizlik nedeniyle oturumunuz yakında kapanacak. Kaydedilmemiş çalışmalarınızı korumak için oturumunuzu sürdürün."}
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert">{error}</p>}
        <button
          onClick={() => {
            if (absoluteWarning) {
              dismissedUntil.current = Date.now() + 60000;
              setWarning(false);
              return;
            }
            void renewSessionActivity()
              .then(() => {
                setWarning(false);
                setError("");
              })
              .catch(() =>
                setError("Oturum süresi yenilenemedi. Tekrar deneyin."),
              );
          }}
        >
          {absoluteWarning ? "Çalışmayı Kaydetmek İçin Dön" : "Oturumu Sürdür"}
        </button>
        <button
          onClick={() => {
            void logout()
              .then(() => window.location.reload())
              .catch(() => setError("Çıkış yapılamadı. Tekrar deneyin."));
          }}
        >
          Çıkış Yap
        </button>
      </DialogContent>
    </Dialog>
  );
}
