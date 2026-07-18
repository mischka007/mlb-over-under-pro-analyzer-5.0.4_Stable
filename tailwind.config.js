// Tailwind-Konfiguration: dunkles Terminal-Theme (angelehnt an TradingView / Bloomberg / FanGraphs)
// mit Gold-, Türkis-, Grün- und Rot-Akzenten sowie Glow- und Glassmorphism-Utilities.
export default {
    darkMode: "class",
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                base: {
                    950: "#05070a",
                    900: "#0b0e13",
                    850: "#10141b",
                    800: "#161b24",
                    700: "#1f2530",
                    600: "#2a3140",
                    500: "#3a4356",
                },
                gold: {
                    400: "#f5c451",
                    500: "#eab308",
                    600: "#c9930a",
                    glow: "rgba(234,179,8,0.35)",
                },
                teal: {
                    400: "#2dd4c8",
                    500: "#14b8ac",
                    600: "#0e8a82",
                    glow: "rgba(20,184,172,0.35)",
                },
                posgreen: {
                    400: "#4ade80",
                    500: "#22c55e",
                    600: "#16a34a",
                    glow: "rgba(34,197,94,0.35)",
                },
                negred: {
                    400: "#f87171",
                    500: "#ef4444",
                    600: "#c02f2f",
                    glow: "rgba(239,68,68,0.35)",
                },
            },
            fontFamily: {
                display: ["'Oswald'", "sans-serif"],
                mono: ["'IBM Plex Mono'", "monospace"],
                numeric: ["'Teko'", "sans-serif"],
            },
            boxShadow: {
                "glow-gold": "0 0 24px 0 rgba(234,179,8,0.35)",
                "glow-teal": "0 0 24px 0 rgba(20,184,172,0.35)",
                "glow-green": "0 0 24px 0 rgba(34,197,94,0.35)",
                "glow-red": "0 0 24px 0 rgba(239,68,68,0.35)",
                glass: "0 8px 32px 0 rgba(0,0,0,0.45)",
            },
            backdropBlur: {
                xs: "2px",
            },
            keyframes: {
                "pulse-glow": {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.6" },
                },
                "fade-slide-up": {
                    from: { opacity: "0", transform: "translateY(8px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
            },
            animation: {
                "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
                "fade-slide-up": "fade-slide-up 0.4s ease-out",
            },
        },
    },
    plugins: [],
};
