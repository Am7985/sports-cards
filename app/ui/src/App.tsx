// app/ui/src/App.tsx
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import CardsPage from "./pages/Cards";
import OwnershipPage from "./pages/Ownership";
import WishlistPage from "./pages/Wishlist"; // ✨ new

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-neutral-800">
          <nav className="mx-auto max-w-6xl w-full px-4 h-12 flex items-center gap-4 text-sm">
            <NavLink to="/" end className={({isActive}) => isActive ? "text-white font-medium" : "text-neutral-300 hover:text-neutral-100"}>Home</NavLink>
            <NavLink to="/cards" className={({isActive}) => isActive ? "text-white" : "text-neutral-300 hover:text-neutral-100"}>Card Database</NavLink>
            <NavLink to="/ownership" className={({isActive}) => isActive ? "text-white" : "text-neutral-300 hover:text-neutral-100"}>My Collection</NavLink>
            <NavLink to="/wishlist" className={({isActive}) => isActive ? "text-white" : "text-neutral-300 hover:text-neutral-100"}>My Wishlist</NavLink>
          </nav>
        </header>

        <main className="flex-1">
          <ScrollToTop />
          <Routes>
            <Route
              path="/"
              element={
                <div className="mx-auto max-w-6xl px-4 pt-6">
                  <h1 className="text-3xl font-semibold">Sports Cards</h1>
                  <p className="mt-2 text-neutral-400">Track your collection, images, and wishlist.</p>
                  <div className="mt-6 flex gap-3">
                    <Link to="/cards" className="inline-flex items-center rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-sm hover:bg-blue-500">Open Card Database</Link>
                    <Link to="/ownership" className="inline-flex items-center rounded-md border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-750">Go to My Collection</Link>
                    <Link to="/wishlist" className="inline-flex items-center rounded-md border border-pink-600 bg-pink-600 px-4 py-2 text-sm hover:bg-pink-500">View My Wishlist</Link>
                  </div>
                </div>
              }
            />
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/ownership" element={<OwnershipPage />} />
            <Route path="/wishlist" element={<WishlistPage />} /> {/* ✨ new */}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
