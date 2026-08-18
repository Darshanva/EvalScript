import React, { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';

// ── Badge ────────────────────────────────────────────────────────────────────

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'navy'
  | 'gold'
  | 'muted';

const badgeClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  navy: 'bg-navy-100 text-navy-800',
  gold: 'bg-gold-100 text-gold-700',
  muted: 'bg-slate-50 text-slate-500',
};

export function Badge({
  children,
  variant = 'default',
  className = '',
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIGS: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Draft', variant: 'muted' },
  SUBMITTED: { label: 'Submitted', variant: 'info' },
  PROCESSING: { label: 'Processing', variant: 'info' },
  AI_COMPLETE: { label: 'AI Complete', variant: 'navy' },
  FACULTY_REVIEW: { label: 'Pending Review', variant: 'warning' },
  REVIEWED: { label: 'Reviewed', variant: 'gold' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'danger' },
  NEEDS_REVIEW: { label: 'Needs Review', variant: 'danger' },
  ACTIVE: { label: 'Active', variant: 'success' },
  CLOSED: { label: 'Closed', variant: 'muted' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  PENDING: { label: 'Pending', variant: 'warning' },
  HIGH: { label: 'High', variant: 'success' },
  MEDIUM: { label: 'Medium', variant: 'warning' },
  LOW: { label: 'Low', variant: 'danger' },
  OPEN: { label: 'Open', variant: 'warning' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'info' },
  RESOLVED: { label: 'Resolved', variant: 'success' },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = STATUS_CONFIGS[status] ?? { label: status, variant: 'default' as BadgeVariant };
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

// ── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'gold' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 disabled:bg-navy-200 disabled:text-navy-400',
  secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-50',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50',
  gold: 'bg-gold-600 text-white hover:bg-gold-700 active:bg-gold-800 disabled:opacity-50',
  outline: 'bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 cursor-pointer select-none ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
    >
      {loading ? <Spinner size="sm" /> : icon}
      {children}
    </button>
  );
}

// ── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={`h-10 px-3 rounded-lg border text-sm bg-white text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-700 focus:border-navy-700 ${error ? 'border-red-400 bg-red-50' : 'border-slate-300'} ${className}`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        {...props}
        className={`px-3 py-2.5 rounded-lg border text-sm bg-white text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-700 focus:border-navy-700 resize-none ${error ? 'border-red-400 bg-red-50' : 'border-slate-300'} ${className}`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className = '', id, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        id={inputId}
        {...props}
        className={`h-10 px-3 rounded-lg border text-sm bg-white text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-700 focus:border-navy-700 ${error ? 'border-red-400' : 'border-slate-300'} ${className}`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

export function Card({
  children,
  className = '',
  padding = true,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 shadow-sm ${padding ? 'p-6' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <Card className="flex items-start gap-4">
      {icon && (
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent ?? 'bg-navy-50 text-navy-700'}`}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-semibold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

// ── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  return (
    <svg
      className={`animate-spin ${s} text-current`}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ── Progress Bar ─────────────────────────────────────────────────────────────

export function ProgressBar({
  value,
  max = 100,
  color = 'navy',
}: {
  value: number;
  max?: number;
  color?: 'navy' | 'gold' | 'emerald' | 'red' | 'amber';
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const trackColor = {
    navy: 'bg-navy-900',
    gold: 'bg-gold-500',
    emerald: 'bg-emerald-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
  }[color];
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${trackColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Confidence Badge ─────────────────────────────────────────────────────────

export function ConfidenceBadge({ level, score }: { level: string; score: number }) {
  const config: Record<string, { color: string; bg: string; label: string }> = {
    HIGH: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: 'High' },
    MEDIUM: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Medium' },
    LOW: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Low' },
  };
  const c = config[level] ?? config.MEDIUM;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${c.bg} ${c.color}`}
    >
      <span className="font-mono">{Math.round(score * 100)}%</span>
      <span>{c.label} Confidence</span>
    </span>
  );
}

// ── Flag Badge ───────────────────────────────────────────────────────────────

const FLAG_LABELS: Record<string, string> = {
  DIAGRAM_DETECTED: '📐 Diagram',
  EQUATION_DETECTED: '∑ Equation',
  TABLE_DETECTED: '⊞ Table',
  UNCLEAR_HANDWRITING: '✎ Unclear Writing',
  LOW_IMAGE_QUALITY: '⚠ Low Quality',
  POSSIBLE_MISSING_TEXT: '? Missing Text',
  QUESTION_MAPPING_UNCERTAIN: '⚡ Mapping Uncertain',
};

export function FlagBadge({ flag }: { flag: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-xs font-medium">
      {FLAG_LABELS[flag] ?? flag}
    </span>
  );
}

// ── Score Bar ────────────────────────────────────────────────────────────────

export function ScoreBar({ awarded, max }: { awarded: number; max: number }) {
  const pct = max > 0 ? (awarded / max) * 100 : 0;
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs text-slate-600 shrink-0">
        {awarded}/{max}
      </span>
    </div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {icon && <div className="text-slate-300 mb-2">{icon}</div>}
      <p className="font-medium text-slate-600">{title}</p>
      {description && <p className="text-sm text-slate-400 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className={`relative bg-white rounded-2xl shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ── Toast ────────────────────────────────────────────────────────────────────

export function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}) {
  const styles = {
    success: 'bg-emerald-900 text-white',
    error: 'bg-red-900 text-white',
    info: 'bg-navy-900 text-white',
  };
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm ${styles[type]}`}
    >
      <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs">
        {icons[type]}
      </span>
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100 ml-1">
        ✕
      </button>
    </div>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────

export function Avatar({
  initials,
  size = 'md',
  color = 'navy',
}: {
  initials: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'navy' | 'gold' | 'slate';
}) {
  const s = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }[size];
  const c = {
    navy: 'bg-navy-100 text-navy-800',
    gold: 'bg-gold-100 text-gold-700',
    slate: 'bg-slate-200 text-slate-700',
  }[color];
  return (
    <div className={`${s} ${c} rounded-full flex items-center justify-center font-semibold shrink-0`}>
      {initials}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {headers.map((h, i) => (
              <th
                key={i}
                className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function TableRow({
  children,
  onClick,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-slate-50 last:border-0 transition-colors ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''} ${className}`}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3.5 text-slate-700 ${className}`}>{children}</td>;
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-slate-200 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${active === tab.key ? 'border-navy-900 text-navy-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full ${active === tab.key ? 'bg-navy-100 text-navy-700' : 'bg-slate-100 text-slate-500'}`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────

export function StepIndicator({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${i < current ? 'bg-navy-900 text-white' : i === current ? 'bg-navy-700 text-white ring-4 ring-navy-100' : 'bg-slate-100 text-slate-400'}`}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium ${i <= current ? 'text-navy-900' : 'text-slate-400'}`}>
              {step}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mb-5 ${i < current ? 'bg-navy-900' : 'bg-slate-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
