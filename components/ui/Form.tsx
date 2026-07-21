import type {
  HTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from "react";

/**
 * Sahə sarğısı: etiket + nəzarət elementi + kömək/xəta mətni.
 * Etiket CÜMLƏ formasındadır — UPPERCASE işlədilmir.
 */
export function Field({
  label,
  help,
  error,
  required,
  htmlFor,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  label?: ReactNode;
  help?: ReactNode;
  /** Doldurulubsa xəta mətni göstərilir və kömək gizlənir. */
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <div className={["fx-field", className].filter(Boolean).join(" ")} {...rest}>
      {label ? (
        <label className="fx-label" htmlFor={htmlFor}>
          {label}
          {required ? <span style={{ color: "var(--rose)" }}> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <span className="fx-error-text">
          <svg
            className="fx-icon fx-icon--sm"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16.5v.01" />
          </svg>
          {error}
        </span>
      ) : help ? (
        <span className="fx-help">{help}</span>
      ) : null}
    </div>
  );
}

/** Sahələri yan-yana düzən sıra — dar ekranda alt-alta düşür. */
export function FieldRow({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["fx-fieldrow", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

export function Input({
  invalid,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={["fx-input", invalid ? "fx-input--error" : "", className].filter(Boolean).join(" ")}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Select({
  invalid,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={["fx-select", invalid ? "fx-select--error" : "", className].filter(Boolean).join(" ")}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({
  invalid,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={["fx-textarea", invalid ? "fx-textarea--error" : "", className].filter(Boolean).join(" ")}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  const input = <input type="checkbox" className={["fx-checkbox", className].filter(Boolean).join(" ")} {...rest} />;
  if (!label) return input;
  return (
    <label className="fx-choice">
      {input}
      {label}
    </label>
  );
}

export function Radio({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  const input = <input type="radio" className={["fx-radio", className].filter(Boolean).join(" ")} {...rest} />;
  if (!label) return input;
  return (
    <label className="fx-choice">
      {input}
      {label}
    </label>
  );
}

export function Switch({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  const control = (
    <span className={["fx-switch", className].filter(Boolean).join(" ")}>
      <input type="checkbox" {...rest} />
      <span className="fx-switch__track" />
    </span>
  );
  if (!label) return control;
  return (
    <label className="fx-choice">
      {control}
      {label}
    </label>
  );
}

/** İkonlu axtarış sahəsi. */
export function SearchInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={["fx-search", className].filter(Boolean).join(" ")}>
      <svg
        className="fx-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input type="search" {...rest} />
    </div>
  );
}
