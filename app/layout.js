import "./globals.css";

export const metadata = {
  title: "Red Horizon · Mars Agentic Travel",
  description: "Multi-agent Mars travel booking demo with RAG, MCP, Groq and agentic DevOps",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
