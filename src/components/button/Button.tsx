import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "tertiary";
};

export const Button = ({
  children,
  className,
  disabled,
  variant = "secondary",
  ...props
}: ButtonProps) => {
  return (
    <button
      className={cn(
        "btn add-focus group interactive flex w-max shrink-0 items-center justify-center font-medium select-none",
        {
          "btn-primary": variant === "primary",
          "btn-secondary": variant === "secondary",
          "btn-tertiary": variant === "tertiary",
          "btn-ghost": variant === "ghost",
          "btn-destructive": variant === "destructive",
          "add-disable": disabled,
        },
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
