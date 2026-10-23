import { TriangleAlert } from "lucide-react";

/** Clearing every planned allocation is rare and irreversible, so it sits on
 * the admin-only Organizasyon screen instead of the planning filter bar. */
export default function AllocationResetPanel({
  disabled,
  onReset,
}: {
  disabled: boolean;
  onReset: () => void;
}) {
  return (
    <section
      className="panel allocation-reset-panel"
      aria-label="Kaynak dağılımlarını sıfırlama"
    >
      <TriangleAlert size={18} aria-hidden="true" />
      <p>
        <strong>Kaynak planlama verisi</strong>
        <span>
          Tüm liderlik, proje ve aylardaki planlanan kaynak dağılımlarını
          temizler. Uygulama içinden geri alınamaz; öncesinde veri yedeği alın.
        </span>
      </p>
      <button
        type="button"
        className="button deletebutton"
        disabled={disabled}
        onClick={onReset}
      >
        Tüm Kaynak Dağılımlarını Sıfırla
      </button>
    </section>
  );
}
