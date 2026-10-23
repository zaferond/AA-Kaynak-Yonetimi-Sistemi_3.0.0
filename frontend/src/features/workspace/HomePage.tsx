import { ArrowRight } from "lucide-react";
import type { Principal } from "../../access";
import { TAB_LABELS } from "../../settings";
import { currentPlanningDate } from "../../resource-dates";
import { isoWeek } from "../../iso-week";
import { menuTabs, type MenuTab } from "./menu-tabs";
import HomeCardArt, { bentoSpans } from "./HomeCardArt";

const GROUPS: Record<MenuTab["group"], string> = {
  home: "",
  planning: "Planlama ve Projeler",
  reports: "Raporlar",
  actuals: "Aktivite",
  admin: "Yönetim",
};
const DESCRIPTIONS: Record<Exclude<MenuTab["value"], "home">, string> = {
  projects: "Proje takvimleri, aşamalar, kilometre taşları ve senaryolar.",
  plan: "Takım ve proje bazında aylık kaynak dağılımı.",
  progress: "Hedef plan, gerçekleşen ve aylık değerlendirme.",
  risk: "Sistem ve alt sistem riskleri.",
  critical: "Haftanın kritik konuları ve gecikmeler.",
  overview: "Liderlik ve takım bazında eksik kaynak, Head Count.",
  actual: "Çalışanların aylık gerçekleşen kaynak girişi.",
  activity: "Çalışanların aylık aktivite ve izin özeti.",
  resources: "Çalışanlar, liderlikler, takımlar ve yetkiler.",
};
const ROLE_LABELS = {
  admin: "Admin",
  manager: "Yönetici",
  normal: "Kullanıcı",
};
const dayFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  weekday: "long",
});

/** Ana Sayfa: the opening screen. One card per screen the user may open,
 * in sidebar order, laid out as a bento grid; a card opens its screen. */
export default function HomePage({
  user,
  onOpen,
}: {
  user: Principal | null;
  onOpen: (tab: string) => void;
}) {
  const today = currentPlanningDate();
  const cards = menuTabs(user).filter(
    (tab): tab is Exclude<MenuTab, { value: "home" }> => tab.value !== "home",
  );
  const spans = bentoSpans(cards.length);
  return (
    <section className="home-page" aria-label="Ana Sayfa">
      <p className="home-greeting">
        Hoş geldiniz, {user?.name || user?.username}
        {user && <> · {ROLE_LABELS[user.role]}</>} ·{" "}
        {dayFormat.format(new Date(today + "T12:00:00"))} · Hafta{" "}
        {isoWeek(today).week}
      </p>
      <div className="home-cards" data-count={cards.length}>
        {cards.map(({ value, Icon, group }, index) => (
          <button
            key={value}
            type="button"
            className="home-card"
            data-span={spans[index]}
            onClick={() => onOpen(value)}
          >
            <HomeCardArt value={value} />
            <span className="home-card-body">
              <span className="home-card-top">
                <span className="home-card-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="home-card-group">{GROUPS[group]}</span>
              </span>
              <strong>{TAB_LABELS[value]}</strong>
              <span className="home-card-text">{DESCRIPTIONS[value]}</span>
            </span>
            <ArrowRight className="home-card-go" size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
