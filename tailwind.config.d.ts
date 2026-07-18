declare const _default: {
    darkMode: "class";
    content: string[];
    theme: {
        extend: {
            colors: {
                base: {
                    950: string;
                    900: string;
                    850: string;
                    800: string;
                    700: string;
                    600: string;
                    500: string;
                };
                gold: {
                    400: string;
                    500: string;
                    600: string;
                    glow: string;
                };
                teal: {
                    400: string;
                    500: string;
                    600: string;
                    glow: string;
                };
                posgreen: {
                    400: string;
                    500: string;
                    600: string;
                    glow: string;
                };
                negred: {
                    400: string;
                    500: string;
                    600: string;
                    glow: string;
                };
            };
            fontFamily: {
                display: [string, string];
                mono: [string, string];
                numeric: [string, string];
            };
            boxShadow: {
                "glow-gold": string;
                "glow-teal": string;
                "glow-green": string;
                "glow-red": string;
                glass: string;
            };
            backdropBlur: {
                xs: string;
            };
            keyframes: {
                "pulse-glow": {
                    "0%, 100%": {
                        opacity: string;
                    };
                    "50%": {
                        opacity: string;
                    };
                };
                "fade-slide-up": {
                    from: {
                        opacity: string;
                        transform: string;
                    };
                    to: {
                        opacity: string;
                        transform: string;
                    };
                };
            };
            animation: {
                "pulse-glow": string;
                "fade-slide-up": string;
            };
        };
    };
    plugins: never[];
};
export default _default;
