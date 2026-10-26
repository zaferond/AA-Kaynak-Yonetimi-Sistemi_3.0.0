import ProjectResponsible from "../../ProjectResponsible";
import {
  useState,
  type Dispatch,
  type SetStateAction,
  type CSSProperties,
} from "react";
import { AlignLeft, Paintbrush } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { milestoneRanges, rangeNotes, noteDates } from "../../milestone-ranges";
import { phasePalette } from "../../model";
import { barDateLabel } from "../timeline-labels";
import MilestoneDiamond from "../../MilestoneDiamond";
import "../../components/topic-editor.css";
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
  const [section, setSection] = useState("details");
  const ranges = editor.draftEmpty ? [] : milestoneRanges(editor.value);
  const firstRange = ranges.find((range) => range.displayKind !== "milestone");
  const firstNote = firstRange && rangeNotes(firstRange)[0];
  const dates =
    firstRange && firstNote ? noteDates(firstNote, firstRange) : firstRange;
  const color =
    phasePalette.find(
      (item) => item.id === (firstRange?.color || editor.value.barColor),
    ) || phasePalette[0];
  return (
    <Tabs
      className="topic-editor-fields"
      value={section}
      onValueChange={setSection}
    >
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
      <TabsList
        className="topic-editor-tabs"
        aria-label="Başlık düzenleme bölümleri"
      >
        <TabsTrigger value="details">
          <AlignLeft size={15} aria-hidden="true" />
          Başlık ve Detaylar
        </TabsTrigger>
        <TabsTrigger value="appearance">
          <Paintbrush size={15} aria-hidden="true" />
          Görünüm
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="details"
        forceMount
        hidden={section !== "details"}
        className="topic-editor-section"
      >
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
          projectEnd={
            data!.projects.find((p) => p.id === editor.projectId)!.end
          }
          onChange={(value, draftEmpty = false) => {
            setFormError("");
            setEditor({ ...editor, value, draftEmpty });
          }}
        />
      </TabsContent>
      <TabsContent
        value="appearance"
        forceMount
        hidden={section !== "appearance"}
        className="topic-editor-section"
      >
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
        <section
          className="topic-appearance-preview"
          aria-label="Takvim ön izlemesi"
        >
          <h3>Takvim ön izlemesi</h3>
          {firstRange && (
            <div
              className={
                "topic-preview-bar " +
                visibleMilestoneBarStyle(editor.value.barStyle)
              }
              style={
                {
                  "--preview-ink": color.ink,
                  "--preview-soft": color.bg,
                } as CSSProperties
              }
            >
              <strong>
                {firstNote?.completed ? "✓ " : "○ "}
                {firstNote?.text || editor.value.name || "Detay açıklama"}
              </strong>
              {dates && (
                <small>
                  {barDateLabel(dates.start)} – {barDateLabel(dates.end)}
                </small>
              )}
            </div>
          )}
          {ranges
            .filter((range) => range.displayKind === "milestone")
            .map((range, index) => (
              <div className="topic-preview-point" key={index}>
                <MilestoneDiamond
                  color={
                    (
                      phasePalette.find((item) => item.id === range.color) ||
                      color
                    ).border
                  }
                  style={range.diamondStyle}
                  completed={!!rangeNotes(range)[0]?.completed}
                />
                <div>
                  <strong>
                    {rangeNotes(range)[0]?.text ||
                      editor.value.name ||
                      "Milestone"}
                  </strong>
                  <small>{barDateLabel(range.start)}</small>
                </div>
              </div>
            ))}
          {!ranges.length && (
            <p>
              Bir tarih aralığı veya Milestone eklediğinizde ön izleme burada
              görünür.
            </p>
          )}
        </section>
      </TabsContent>
    </Tabs>
  );
}
