import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  Braces,
  CalendarClock,
  ChevronRight,
  CircleHelp,
  Command,
  Copy,
  Files,
  FileCog,
  FolderKanban,
  GitCompareArrows,
  Home,
  Laptop,
  Menu,
  Minus,
  Search,
  Settings,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import type { ViewId, WorkspaceRecord, WorkspaceSnapshot } from "./types";
import { useAppStore } from "./store/appStore";
import { isTauriRuntime } from "./platform/files";
import { createId } from "./utils";
import "./App.css";
import { translate as t } from "./i18n";

const LAZY_RECOVERY_VIEW_KEY = "worktools:lazy-recovery-view";
const lazyRetryKey = (view: ViewId) => `worktools:lazy-retry:${view}`;

function lazyPage<T extends object>(view: ViewId, load: () => Promise<{ default: ComponentType<T> }>) {
  return lazy(async () => {
    try {
      const page = await load();
      sessionStorage.removeItem(lazyRetryKey(view));
      return page;
    } catch (error) {
      const retryKey = lazyRetryKey(view);
      if (!sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, "1");
        sessionStorage.setItem(LAZY_RECOVERY_VIEW_KEY, view);
        window.location.reload();
        return await new Promise<never>(() => undefined);
      }

      sessionStorage.removeItem(retryKey);
      throw error;
    }
  });
}

const HomePage = lazyPage("home", async () => ({ default: (await import("./pages/HomePage")).HomePage }));
const FormatPage = lazyPage("format", async () => ({ default: (await import("./pages/FormatPage")).FormatPage }));
const DiffPage = lazyPage("diff", async () => ({ default: (await import("./pages/DiffPage")).DiffPage }));
const ConfigPage = lazyPage("config", async () => ({ default: (await import("./pages/ConfigPage")).ConfigPage }));
const CronPage = lazyPage("cron", async () => ({ default: (await import("./pages/CronPage")).CronPage }));
const BatchPage = lazyPage("batch", async () => ({ default: (await import("./pages/BatchPage")).BatchPage }));
const WorkspacesPage = lazyPage("workspaces", async () => ({ default: (await import("./pages/WorkspacesPage")).WorkspacesPage }));
const HelpPage = lazyPage("help", async () => ({ default: (await import("./pages/HelpPage")).HelpPage }));
const SettingsPage = lazyPage("settings", async () => ({ default: (await import("./pages/SettingsPage")).SettingsPage }));

function createViews(): Array<{ id: ViewId; label: string; icon: React.ReactNode; section: "tools" | "library" }> {
  return [
  { id: "home", label: t("首页"), icon: <Home />, section: "tools" },
  { id: "format", label: t("格式化"), icon: <Braces />, section: "tools" },
  { id: "diff", label: t("对比"), icon: <GitCompareArrows />, section: "tools" },
  { id: "config", label: t("配置处理"), icon: <FileCog />, section: "tools" },
  { id: "cron", label: t("Cron 工具"), icon: <CalendarClock />, section: "tools" },
  { id: "batch", label: t("批量对比"), icon: <Files />, section: "tools" },
  { id: "workspaces", label: t("工作区"), icon: <FolderKanban />, section: "library" },
  { id: "help", label: t("帮助"), icon: <CircleHelp />, section: "library" },
  { id: "settings", label: t("设置"), icon: <Settings />, section: "library" },
  ];
}

interface OpenTab {
  id: string;
  view: ViewId;
  name?: string;
  snapshot?: WorkspaceSnapshot;
  workspaceId?: string;
}

function isMultiInstanceView(view: ViewId): view is "format" | "diff" | "config" {
  return view === "format" || view === "diff" || view === "config";
}

function cloneSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  if (snapshot.kind === "diff") return { ...snapshot, options: { ...snapshot.options } };
  return { ...snapshot };
}

function createOpenTab(view: ViewId, name?: string, snapshot?: WorkspaceSnapshot, workspaceId?: string): OpenTab {
  return {
    id: view === "home" ? "home" : createId(`tab-${view}`),
    view,
    name: name?.trim() || undefined,
    snapshot,
    workspaceId,
  };
}

function getTabTitle(tab: OpenTab): string {
  const label = createViews().find((item) => item.id === tab.view)?.label ?? t("首页");
  const name = tab.name?.trim() || t("未命名");
  return isMultiInstanceView(tab.view) ? `${label} - ${name}` : label;
}

function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const appWindow = getCurrentWindow();
      if (active) setMaximized(await appWindow.isMaximized());
      const stopListening = await appWindow.onResized(async () => {
        if (active) setMaximized(await appWindow.isMaximized());
      });
      if (active) unlisten = stopListening;
      else stopListening();
    }).catch(console.error);

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  const runWindowAction = async (action: "minimize" | "toggle-maximize" | "close") => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const appWindow = getCurrentWindow();
    if (action === "minimize") await appWindow.minimize();
    else if (action === "close") await appWindow.close();
    else {
      await appWindow.toggleMaximize();
      setMaximized(await appWindow.isMaximized());
    }
  };

  return (
    <div className="window-controls" aria-label={t("窗口控制")}>
      <button className="window-control" onClick={() => void runWindowAction("minimize")} aria-label={t("最小化")} title={t("最小化")}><Minus /></button>
      <button className="window-control" onClick={() => void runWindowAction("toggle-maximize")} aria-label={maximized ? t("还原") : t("最大化")} title={maximized ? t("还原") : t("最大化")}>{maximized ? <Copy /> : <Square />}</button>
      <button className="window-control window-control-close" onClick={() => void runWindowAction("close")} aria-label={t("关闭")} title={t("关闭")}><X /></button>
    </div>
  );
}

export default function App() {
  const initialize = useAppStore((state) => state.initialize);
  const hydrated = useAppStore((state) => state.hydrated);
  const storageError = useAppStore((state) => state.storageError);
  const setView = useAppStore((state) => state.setView);
  const settings = useAppStore((state) => state.settings);
  const tauriRuntime = isTauriRuntime();
  const views = useMemo(createViews, [settings.language]);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([createOpenTab("home")]);
  const [activeTabId, setActiveTabId] = useState("home");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const navClickTimer = useRef<number | null>(null);

  const activeTab = openTabs.find((tab) => tab.id === activeTabId) ?? openTabs[0];
  const activeView = activeTab?.view ?? "home";

  const selectTab = useCallback((tab: OpenTab) => {
    setActiveTabId(tab.id);
    setView(tab.view);
    setNavOpen(false);
  }, [setView]);

  const navigate = useCallback((next: ViewId) => {
    const existing = openTabs.find((tab) => tab.view === next);
    if (existing) {
      selectTab(existing);
      return;
    }

    const tab = createOpenTab(next);
    setOpenTabs((current) => [...current, tab]);
    selectTab(tab);
  }, [openTabs, selectTab]);

  const openNewTab = useCallback((next: ViewId) => {
    if (!isMultiInstanceView(next)) {
      navigate(next);
      return;
    }

    const tab = createOpenTab(next);
    setOpenTabs((current) => [...current, tab]);
    selectTab(tab);
  }, [navigate, selectTab]);

  const scheduleNavigate = useCallback((next: ViewId) => {
    if (navClickTimer.current !== null) window.clearTimeout(navClickTimer.current);
    navClickTimer.current = window.setTimeout(() => {
      navClickTimer.current = null;
      navigate(next);
    }, 220);
  }, [navigate]);

  const handleNavDoubleClick = useCallback((next: ViewId) => {
    if (navClickTimer.current !== null) window.clearTimeout(navClickTimer.current);
    navClickTimer.current = null;
    openNewTab(next);
  }, [openNewTab]);

  const closeTab = useCallback((targetId: string) => {
    const target = openTabs.find((tab) => tab.id === targetId);
    if (!target || target.view === "home") return;
    const targetIndex = openTabs.findIndex((tab) => tab.id === targetId);
    const remaining = openTabs.filter((tab) => tab.id !== targetId);
    setOpenTabs(remaining);
    if (activeTabId === targetId) {
      const next = remaining[Math.max(0, targetIndex - 1)] ?? remaining[0];
      setActiveTabId(next.id);
      setView(next.view);
    }
  }, [activeTabId, openTabs, setView]);

  const updateTabName = useCallback((tabId: string, name: string) => {
    setOpenTabs((current) => current.map((tab) => tab.id === tabId ? { ...tab, name: name.trim() || undefined } : tab));
  }, []);

  const updateTabWorkspace = useCallback((tabId: string, workspace: WorkspaceRecord) => {
    setOpenTabs((current) => current.map((tab) => tab.id === tabId ? { ...tab, name: workspace.name, workspaceId: workspace.id } : tab));
  }, []);

  const openWorkspace = useCallback((workspace: WorkspaceRecord) => {
    const target: ViewId = workspace.snapshot.kind === "format" ? "format" : workspace.snapshot.kind === "diff" ? "diff" : "cron";
    const snapshot = cloneSnapshot(workspace.snapshot);

    if (isMultiInstanceView(target)) {
      const tab = createOpenTab(target, workspace.name, snapshot, workspace.id);
      setOpenTabs((current) => [...current, tab]);
      selectTab(tab);
      return;
    }

    const existing = openTabs.find((tab) => tab.view === target);
    if (existing) {
      const updated = { ...existing, name: workspace.name, snapshot, workspaceId: workspace.id };
      setOpenTabs((current) => current.map((tab) => tab.id === existing.id ? updated : tab));
      selectTab(updated);
      return;
    }

    const tab = createOpenTab(target, workspace.name, snapshot, workspace.id);
    setOpenTabs((current) => [...current, tab]);
    selectTab(tab);
  }, [openTabs, selectTab]);

  useEffect(() => { void initialize(); }, [initialize]);

  useEffect(() => () => {
    if (navClickTimer.current !== null) window.clearTimeout(navClickTimer.current);
  }, []);

  useEffect(() => {
    const recoveryView = sessionStorage.getItem(LAZY_RECOVERY_VIEW_KEY) as ViewId | null;
    if (!recoveryView || !views.some((item) => item.id === recoveryView)) return;
    sessionStorage.removeItem(LAZY_RECOVERY_VIEW_KEY);
    navigate(recoveryView);
  }, [navigate]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme = settings.theme === "system" ? (media.matches ? "dark" : "light") : settings.theme;
      document.documentElement.dataset.theme = theme;
      document.documentElement.dataset.density = settings.density;
      document.documentElement.dataset.gpuAcceleration = settings.gpuAcceleration ? "on" : "off";
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme, settings.density, settings.gpuAcceleration]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if (event.key === "Escape") setPaletteOpen(false);
      if (event.altKey && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        navigate(views[Number(event.key) - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const active = views.find((item) => item.id === activeView) ?? views[0];
  const activeTitle = activeTab ? getTabTitle(activeTab) : active.label;
  const commands = useMemo(
    () => views.filter((item) => `${item.label} ${item.id}`.toLocaleLowerCase().includes(paletteSearch.toLocaleLowerCase())),
    [paletteSearch, views],
  );

  const renderView = (tab: OpenTab) => {
    if (tab.view === "home") return <HomePage onNavigate={navigate} onOpenWorkspace={openWorkspace} />;
    if (tab.view === "format") return <FormatPage snapshot={tab.snapshot} workspaceId={tab.workspaceId} active={activeTabId === tab.id} onTitleChange={(name) => updateTabName(tab.id, name)} onWorkspaceSaved={(workspace) => updateTabWorkspace(tab.id, workspace)} />;
    if (tab.view === "diff") return <DiffPage snapshot={tab.snapshot} workspaceId={tab.workspaceId} active={activeTabId === tab.id} onTitleChange={(name) => updateTabName(tab.id, name)} onWorkspaceSaved={(workspace) => updateTabWorkspace(tab.id, workspace)} />;
    if (tab.view === "config") return <ConfigPage active={activeTabId === tab.id} />;
    if (tab.view === "cron") return <CronPage snapshot={tab.snapshot} workspaceId={tab.workspaceId} active={activeTabId === tab.id} onWorkspaceSaved={(workspace) => updateTabWorkspace(tab.id, workspace)} />;
    if (tab.view === "batch") return <BatchPage />;
    if (tab.view === "workspaces") return <WorkspacesPage onOpen={openWorkspace} />;
    if (tab.view === "help") return <HelpPage />;
    return <SettingsPage />;
  };

  return (
    <div className={`app-shell ${tauriRuntime ? "tauri-shell" : ""}`}>
      <header className="app-bar" data-tauri-drag-region>
        <button className="mobile-menu icon-btn" onClick={() => setNavOpen((value) => !value)} aria-label={t("打开导航")}>
          <Menu />
        </button>
        <button className="brand" onClick={() => navigate("home")}>
          <img className="brand-mark" src="/worktools.svg" alt="" aria-hidden="true" />
          <span>worktools</span>
        </button>
        <span className="app-context"><ChevronRight />{activeTitle}</span>
        <button className="command-trigger" onClick={() => setPaletteOpen(true)}>
          <Search />
          <span>{t("搜索工具或命令")}</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="app-bar-spacer" />
        <span className="local-status"><ShieldCheck />{t("本地处理")}</span>
        <span className="runtime-badge">
          {tauriRuntime ? <Laptop /> : <Command />}
          {tauriRuntime ? "Windows" : "Web"}
        </span>
        {tauriRuntime && <WindowControls />}
      </header>

      <div className="task-tabs" role="tablist" aria-label={t("已打开任务")}>
        {openTabs.map((tab) => {
          const item = views.find((candidate) => candidate.id === tab.view) ?? views[0];
          const selected = activeTabId === tab.id;
          const title = getTabTitle(tab);
          return (
            <div className={`task-tab ${selected ? "active" : ""}`} key={tab.id}>
              <button
                className="task-tab-main"
                role="tab"
                aria-selected={selected}
                onClick={() => selectTab(tab)}
                title={title}
              >
                {item.icon}
                <span>{title}</span>
              </button>
              {tab.view !== "home" && (
                <button className="task-tab-close" onClick={() => closeTab(tab.id)} aria-label={`${t("关闭")} ${title}`} title={`${t("关闭")} ${title}`}>
                  <X />
                </button>
              )}
            </div>
          );
        })}
        <span className="task-tabs-spacer" />
        <span className="task-shortcut-hint">{t("Alt 1–9 快速打开")}</span>
      </div>

      <aside className={`side-nav ${navOpen ? "open" : ""}`}>
        <nav>
          <span className="nav-section-title">{t("工具")}</span>
          {views.filter((item) => item.section === "tools").map((item) => {
            const showMultiTabHint = item.id === "format" || item.id === "diff";
            return (
              <button
                key={item.id}
                className={activeView === item.id ? "active" : ""}
                onClick={() => scheduleNavigate(item.id)}
                onDoubleClick={() => handleNavDoubleClick(item.id)}
                title={isMultiInstanceView(item.id) ? t("单击切换，双击新建标签") : undefined}
              >
                {item.icon}
                <span className="nav-item-label">
                  {item.label}
                  {showMultiTabHint && <small>{t("双击可新建多个标签")}</small>}
                </span>
              </button>
            );
          })}
          <span className="nav-section-title">{t("资料库")}</span>
          {views.filter((item) => item.section === "library").map((item) => (
            <button key={item.id} className={activeView === item.id ? "active" : ""} onClick={() => scheduleNavigate(item.id)} onDoubleClick={() => handleNavDoubleClick(item.id)}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>
        <footer><span className="privacy-dot" /><span>{t("报文默认不上传")}</span></footer>
      </aside>

      <main className="workspace">
        {!hydrated ? (
          <div className="app-loading"><img className="brand-mark" src="/worktools.svg" alt="" aria-hidden="true" /><strong>{t("正在准备本地工作台…")}</strong></div>
        ) : (
          <Suspense fallback={<div className="app-loading"><img className="brand-mark" src="/worktools.svg" alt="" aria-hidden="true" /><strong>{t("正在加载工具…")}</strong></div>}>
            {storageError && <div className="storage-warning">{t("本地数据库不可用：")}{storageError}{t("。临时工具仍可使用，但保存功能可能失败。")}</div>}
            <div className="workspace-views">
              {openTabs.map((tab) => (
                <section
                  className={`workspace-view ${activeTabId === tab.id ? "active" : ""}`}
                  key={tab.id}
                  role="tabpanel"
                  aria-hidden={activeTabId !== tab.id}
                  hidden={activeTabId !== tab.id}
                >
                  {renderView(tab)}
                </section>
              ))}
            </div>
          </Suspense>
        )}
      </main>

      <footer className="status-bar">
        <span><i className="status-dot" />{t("就绪")}</span>
        <span>{settings.temporaryByDefault ? t("临时工作模式") : t("持久工作模式")}</span>
        <span className="status-spacer" />
        <span>{activeTitle}</span>
        <span>{isTauriRuntime() ? "Tauri Desktop" : "Progressive Web App"}</span>
      </footer>

      {paletteOpen && (
        <div className="palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}>
          <section className="command-palette" role="dialog" aria-modal="true" aria-label={t("命令面板")}>
            <div className="palette-input">
              <Search />
              <input autoFocus value={paletteSearch} onChange={(event) => setPaletteSearch(event.target.value)} placeholder={t("输入工具名称…")} />
              <kbd>Esc</kbd>
            </div>
            <div className="palette-results">
              {commands.map((command, index) => (
                <button key={command.id} onClick={() => { navigate(command.id); setPaletteOpen(false); setPaletteSearch(""); }}>
                  <span>{command.icon}</span>
                  <div><strong>{t("打开")} {command.label}</strong><small>{command.section === "tools" ? t("工作工具") : t("资料库与设置")}</small></div>
                  <kbd>Alt {index + 1}</kbd>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
