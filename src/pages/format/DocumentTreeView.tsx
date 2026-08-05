import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { translate as t } from "../../i18n";

interface DocumentTreeViewProps {
  value: unknown;
}

interface DocumentTreeNodeProps {
  name: string;
  value: unknown;
}

function valueClassName(value: unknown): string {
  if (value === null) return "tree-type-null";
  if (typeof value === "string") return "tree-type-str";
  if (typeof value === "number") return "tree-type-num";
  if (typeof value === "boolean") return "tree-type-bool";
  return "";
}

function formatPrimitive(value: unknown): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

function DocumentTreeNode({ name, value }: DocumentTreeNodeProps) {
  const isContainer = value !== null && typeof value === "object";
  const entries = isContainer ? Object.entries(value as Record<string, unknown>) : [];
  const canCollapse = entries.length > 0;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="tree-node" role="treeitem" aria-expanded={canCollapse ? !collapsed : undefined}>
      <div className="tree-row">
        {canCollapse ? (
          <button
            type="button"
            className="tree-toggle"
            aria-expanded={!collapsed}
            aria-label={`${t(collapsed ? "展开节点" : "折叠节点")} ${name}`}
            onClick={() => setCollapsed((current) => !current)}
          >
            {collapsed ? <ChevronRight /> : <ChevronDown />}
          </button>
        ) : (
          <span className="tree-toggle tree-toggle-placeholder" aria-hidden="true" />
        )}
        <span className="tree-key">{name}</span>
        {isContainer ? (
          <span className="tree-arr">{Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}</span>
        ) : (
          <span className={`tree-val ${valueClassName(value)}`}>{formatPrimitive(value)}</span>
        )}
      </div>
      {canCollapse && !collapsed ? (
        <div className="tree-children" role="group">
          {entries.map(([key, child]) => (
            <DocumentTreeNode key={key} name={Array.isArray(value) ? `[${key}]` : key} value={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DocumentTreeView({ value }: DocumentTreeViewProps) {
  return (
    <div className="tree-view" role="tree" aria-label={t("树形")}>
      <DocumentTreeNode name="$" value={value} />
    </div>
  );
}
