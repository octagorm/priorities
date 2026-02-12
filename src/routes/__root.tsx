import { useState } from "react";
import { createRootRoute, Outlet, Link } from "@tanstack/react-router";
import { PinAuth } from "../components/PinAuth";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const [authed, setAuthed] = useState(
    () => localStorage.getItem("priorities_auth") === "true"
  );

  if (!authed) {
    return <PinAuth onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-full flex flex-col">
      <nav className="fixed top-0 left-0 right-0 z-10 bg-base-950/90 backdrop-blur border-b border-base-800 px-4 py-2.5 flex justify-around max-w-lg mx-auto">
        <Link to="/" className="text-base-500 [&.active]:text-base-100 text-sm">
          Home
        </Link>
        <Link
          to="/history"
          className="text-base-500 [&.active]:text-base-100 text-sm"
        >
          History
        </Link>

      </nav>
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-12 pb-4">
        <Outlet />
      </main>
    </div>
  );
}
