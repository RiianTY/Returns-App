import "./App.css";
import { Routes, Route } from "react-router-dom";
import { AuthGuard } from "./components/auth-guard";
import Overstock from "./pages/overstock.tsx";
import Damages from "./pages/damages.tsx";
import Sales from "./pages/sales.tsx";
import IndexPage from "./index.tsx";
import { Toaster } from "./components/ui/sonner";
import Final from "./pages/final.tsx";

function App() {
  return (
    <>
      <Routes>
        <Route element={<IndexPage />} path="/" />
        <Route element={<AuthGuard><Overstock /></AuthGuard>} path="/overstock" />
        <Route element={<AuthGuard><Damages /></AuthGuard>} path="/damages" />
        <Route element={<AuthGuard><Sales /></AuthGuard>} path="/sales" />
        <Route element={<AuthGuard><Final /></AuthGuard>} path="/final" />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
