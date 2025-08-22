// src/App.tsx
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import CardsPage from "./pages/Cards";

export default function App() {
  return (
    <BrowserRouter>
      <div className="p-4 border-b">
        <nav className="flex gap-4">
          <Link to="/" className="font-semibold">Home</Link>
          <Link to="/cards">Cards</Link>
        </nav>
      </div>
      <Routes>
        <Route path="/" element={<div className="p-6">Welcome</div>} />
        <Route path="/cards" element={<CardsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
