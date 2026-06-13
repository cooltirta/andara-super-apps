/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0f766e', // Modern Teal-700
          hover: '#0f5b55',
          light: '#e6f4f2',
          active: '#0d9488',
        },
        secondary: {
          DEFAULT: '#3f5e43', // Earth Green Sage
          hover: '#2f4632',
          light: '#edf1ec',
        },
        forest: {
          DEFAULT: '#022c22', // Forest Dark Green
          black: '#011c16',
        },
        pastel: {
          green: {
            DEFAULT: '#e2f0e9',
            solid: '#58a983',
            text: '#146c43',
          },
          yellow: {
            DEFAULT: '#fef5d9',
            solid: '#f5cc5c',
            text: '#7d6006',
          },
          red: {
            DEFAULT: '#fde8e9',
            solid: '#df6c51',
            text: '#ab2c36',
          }
        },
        grey: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          500: '#64748b',
          700: '#334155',
          900: '#0f172a',
        }
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        sm: '10px',
        md: '18px',
        lg: '26px',
      },
      boxShadow: {
        sm: '0 4px 10px rgba(15, 23, 42, 0.02)',
        md: '0 12px 36px rgba(15, 23, 42, 0.04)',
        lg: '0 24px 64px rgba(15, 23, 42, 0.08)',
        glass: '0 10px 40px 0 rgba(31, 38, 135, 0.05)',
      }
    },
  },
  plugins: [],
}
