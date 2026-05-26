type Props = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 44, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Cursor Hyderabad"
      className={className}
    >
      <defs>
        <linearGradient id="bm-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c5cff" />
          <stop offset="60%" stopColor="#ff5277" />
          <stop offset="100%" stopColor="#f5b042" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0b0d14" />
      <path
        d="M32 10 L54 22 V42 L32 54 L10 42 V22 Z"
        fill="none"
        stroke="url(#bm-grad)"
        strokeWidth={3}
      />
      <path
        d="M32 10 L54 22 L32 34 L10 22 Z"
        fill="url(#bm-grad)"
        opacity={0.9}
      />
    </svg>
  );
}
