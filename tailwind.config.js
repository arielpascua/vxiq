/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // VXI Brand Color Scheme: 60% Black, 30% Orange, 10% White
        vxi: {
          // Black variants (60% - Primary backgrounds and surfaces)
          black: {
            DEFAULT: '#0A0A0A',
            50: '#1A1A1A',
            100: '#141414',
            200: '#0F0F0F',
            300: '#0A0A0A',
            400: '#050505',
          },
          // Orange variants (30% - CTAs, accents, highlights)
          orange: {
            DEFAULT: '#FF6B35',
            50: '#FFE5DC',
            100: '#FFD4C4',
            200: '#FFB395',
            300: '#FF9266',
            400: '#FF7A4D',
            500: '#FF6B35',
            600: '#FF5214',
            700: '#E63C00',
            800: '#B32F00',
            900: '#802200',
          },
          // White/Gray variants (10% - Text and minimal highlights)
          white: {
            DEFAULT: '#FFFFFF',
            50: '#FFFFFF',
            100: '#F5F5F5',
            200: '#E5E5E5',
            300: '#D4D4D4',
            400: '#A3A3A3',
          },
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
    },
  },
  plugins: [],
}
