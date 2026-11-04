import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Dialog as D, DropdownMenu as DM, Switch as SW } from 'radix-ui';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// shadcn/ui-style primitives on Radix, styled with the SaveSutra tokens.

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-bg hover:opacity-90',
  accent: 'bg-accent text-white hover:bg-accent-hover shadow-[0_8px_24px_rgb(201_62_16/0.28)]',
  outline: 'border border-line bg-surface text-ink hover:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2',
  danger: 'bg-[#B42318] text-white hover:bg-[#9A1C13]',
  soft: 'bg-surface-2 text-ink hover:bg-surface-3',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] rounded-[10px] gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-13 px-5 text-[15px] rounded-2xl gap-2',
  icon: 'h-11 w-11 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant = 'outline', size = 'md', type = 'button', ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-bold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20',
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-24 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] text-ink outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20',
        className,
      )}
      {...props}
    />
  );
});

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1">
      <span className="text-[13px] font-bold text-ink">{children}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Chip({ active, children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
        active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:bg-surface-2',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('text-xs font-extrabold tracking-[0.06em] text-muted uppercase', className)}>{children}</h2>;
}

export function Segmented<T extends string>({ value, onChange, options, label, className }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; icon?: ReactNode }>; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex gap-1 rounded-xl bg-surface-3 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] text-[13px] font-semibold transition-colors',
            value === o.value ? 'bg-surface font-bold text-ink shadow-card' : 'text-ink-2 hover:text-ink',
          )}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onCheckedChange, id, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; id: string; label: string }) {
  return (
    <SW.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className="relative h-7 w-12 shrink-0 rounded-full bg-surface-3 transition-colors data-[state=checked]:bg-success"
    >
      <SW.Thumb className="block h-6 w-6 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </SW.Root>
  );
}

/** Bottom sheet on phones (vaul), the natural pattern for quick actions. */
export function Sheet({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl border border-line bg-surface outline-none">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-surface-3" aria-hidden="true" />
          <div className="overflow-y-auto px-5 pt-3 pb-6 safe-bottom">
            <Drawer.Title className="text-lg font-extrabold tracking-tight">{title}</Drawer.Title>
            {description && <Drawer.Description className="mt-1 text-sm text-muted">{description}</Drawer.Description>}
            <div className="mt-4">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function Modal({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <D.Content className="fixed top-1/2 left-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface p-5 shadow-xl outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-lg font-extrabold tracking-tight">{title}</D.Title>
              {description && <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>}
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close" className="-mt-2 -mr-2">
                <X size={18} />
              </Button>
            </D.Close>
          </div>
          <div className="mt-4">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export const Menu = {
  Root: DM.Root,
  Trigger: DM.Trigger,
  Content({ children, align = 'end' }: { children: ReactNode; align?: 'start' | 'end' }) {
    return (
      <DM.Portal>
        <DM.Content align={align} sideOffset={6} className="z-50 min-w-52 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          {children}
        </DM.Content>
      </DM.Portal>
    );
  },
  Item({ children, onSelect, danger }: { children: ReactNode; onSelect: () => void; danger?: boolean }) {
    return (
      <DM.Item
        onSelect={onSelect}
        className={cn('flex h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold outline-none data-[highlighted]:bg-surface-2', danger ? 'text-[#B42318] dark:text-[#ff8a80]' : 'text-ink')}
      >
        {children}
      </DM.Item>
    );
  },
  Separator() {
    return <DM.Separator className="my-1 h-px bg-line" />;
  },
};

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-ink-2">{icon}</div>
      <h3 className="text-base font-extrabold">{title}</h3>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-3', className)} aria-hidden="true" />;
}
