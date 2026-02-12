import { useState } from "react";

const CORRECT_PIN = import.meta.env.VITE_PIN || "1234";

interface PinAuthProps {
  onSuccess: () => void;
}

export function PinAuth({ onSuccess }: PinAuthProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === CORRECT_PIN) {
      localStorage.setItem("priorities_auth", "true");
      onSuccess();
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-950 px-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
        <h1 className="text-2xl font-bold text-base-100 text-center">Priorities</h1>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
          placeholder="PIN"
          autoFocus
          className="bg-base-900 border border-base-700 rounded-lg px-4 py-3 text-base-100 text-center text-lg tracking-widest placeholder:text-base-600 focus:outline-none focus:border-base-500"
        />
        <button
          type="submit"
          className="bg-base-800 hover:bg-base-700 text-base-100 rounded-lg px-4 py-3 text-sm font-medium transition-colors"
        >
          Unlock
        </button>
        {error && (
          <p className="text-red-400 text-sm text-center">Wrong PIN</p>
        )}
      </form>
    </div>
  );
}
