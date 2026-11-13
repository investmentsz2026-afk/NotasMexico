import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        institutional: {
          navy: '#0F172A',
          slate: '#1E293B',
          muted: '#64748B',
          border: '#E2E8F0',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          accent: '#1E3A8A',
          highlight: '#2563EB',
          success: '#059669',
          warning: '#D97706',
          danger: '#DC2626',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
