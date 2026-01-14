import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./test-supabase";

createRoot(document.getElementById("root")!).render(<App />);
