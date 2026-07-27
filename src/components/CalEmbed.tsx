import { useEffect, useRef, useState } from "react";

/* The official Cal.com embed bootstrap, injected verbatim so its behaviour
   matches Cal's own docs exactly. It defines window.Cal and lazy-loads the
   real embed script on first use. */
const BOOTSTRAP =
  '(function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; ' +
  'C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { ' +
  'cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; ' +
  'cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; ' +
  'const namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { ' +
  'cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); ' +
  'p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })' +
  '(window, "https://app.cal.com/embed/embed.js", "init");';

const SCRIPT_ID = "cal-embed-bootstrap";

function ensureCalLoaded() {
  if (typeof window === "undefined") return;
  if ((window as any).Cal) return;
  if (document.getElementById(SCRIPT_ID)) return;
  const s = document.createElement("script");
  s.id = SCRIPT_ID;
  s.type = "text/javascript";
  s.textContent = BOOTSTRAP;
  document.head.appendChild(s);
}

type Props = {
  /* "username/event-slug" — e.g. "kieran-rowan-tiujdp/60-minute-ai-scam-safety-session" */
  calLink: string;
  namespace?: string;
  minHeight?: number;
  onReady?: () => void;
};

/**
 * Inline Cal.com booking widget. The visitor picks a slot and pays by card
 * inside this box — they never leave the site.
 */
export default function CalEmbed({ calLink, namespace = "slp", minHeight = 640, onReady }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    ensureCalLoaded();
    const Cal = (window as any).Cal;
    const el = ref.current;
    if (!Cal || !el) {
      setFailed(true);
      return;
    }
    try {
      Cal("init", namespace, { origin: "https://app.cal.com" });
      Cal.ns[namespace]("inline", {
        elementOrSelector: el,
        calLink,
        config: { layout: "month_view" },
      });
      Cal.ns[namespace]("ui", {
        hideEventTypeDetails: false,
        layout: "month_view",
        cssVarsPerTheme: { light: { "cal-brand": "#1c3527" } },
      });
      onReady?.();
    } catch {
      setFailed(true);
    }
    return () => {
      if (el) el.innerHTML = "";
    };
  }, [calLink, namespace, onReady]);

  /* If the calendar can't load (blocked script, offline), never leave the
     visitor staring at an empty box — give them a way through. */
  if (failed) {
    return (
      <div className="bg-white border border-gold/20 rounded-2xl p-8 text-center">
        <p className="font-semibold mt-0">The calendar didn't load</p>
        <p className="text-ink/70 text-sm">
          It's usually an ad blocker. You can open the booking page directly instead:
        </p>
        <a
          href={`https://cal.com/${calLink}`}
          target="_blank"
          rel="noopener"
          className="inline-block bg-green text-cream font-semibold px-6 py-3 rounded-full no-underline"
        >
          Open the booking page
        </a>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="w-full overflow-auto rounded-2xl bg-white"
      style={{ minHeight }}
      aria-label="Booking calendar"
    />
  );
}
