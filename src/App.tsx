import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import Home from "./pages/Home";
import CheckForm from "./pages/CheckForm";
import Admin from "./pages/Admin";
import About from "./pages/About";
import Session from "./pages/Session";
import Talks from "./pages/Talks";
import TalksEnquiry from "./pages/TalksEnquiry";
import TalksThankYou from "./pages/TalksThankYou";
import Protect from "./pages/Protect";

/** Tiny path router — Vercel rewrites all non-API paths to index.html. */
function route(path: string) {
  /* Most specific first: /talks/enquire must win over /talks. */
  if (path.startsWith("/check")) return <CheckForm />;
  if (path.startsWith("/admin")) return <Admin />;
  if (path.startsWith("/about")) return <About />;
  if (path.startsWith("/protect") || path.startsWith("/what-is")) return <Protect />;
  if (path.startsWith("/session") || path.startsWith("/book")) return <Session />;
  if (path.startsWith("/talks/thank-you")) return <TalksThankYou />;
  if (path.startsWith("/talks/enquire") || path.startsWith("/talks/enquiry")) return <TalksEnquiry />;
  if (path.startsWith("/talks")) return <Talks />;
  return <Home />;
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <>
      {route(path)}
      {/* Vercel Analytics — page views, funnel events and Core Web Vitals.
          Both are no-ops in local dev and cost nothing on the client. */}
      <Analytics />
      <SpeedInsights />
    </>
  );
}
