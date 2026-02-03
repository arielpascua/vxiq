import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LogIn } from 'lucide-react';

const PASSCODE = 'ariel2026';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === PASSCODE) {
      sessionStorage.setItem('vxi-auth', 'true');
      navigate('/admin');
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-vxi-black-300 via-vxi-black-200 to-vxi-black-300 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-vxi-orange-500 to-vxi-orange-700 rounded-2xl shadow-xl mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-vxi-white">VXI Queue System</h1>
          <p className="text-vxi-white-400 text-sm mt-1">Enter password to access admin</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-vxi-black-100 border border-vxi-white-300/10 rounded-2xl p-6 shadow-2xl">
          <div className="mb-4">
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              placeholder="Password"
              autoFocus
              className={`w-full bg-vxi-black-50 border ${error ? 'border-red-500 animate-shake' : 'border-vxi-white-300/20'} rounded-xl px-4 py-3 text-vxi-white placeholder-vxi-white-400 focus:outline-none focus:ring-2 focus:ring-vxi-orange-500 focus:border-transparent transition-all`}
            />
            {error && <p className="text-red-400 text-sm mt-2">Incorrect password</p>}
          </div>
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-vxi-orange-500 to-vxi-orange-600 hover:from-vxi-orange-600 hover:to-vxi-orange-700 text-white font-semibold py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg"
          >
            <LogIn className="w-5 h-5" />
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
