import React from 'react';

export interface SynAILogoProps {
  className?: string;
  size?: number;
  variant?: 'icon' | 'wordmark' | 'full' | 'auto';
  color?: 'cyan' | 'white' | 'black';
  alt?: string;
}

/**
 * SynAI Official Logo Component
 * Renders the official brand wordmark ('synai.') or the brand mark icon ('s.')
 */
export const SynAILogo: React.FC<SynAILogoProps> = ({
  className,
  size,
  variant = 'auto',
  color = 'cyan',
  alt = 'SynAI Logo',
}) => {
  const isWordmark =
    variant === 'wordmark' ||
    variant === 'full' ||
    (variant === 'auto' && (className?.includes('w-auto') || className?.includes('max-w-')));

  const src = isWordmark
    ? color === 'white'
      ? '/logo-white.png'
      : color === 'black'
      ? '/logo-black.png'
      : '/logo-cyan.png'
    : color === 'white'
    ? '/logo-mark-white.png'
    : color === 'black'
    ? '/logo-mark.png'
    : '/logo-mark-cyan.png';

  const defaultClass = isWordmark
    ? 'h-6 w-auto object-contain select-none'
    : 'w-6 h-6 object-contain select-none';

  return (
    <img
      src={src}
      alt={alt}
      className={className || defaultClass}
      style={
        size
          ? isWordmark
            ? { height: size, width: 'auto' }
            : { width: size, height: size }
          : undefined
      }
      draggable={false}
    />
  );
};

