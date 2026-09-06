import * as React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || React.useId();
    return (
      <div>
        {label ? (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={`input ${error ? '!border-[#FF3366] !shadow-[0_0_12px_rgba(255,51,102,0.25)]' : ''} ${className}`}
          {...props}
        />
        {error ? <p className="mt-1 text-[11px] font-medium text-[#FF3366]">{error}</p> : null}
        {hint && !error ? <p className="mt-1 text-[11px] text-[#A8B3C7]">{hint}</p> : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...props }, ref) => {
    const id = React.useId();
    return (
      <div>
        {label ? (
          <label htmlFor={id} className="label">
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={id}
          className={`input min-h-[120px] resize-y ${error ? '!border-[#FF3366] !shadow-[0_0_12px_rgba(255,51,102,0.25)]' : ''} ${className}`}
          {...props}
        />
        {error ? <p className="mt-1 text-[11px] font-medium text-[#FF3366]">{error}</p> : null}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
