import type { PropsWithChildren, ReactNode } from "react";
import { X } from "lucide-react";
import { translate as t } from "../i18n";

export function Button({ children, variant = "secondary", size = "normal", className = "", ...props }: PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "normal" | "small" }>) {
  return <button className={`btn btn-${variant} ${size === "small" ? "btn-sm" : ""} ${className}`} {...props}>{children}</button>;
}

export function Badge({ children, tone = "muted" }: PropsWithChildren<{ tone?: "muted" | "success" | "warning" | "danger" | "accent" }>) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><strong>{title}</strong><p>{description}</p>{action}</div>;
}

export function PanelHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return <div className="panel-header"><div><strong>{title}</strong>{meta && <span className="panel-meta">{meta}</span>}</div><div className="panel-actions">{actions}</div></div>;
}

export function Modal({ open, title, children, onClose, footer }: PropsWithChildren<{ open: boolean; title: string; onClose: () => void; footer?: ReactNode }>) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label={t("关闭")}><X size={17} /></button></header><div className="modal-body">{children}</div>{footer && <footer>{footer}</footer>}</section></div>;
}

export function Field({ label, hint, children, className = "" }: PropsWithChildren<{ label: string; hint?: string; className?: string }>) {
  return <label className={`form-field ${className}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string }) {
  return <label className="toggle-row"><span><strong>{label}</strong>{description && <small>{description}</small>}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></label>;
}