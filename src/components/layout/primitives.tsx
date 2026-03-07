import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ShellProps = {
  children: ReactNode;
  className?: string;
};

export function PageShell({ children, className }: ShellProps) {
  return <div className={cn("page-shell", className)}>{children}</div>;
}

export function HeroBlock({ children, className }: ShellProps) {
  return <section className={cn("hero-block", className)}>{children}</section>;
}

export function SectionShell({ children, className }: ShellProps) {
  return <section className={cn("section-shell", className)}>{children}</section>;
}

export function ActionBar({ children, className }: ShellProps) {
  return <section className={cn("action-bar", className)}>{children}</section>;
}

export function EmptyState({ children, className }: ShellProps) {
  return <section className={cn("empty-state", className)}>{children}</section>;
}

export function StatCard({ children, className }: ShellProps) {
  return <section className={cn("stat-card", className)}>{children}</section>;
}

export function FilterChips({ children, className }: ShellProps) {
  return <div className={cn("chip-row", className)}>{children}</div>;
}

export function FilterChip({
  children,
  className,
  active = false,
}: ShellProps & { active?: boolean }) {
  return (
    <span className={cn("chip", active ? "chip--active" : "", className)}>
      {children}
    </span>
  );
}

export function FormRow({ children, className }: ShellProps) {
  return <div className={cn("form-row", className)}>{children}</div>;
}

export function StatusNote({
  children,
  className,
  tone = "neutral",
}: ShellProps & { tone?: "neutral" | "success" | "warning" | "error" }) {
  return <p className={cn("status-note", `status-note--${tone}`, className)}>{children}</p>;
}
