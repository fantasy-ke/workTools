import { useEffect, useState } from "react";
import { FolderOpen, Unlink } from "lucide-react";
import { Button } from "./ui";
import { useToast } from "./Toast";
import { useAppStore } from "../store/appStore";
import {
  chooseLocalWorkspaceSyncDirectory,
  clearLocalWorkspaceSyncDirectory,
  getLocalWorkspaceSyncDirectory,
  isLocalWorkspaceSyncSupported,
} from "../platform/workspaceSync";
import { translate as t } from "../i18n";

export function LocalWorkspaceSyncSettings() {
  const initialize = useAppStore((state) => state.initialize);
  const workspaceFileError = useAppStore((state) => state.workspaceFileError);
  const { notify } = useToast();
  const [directoryName, setDirectoryName] = useState<string>();

  useEffect(() => {
    if (!isLocalWorkspaceSyncSupported()) return;
    void getLocalWorkspaceSyncDirectory()
      .then((directory) => setDirectoryName(directory?.directoryName))
      .catch(() => notify(t("读取本地保存目录失败"), "error"));
  }, [notify]);

  if (!isLocalWorkspaceSyncSupported()) {
    return <div className="info-card"><FolderOpen /><div><strong>{t("当前浏览器不支持自动写入本地文件夹")}</strong><p>{t("请使用 Chrome 或 Edge，或通过导出工作包保存文件")}</p></div></div>;
  }

  const chooseDirectory = async () => {
    try {
      const directory = await chooseLocalWorkspaceSyncDirectory();
      if (!directory) return;
      setDirectoryName(directory.directoryName);
      await initialize();
      const error = useAppStore.getState().workspaceFileError;
      if (error) {
        notify(t(error), "error");
        return;
      }
      notify(t("本地目录已绑定并完成工作区文件读取与初始化") + "：" + directory.directoryName);
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
    <div className="info-card"><FolderOpen /><div><strong>{t("本地工作区文件存储")}</strong><p>{t("选择本地目录后，每个工作区会保存为独立的 .apiwork 文件，并在启动时从该目录读取")}</p><p>{t("本地工作区文件未加密，请选择可信目录")}</p></div></div>
    {workspaceFileError && <div className="storage-warning">{t(workspaceFileError)}</div>}
    <div className="setting-row">
      <div className="s-label"><strong>{t("本地保存目录")}</strong><div className="s-desc">{directoryName ? t("当前目录") + "：" + directoryName : t("尚未选择本地保存目录")}</div></div>
      <div className="toolbar-group">
        <Button size="small" onClick={() => void chooseDirectory()}><FolderOpen />{directoryName ? t("更换目录") : t("选择目录")}</Button>
        {directoryName && <Button size="small" variant="ghost" onClick={() => void clearDirectory()}><Unlink />{t("取消绑定")}</Button>}
      </div>
    </div>
  </>;
}
