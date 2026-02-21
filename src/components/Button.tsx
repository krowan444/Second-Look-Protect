import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'md' | 'lg';

interface ButtonBaseProps {
    variant?: ButtonVariant;
    size?: ButtonSize;
    children: React.ReactNode;
    className?: string;
    as?: 'button' | 'a';
    href?: string;
    onClick?: React.MouseEventHandler;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    'aria-label'?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-[#0B1E36] text-white hover:bg-[#142840] border border-transparent',
    secondary: 'bg-transparent text-[#0B1E36] border-2 border-[#0B1E36] hover:bg-[#0B1E36] hover:text-white',
    ghost: 'bg-white/10 text-white border border-white/30 hover:bg-white/20',
};

const sizeClasses: Record<ButtonSize, string> = {
    md: 'px-7 py-3 text-base min-h-[48px]',
    lg: 'px-10 py-4 text-lg min-h-[56px]',
};

export function Button({
    variant = 'primary',
    size = 'md',
    children,
    className = '',
    as: Tag = 'button',
    href,
    onClick,
    type = 'button',
    disabled,
    'aria-label': ariaLabel,
}: ButtonBaseProps) {
    const classes = [
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg',
        'transition-all duration-200 cursor-pointer',
        'active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C] focus-visible:ring-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        className,
    ].join(' ');

    if (Tag === 'a' && href) {
        return (
            <a href={href} className={classes} aria-label={ariaLabel} onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}>
                {children}
            </a>
        );
    }

    return (
        <button
            type={type}
            className={classes}
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
        >
            {children}
        </button>
    );
}
