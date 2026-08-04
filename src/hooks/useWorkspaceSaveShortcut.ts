import { useEffect, useRef } from "react";

export function useWorkspaceSaveShortcut(
  active: boolean,
  onSave: () => void | Promise<void>,
) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.key.toLocaleLowerCase() !== "s"
      ) return;

      event.preventDefault();
      void onSaveRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active]);
}