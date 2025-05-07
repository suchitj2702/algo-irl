'use client';

interface BadgeProps {
  variant?: 'success' | 'error' | 'warning' | 'info' | 'default';
  children: React.ReactNode;
  className?: string;
}

export default function Badge({
  variant = 'default',
  children,
  className = '',
}: BadgeProps) {
  // Variant styles
  const variantStyles = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
    default: 'bg-gray-100 text-gray-800',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
} 