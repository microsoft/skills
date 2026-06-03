# Widget Patterns

## Table of Contents
- [Required Dependencies](#required-dependencies)
- [Widget Template](#widget-template)
- [Data Access Pattern](#data-access-pattern)
- [Theme Support Pattern](#theme-support-pattern)
- [CSS Variables (Required)](#css-variables-required)
- [Debug Data Pattern](#debug-data-pattern)
- [XSS Prevention](#xss-prevention)
- [Action Buttons](#action-buttons)

React widgets for OpenAI Apps SDK with Copilot Chat.

MANDATORY: Use Fluent UI (`@fluentui/react-components` and `@fluentui/react-icons`) for widget UI. Avoid raw HTML string rendering for app content.

## Required Dependencies

Widget projects MUST include these package dependencies before implementation:

- `@fluentui/react-components`
- `@fluentui/react-icons`
- `react`
- `react-dom`

If any required dependency is missing, install it before generating widget code.

## Widget Template

```tsx
// index.html (minimal shell)
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Widget Name</title>
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; height: 100%; }
    #root { height: 100%; overflow-y: auto; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>

// main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { Widget } from "./Widget";
import { useOpenAiGlobal } from "../hooks/useOpenAiGlobal";

function App() {
  const theme = (useOpenAiGlobal<string>("theme") ?? "light").toLowerCase();
  return (
    <FluentProvider theme={theme === "dark" ? webDarkTheme : webLightTheme}>
      <Widget />
    </FluentProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

// Widget.tsx
import React from "react";
import {
  Body1,
  Card,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Title3,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useOpenAiGlobal } from "../hooks/useOpenAiGlobal";

type WidgetData = {
  title?: string;
  items?: Array<{ name: string; value: string }>;
};

const useStyles = makeStyles({
  root: { padding: "16px", display: "grid", gap: "12px" },
  empty: { color: tokens.colorNeutralForeground3 },
});

export function Widget() {
  const styles = useStyles();
  const data = useOpenAiGlobal<WidgetData>("toolOutput") ?? { title: "Untitled", items: [] };

  if (!data.items?.length) {
    return <div className={styles.root}><Body1 className={styles.empty}>No items</Body1></div>;
  }

  return (
    <div className={styles.root}>
      <Title3>{data.title ?? "Untitled"}</Title3>
      <Card>
        <Table size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Value</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell><TableCellLayout>{item.name}</TableCellLayout></TableCell>
                <TableCell>{item.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
```

## Data Access Pattern

```tsx
import { useEffect, useState } from "react";

type OpenAIKey =
  | "toolOutput"
  | "widgetState"
  | "structuredContent"
  | "data"
  | "theme"
  | "displayMode";

declare global {
  interface Window {
    openai?: Record<string, unknown>;
  }
}

export function useOpenAiGlobal<T = unknown>(key: OpenAIKey): T | undefined {
  const [value, setValue] = useState<T | undefined>(() => window.openai?.[key] as T | undefined);

  useEffect(() => {
    const id = setInterval(() => {
      const next = window.openai?.[key] as T | undefined;
      setValue((prev) => (JSON.stringify(prev) !== JSON.stringify(next) ? next : prev));
    }, 200);

    return () => clearInterval(id);
  }, [key]);

  return value;
}

// Priority order for widget content data
const data = useOpenAiGlobal("toolOutput") ??
             useOpenAiGlobal("widgetState") ??
             useOpenAiGlobal("structuredContent") ??
             useOpenAiGlobal("data");
```

## Theme Support Pattern

```tsx
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";

function ThemedRoot({ children }: { children: React.ReactNode }) {
  const theme = (window.openai?.theme as string | undefined)?.toLowerCase() ?? "light";

  return (
    <FluentProvider theme={theme === "dark" ? webDarkTheme : webLightTheme}>
      {children}
    </FluentProvider>
  );
}
```

## CSS Variables (Required)

Use Fluent tokens first. If custom CSS is needed, keep variables at `:root` and support dark mode:

```css
:root {
  --widget-surface: #f9fafb;
  --widget-card-bg: #ffffff;
  --widget-border: #e5e7eb;
}

@media (prefers-color-scheme: dark) {
  :root {
    --widget-surface: #1b1b1b;
    --widget-card-bg: #262626;
    --widget-border: #3f3f46;
  }
}

body.theme-dark { /* Same as dark :root */ }
body.theme-light { /* Same as light :root */ }
```

## Debug Data Pattern

Always include fallback data for local testing:

```tsx
const DEBUG_DATA = {
  title: "Debug Mode",
  items: [{ name: "Test Item", value: "Test Value" }],
};

function getWidgetData() {
  if (window.openai) {
    return window.openai.toolOutput ||
           window.openai.widgetState ||
           window.openai.structuredContent ||
           window.openai.data ||
           null;
  }

  return DEBUG_DATA;
}
```

## XSS Prevention

Prefer React rendering over `innerHTML`. React escapes text content by default:

```tsx
// Safe by default in React
<Body1>{userData}</Body1>

// Avoid raw HTML unless trusted and sanitized first
// <div dangerouslySetInnerHTML={{ __html: trustedHtml }} />
```

## Action Buttons

```tsx
import { Button } from "@fluentui/react-components";

<Button appearance="primary" as="a" href={`mailto:${email}`}>
  Email
</Button>

<Button
  appearance="outline"
  as="a"
  target="_blank"
  href={`https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}`}
>
  Chat
</Button>
```
