import { createRoot } from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./components/Toast";
import { I18nProvider } from "./i18n";

createRoot(document.getElementById("root")!).render(<I18nProvider><ToastProvider><App /></ToastProvider></I18nProvider>);