import { createCard } from "@/features/board/actions";

export function AddCardForm({ columnId }: { columnId: string }) {
  return (
    <form
      action={createCard}
      className="border border-dashed border-slate-300 dark:border-ocean-4 rounded-md p-2 flex flex-col gap-2"
    >
      <input type="hidden" name="columnId" value={columnId} />
      <input
        name="title"
        type="text"
        required
        maxLength={200}
        placeholder="+ New card"
        className="w-full bg-transparent text-sm text-slate-700 dark:text-skyblue-3 placeholder:text-slate-400 dark:placeholder:text-ocean-5 focus:outline-none"
      />
      <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-ocean-6">
        <label className="flex items-center gap-1">
          <input type="hidden" name="createInAdo" value="false" />
          <input type="checkbox" name="createInAdo" value="true" className="accent-ocean-5" />
          ADO
        </label>
        <input
          name="sprintNumber"
          type="number"
          min={1}
          placeholder="Sprint #"
          className="w-20 bg-transparent border-b border-slate-200 dark:border-ocean-4 focus:outline-none"
        />
      </div>
      {/*
        Explicit submit button. Without one, HTML "implicit submission" (Enter in
        a text field) only fires when the form has a single field that blocks
        implicit submission. This form has two such fields — title (text) and
        sprintNumber (number) — so pressing Enter did nothing until this button
        was added. It also gives an explicit affordance, matching AddColumnForm.
      */}
      <button
        type="submit"
        className="text-xs self-start text-slate-500 dark:text-ocean-6 hover:text-ocean-5 dark:hover:text-skyblue-1"
      >
        Add
      </button>
    </form>
  );
}
