import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'forest-green': '#00330a',
        'gold': '#D4AF37',
        'cream': '#FFF8DC',
        'sage': '#87A96B',
        'blush': '#F4E4E0',
        'champagne': '#F7E7CE',
        'burgundy': '#800020',
        'pearl': '#F8F6F0',
      },
      fontFamily: {
        'playfair': ['var(--font-playfair)', 'serif'],
        'montserrat': ['var(--font-montserrat)', 'sans-serif'],
        'cormorant': ['var(--font-cormorant)', 'serif'],
        'serif': ['var(--font-playfair)', 'serif'],
        'sans': ['var(--font-montserrat)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
