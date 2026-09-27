const base =
  "inline-flex items-center justify-center gap-2 font-body font-bold border-2 border-navy rounded-xl transition-all duration-200 ease-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed select-none";

const variants = {
  primary:
    "bg-brand-yellow text-navy shadow-hard hover:shadow-hard-lg hover:-translate-x-0.5 hover:-translate-y-0.5",
  secondary:
    "bg-paper text-navy shadow-hard-sm hover:shadow-hard hover:-translate-x-0.5 hover:-translate-y-0.5",
  success:
    "bg-emerald-500 text-white shadow-hard hover:shadow-hard-lg hover:-translate-x-0.5 hover:-translate-y-0.5",
  danger:
    "bg-red-500 text-white shadow-hard hover:shadow-hard-lg hover:-translate-x-0.5 hover:-translate-y-0.5",
  ghost:
    "bg-transparent text-navy border-navy/20 hover:bg-navy-50",
  deep:
    "bg-brand-yellow-deep text-paper shadow-hard hover:shadow-hard-lg hover:-translate-x-0.5 hover:-translate-y-0.5",
  outline:
    "bg-transparent text-navy border-2 border-navy hover:bg-navy hover:text-white",
};

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-base",
  lg: "px-6 py-3.5 text-lg",
  xl: "px-8 py-4 text-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  return (
    <button
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
