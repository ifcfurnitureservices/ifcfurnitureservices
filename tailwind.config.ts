// tailwind.config.ts
const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}", // Add this line!
  ],
  theme: {
    extend: {
      colors: {
        'instafitcore-green': '#8ED26B',
      },
    },
  },
  plugins: [],
};
export default config;