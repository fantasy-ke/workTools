import { useEffect, useRef } from "react";

export interface MonacoFindTarget {
  getAction: (id: string) => { run: () => unknown } | null;
}

function isFindShortcut(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLocaleLowerCase() === "f";
}

export function useMonacoFindShortcut(
  active: boolean,
  getEditor: () => MonacoFindTarget | null,
) {
  const getEditorRef = useRef(getEditor);
  getEditorRef.current = getEditor;

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isFindShortcut(event)) return;

      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;

      void getEditorRef.current()?.getAction("actions.find")?.run();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [active]);
}
