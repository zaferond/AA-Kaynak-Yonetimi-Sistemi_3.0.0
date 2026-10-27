import { useState } from "react";
import type { Data } from "../../model";
import type { PortalEditor } from "../editor-state";
import type { Dispatch, SetStateAction } from "react";
import { useDirectoryUsers } from "../useDirectoryUsers";
import AccessPermissionFields from "./AccessPermissionFields";
import { accountForm, type PermissionForm } from "./employee-access-draft";
type Props = {
  data: Data;
  editor: Extract<PortalEditor, { kind: "resource" }>;
  setEditor: Dispatch<SetStateAction<PortalEditor | null>>;
  busy: boolean;
};
export default function ResourceAccessFields({
  data,
  editor,
  setEditor,
  busy,
}: Props) {
  const draft = editor.account || { form: null, changed: false },
    form = draft.form;
  const [leaderQuery, setLeaderQuery] = useState(""),
    [directoryQuery, setDirectoryQuery] = useState("");
  const posting = editor.version.status.includes("İlan");
  const directory = useDirectoryUsers(!posting && !!form && !form.id);
  const selected = data.users?.find((u) => u.id === form?.id);
  const linked = data.users?.find((u) => u.resourceId === editor.value.id);
  function update(form: PermissionForm | null, revoke = false) {
    setEditor({ ...editor, account: { form, changed: !!form, revoke } });
  }
  return (
    <section className="resource-account-section">
      <div className="resource-account-heading">
        <h3>Hesap ve Yetkiler</h3>
        <span>
          {posting
            ? "Hesap tanımlanmaz"
            : linked
              ? linked.username
              : form?.directoryUser
                ? `${form.directoryUser.username} · Henüz kaydedilmedi`
                : "AD kullanıcısı seçin"}
        </span>
      </div>
      {posting ? (
        <p className="access-admin-note">İlan kaydına hesap tanımlanamaz.</p>
      ) : (
        <>
          {!linked && (
            <label className="access-field">
              Hesap Eşleştirmesi
              <input
                aria-label="Hesap Eşleştirmesi"
                readOnly
                value="Active Directory"
              />
            </label>
          )}
          {form && !draft.revoke && (
            <AccessPermissionFields
              data={data}
              form={form}
              setForm={update}
              selected={selected}
              busy={busy}
              directory={directory}
              leaderQuery={leaderQuery}
              setLeaderQuery={setLeaderQuery}
              directoryQuery={directoryQuery}
              setDirectoryQuery={setDirectoryQuery}
              chooseEmployee={() => {}}
              boundResource
            />
          )}
        </>
      )}
      {linked && form && (
        <button
          type="button"
          className={"button" + (!draft.revoke ? " access-revoke-button" : "")}
          disabled={busy}
          onClick={() => {
            if (draft.revoke) {
              setEditor({
                ...editor,
                account: {
                  form: accountForm(data, linked.id),
                  changed: false,
                },
              });
              return;
            }
            if (
              window.confirm(
                `${linked.name} için uygulama yetkisi Kaydet ile kaldırılacak ve açık oturumları kapatılacak. Onaylıyor musunuz?`,
              )
            )
              update(form, true);
          }}
        >
          {draft.revoke
            ? "Yetki Kaldırmayı Geri Al"
            : "Uygulama Yetkisini Kaldır"}
        </button>
      )}
      {draft.revoke && (
        <p role="status" className="access-admin-note">
          Kaydedildiğinde hesap yetkisi kaldırılacak. Çalışan kaydı korunur.
        </p>
      )}
    </section>
  );
}
