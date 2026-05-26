'use client';

type ConfirmSubmitButtonProps = {
  className?: string;
  confirmMessage: string;
  children: React.ReactNode;
};

export function ConfirmSubmitButton({ className, confirmMessage, children }: ConfirmSubmitButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
