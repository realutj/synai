/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--cds-surface-1)',
        surface: 'var(--cds-surface-2)',
        'surface-hover': 'var(--cds-surface-hover)',
        border: 'var(--cds-border)',
        'border-strong': 'var(--cds-border-strong)',
        clay: {
          DEFAULT: 'var(--cds-clay)',
          hover: 'var(--cds-clay-hover)',
          light: 'rgba(56, 189, 248, 0.15)',
        },
        synai: {
          bg: 'var(--cds-surface-1)',
          sidebar: 'var(--cds-surface-2)',
          card: 'var(--cds-surface-3)',
          clay: 'var(--cds-clay)',
          text: 'var(--cds-text-primary)',
          secondary: 'var(--cds-text-secondary)',
          muted: 'var(--cds-text-muted)',
          border: 'var(--cds-border)',
        },
        accent: {
          DEFAULT: 'var(--accent-cyan)',
          dim: 'var(--text-muted)',
        },
        obsidian: {
          900: '#000000',
          800: '#080808',
          700: '#0f0f0f',
          600: '#141414',
          500: '#1a1a1a',
        },
        glow: {
          cyan: 'var(--accent-cyan)',
          purple: 'var(--accent-purple)',
          blue: 'var(--accent-blue)',
        }
      },
      fontFamily: {
        serif: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Fira Code"', '"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        composer: '0 0.25rem 1.25rem rgba(0,0,0,0.5), 0 0 0 1px var(--cds-border)',
        'composer-focus': '0 0.25rem 1.25rem rgba(56, 189, 248, 0.2), 0 0 0 1px var(--cds-clay)',
        glow: '0 0 0 1px rgba(56, 189, 248, 0.3), 0 8px 24px rgba(0,0,0,0.5)',
        'glow-sm': 'var(--shadow-glow-sm)',
        'glow-md': 'var(--shadow-glow-md)',
        'glow-lg': 'var(--shadow-glow-lg)',
        'glow-cyan': '0 0 20px rgba(56, 189, 248, 0.4)',
        'glow-purple': '0 0 20px rgba(167, 139, 250, 0.4)',
      },
      animation: {
        'float': 'orb-float 12s ease-in-out infinite',
        'pulse-glow': 'status-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite',
        'gradient-shift': 'mesh-shift 20s ease infinite',
        'fade-in': 'fade-in 0.5s ease forwards',
        'slide-up': 'slide-up 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
      backgroundImage: {
        'glass': 'var(--glass-bg)',
        'glass-heavy': 'var(--glass-bg-heavy)',
        'accent-gradient': 'var(--accent-gradient)',
      }
    },
  },
  plugins: [],
};
