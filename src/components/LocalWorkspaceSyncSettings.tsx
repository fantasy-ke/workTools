import { useEffect, useState } from "react";
import { FolderOpen, Unlink } from "lucide-react";
import { Button, Toggle } from "./ui";
import { useToast } from "./Toast";
import { useAppStore } from "../store/appStore";
import { isTauriRuntime } from "../platform/files";
import {
  chooseLocalWorkspaceSyncDirectory,
  clearLocalWorkspaceSyncDirectory,
  getLocalWorkspaceSyncDirectory,
  isLocalWorkspaceSyncSupported,
} from "../platform/workspaceSync";
import { translate as t } from "../i18n";

export function LocalWorkspaceSyncSettings() {
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const { notify } = useToast();
  const [directoryName, setDirectoryName] = useState<string>();

  useEffect(() => {
    if (!isLocalWorkspaceSyncSupported()) return;
    void getLocalWorkspaceSyncDirectory()
      .then((directory) => setDirectoryName(directory?.directoryName))
      .catch(() => notify(t("读取本地保存目录失败"), "error"));
  }, [notify]);

  if (isTauriRuntime()) return null;

  if (!isLocalWorkspaceSyncSupported()) {
    return <div className="info-card"><FolderOpen /><div><strong>{t("当前浏览器不支持自动写入本地文件夹")}</strong><p>{t("请使用 Chrome 或 Edge，或通过导出工作包保存文件")}</p></div></div>;
  }

  const chooseDirectory = async () => {
    try {
      const directory = await chooseLocalWorkspaceSyncDirectory();
      if (!directory) return;
      setDirectoryName(directory.directoryName);
      notify(t("本地目录已绑定") + "：" + directory.directoryName);
    } catch {
      notify(t("选择本地保存目录失败"), "error");
    }
  };

  const clearDirectory = async () => {
    try {
      await clearLocalWorkspaceSyncDirectory();
      setDirectoryName(undefined);
      notify(t("本地目录绑定已取消"));
    } catch {
      notify(t("取消本地目录绑定失败"), "error");
    }
  };

  return <>
    <Toggle
      checked={settings.syncWorkspaceToLocalFile}
      onChange={(value) => {
        void updateSettings({ syncWorkspaceToLocalFile: value }).catch(() => notify(t("保存设置失败"), "error"));
      }}
      label={t("保存工作区时同步到本地文件")}
      description={t("首次选择目录后，后续保存会自动更新对应的 .apiwork 文件")}
    />
    <div className="setting-row">
      <div className="s-label"><strong>{t("本地保存目录")}</strong><div className="s-desc">{directoryName ? t("当前目录") + "：" + directoryName : t("尚未选择本地保存目录")}</div></div>
      <div className="toolbar-group">
        <Button size="small" onClick={() => void chooseDirectory()}><FolderOpen />{directoryName ? t("更换目录") : t("选择目录")}</Button>
        {directoryName && <Button size="small" variant="ghost" onClick={() => void clearDirectory()}><Unlink />{t("取消绑定")}</Button>}
      </div>
    </div>
  </>;
}
