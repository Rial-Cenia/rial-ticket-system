import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const variants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white hover:bg-blue-500',
        secondary: 'bg-white/8 text-zinc-100 hover:bg-white/12',
        outline:
          'border border-white/12 bg-transparent text-zinc-200 hover:bg-white/6',
        danger: 'bg-red-600 text-white hover:bg-red-500',
        ghost: 'text-zinc-300 hover:bg-white/7 hover:text-white',
      },
      size: { default: 'h-10 px-4', sm: 'h-8 px-3', icon: 'size-9' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

interface Props
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variants> {
  asChild?: boolean;
}

export function Button({ asChild, className, variant, size, ...props }: Props) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      className={cn(variants({ variant, size }), className)}
      {...props}
    />
  );
}
