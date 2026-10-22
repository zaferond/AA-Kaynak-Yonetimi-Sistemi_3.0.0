import ProjectResponsible from "../../ProjectResponsible";
import type { Dispatch, SetStateAction } from "react";
import { visibleMilestoneBarStyle } from "../../milestone-ranges";
import MilestoneDateEditor from "../../MilestoneDateEditor";
import type { Data } from "../../model";
import type { EditorFieldProps } from "./editor-field-props";
type Props = EditorFieldProps<"milestone"> & {
  data: Data | null;
  setFormError: Dispatch<SetStateAction<string>>;
};
export default function MilestoneEditorFields({
  editor,
  setEditor,
  data,
  setFormError,
}: Props) {
  return (
    <>
      <div className="phasecontext">
        <div>
          <small>Proje</small>
          <strong>
            {data?.projects.find((p) => p.id === editor.projectId)?.name}
          </strong>
          <ProjectResponsible
            project={data?.projects.find((p) => p.id === editor.projectId)}
          />
        </div>
        <span>
          {data?.projects.find((p) => p.id === editor.projectId)?.start} –{" "}
          {data?.projects.find((p) => p.id === editor.projectId)?.end}
        </span>
      </div>
      <label>
        Başlık
        <input
          maxLength={200}
          autoFocus
          value={editor.value.name}
          onChange={(e) =>
            setEditor({
              ...editor,
              value: { ...editor.value, name: e.target.value },
            })
          }
        />
      </label>
      <MilestoneDateEditor
        value={editor.value}
        isEmpty={!!editor.draftEmpty}
        projectStart={
          data!.projects.find((p) => p.id === editor.projectId)!.start
        }
        projectEnd={data!.projects.find((p) => p.id === editor.projectId)!.end}
        onChange={(value, draftEmpty = false) => {
          setFormError("");
          setEditor({ ...editor, value, draftEmpty });
        }}
      />
      <fieldset className="milestone-style">
        <legend>Bar Görünümü</legend>
        <div className="milestone-bar-options">
          {(
            [
              ["solid", "Düz"],
              ["outline", "Çerçeveli"],
            ] as const
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={
                visibleMilestoneBarStyle(editor.value.barStyle) === id
                  ? "selected"
                  : ""
              }
              aria-pressed={
                visibleMilestoneBarStyle(editor.value.barStyle) === id
              }
              onClick={() =>
                setEditor({
                  ...editor,
                  value: { ...editor.value, barStyle: id },
                })
              }
            >
              <span className={"sample " + id} />
              {label}
            </button>
          ))}
        </div>
      </fieldset>
    </>
  );
}
