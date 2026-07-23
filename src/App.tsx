import { useEffect, useState } from "react";
import Home from "./pages/Home";
import CheckForm from "./pages/CheckForm";
import Admin from "./pages/Admin";
import About from "./pages/About";

/** Tiny path router — Vercel rewrites all paths to index.html. */
export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  if (path.startsWith("/check")) return <CheckForm />;
  if (path.startsWith("/admin")) return <Admin />;
  if (path.startsWith("/about")) return <About />;
  return <Home />;
}
