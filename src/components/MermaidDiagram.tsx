import {useEffect, useRef, useState} from 'react';

import styles from './styles.module.scss';

type MermaidApi = typeof import('mermaid').default;

let mermaidPromise: Promise<MermaidApi> | null = null;

/** Loaded on first use so the ~1 MB diagram engine never blocks the board. */
function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then((module) => module.default);
  return mermaidPromise;
}

export function MermaidDiagram({
  source,
  dark,
}: {
  source: string;
  dark: boolean;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`kanban-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const mermaid = await loadMermaid();
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: dark ? 'dark' : 'default',
        });
        const rendered = await mermaid.render(idRef.current, source);
        if (cancelled) return;
        setSvg(rendered.svg);
        setError(null);
      } catch (renderError) {
        if (cancelled) return;
        // Mermaid leaves a detached error node behind on failure.
        document.querySelector(`#d${idRef.current}`)?.remove();
        setError((renderError as Error).message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, dark]);

  if (error) {
    return (
      <div className={styles.diagramError} role="alert">
        <strong>Mermaid could not render this diagram.</strong>
        <pre>{error}</pre>
      </div>
    );
  }

  if (svg === null) {
    return <p className={styles.diagramLoading}>Rendering diagram…</p>;
  }

  return (
    <div
      className={styles.diagramSvg}
      // Mermaid output is sanitised by its own strict security level.
      dangerouslySetInnerHTML={{__html: svg}}
    />
  );
}
