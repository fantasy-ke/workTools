import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { createId } from "../utils";
import { translate } from "../i18n";
import { translate as t } from "../i18n";

type ToastTone = "success" | "error" | "info";
interface ToastItem { id: string; message: string; tone: ToastTone }
interface ToastApi { notify: (message: string, tone?: ToastTone) => void }
const ToastContext = createContext<ToastApi>({ notify: () => undefined });

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    const id = createId("toast");
    setItems((current) => [...current, { id, message: translate(message), tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3200);
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return <ToastContext.Provider value={value}>{children}<div className="toast-stack" aria-live="polite">{items.map((item) => <div className={`toast toast-${item.tone}`} key={item.id}>{item.tone === "success" ? <CheckCircle2 /> : item.tone === "error" ? <CircleAlert /> : <Info />}<span>{item.message}</span><button onClick={() => setItems((current) => current.filter((value) => value.id !== item.id))} aria-label={t("关闭通知")}><X /></button></div>)}</div></ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);