import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Quaykeeper — Your self-hosted harbor for everything that ships.',
    description:
        'One control plane for static sites, reverse proxies, databases, TLS certificates, app configuration, and scheduled operations — all behind a single GitHub login, all on infrastructure you own.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>{children}</body>
        </html>
    );
}
