
import { useState } from 'react';
import { User } from '../types';
import { mockBackend } from '../services/mockBackend';
import { ArrowRight, Loader2, AlertCircle, Mail, Lock, Globe, User as UserIcon, Key, Download, CheckCircle2 } from 'lucide-react';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'import'>('login');
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passportCode, setPassportCode] = useState('');
  
  // UI State
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isValidEmail = (email: string) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const trimmedEmail = email.trim();

    setTimeout(() => {
        const user = mockBackend.login(trimmedEmail, password);
        if (user) {
            onLogin(user);
        } else {
            setError("Account not found or password incorrect.");
            setIsLoading(false);
        }
    }, 800);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!name || !cleanEmail || !password) {
        setError("All fields are required.");
        return;
    }
    if (!isValidEmail(cleanEmail)) {
        setError("Please enter a valid email address.");
        return;
    }
    
    setError(null);
    setIsLoading(true);
    
    // Simulate DNS and SMTP Handshake Steps
    const domain = cleanEmail.split('@')[1] || 'server';
    
    try {
        setStatusMessage(`Resolving MX records for ${domain}...`);
        await new Promise<void>(resolve => setTimeout(() => resolve(), 800));
        
        setStatusMessage(`Connecting to smtp.${domain}:25...`);
        await new Promise<void>(resolve => setTimeout(() => resolve(), 800));
        
        setStatusMessage(`> RCPT TO: <${cleanEmail}>`);
        await new Promise<void>(resolve => setTimeout(() => resolve(), 600));
        
        // Actual backend call (simulated AI verification)
        const user = await mockBackend.signup(name, cleanEmail, password);
        
        setStatusMessage("250 2.1.5 OK");
        await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

        // Success
        onLogin(user);
        
    } catch (err: any) {
        setError(err.message);
        setIsLoading(false);
        setStatusMessage(null);
        
        // If error is about duplicate, offer to login
        if (err.message.includes("Account exists")) {
            setTimeout(() => {
                setMode('login');
                setError(null); 
            }, 3000);
        }
    }
  };

  const handleImport = (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);
      setStatusMessage("Verifying Passport Integrity...");

      setTimeout(() => {
          try {
              const user = mockBackend.importAccount(passportCode);
              onLogin(user);
          } catch (err: any) {
              setError("Invalid Passport Code. Please check and try again.");
              setIsLoading(false);
              setStatusMessage(null);
          }
      }, 1500);
  };

  return (
    <div 
        className="h-screen w-screen flex items-center justify-center relative overflow-hidden font-segoe"
        style={{
            background: 'linear-gradient(to bottom,  #b7deed 0%,#71ceef 50%,#21b4e2 51%,#b7deed 100%)'
        }}
    >
       {/* Main Auth Container */}
       <div className="aero-glass p-8 rounded-lg shadow-2xl w-full max-w-sm animate-metro-pop relative z-10 flex flex-col gap-4">
           
           {/* Header */}
           <div className="text-center mb-4">
               <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#00AFF0] to-[#0078d7] rounded-full shadow-lg mb-4 border-2 border-white">
                    <Globe size={32} className="text-white" />
               </div>
               <h1 className="text-3xl text-slate-700 font-segoe mb-1 drop-shadow-sm">SkyLink<span className="text-sm align-top ml-1 text-slate-500">®</span></h1>
               <p className="text-slate-500 font-segoe text-sm flex items-center justify-center gap-2">
                   {isLoading && mode === 'register' ? (
                       <span className="text-[#00AFF0] font-mono text-xs">{statusMessage}</span>
                   ) : (
                       <span>{statusMessage || (mode === 'login' ? 'Sign in to Global Network' : mode === 'register' ? 'Create Public Account' : 'Import Identity')}</span>
                   )}
               </p>
           </div>

           {/* Error Box */}
           {error && (
               <div className="bg-red-100 border border-red-300 text-red-800 px-3 py-2 text-xs rounded shadow-inner flex items-center gap-2 animate-in slide-in-from-top-2">
                   <AlertCircle size={14} className="shrink-0" />
                   <span>{error}</span>
               </div>
           )}

           {mode === 'login' && (
               <form onSubmit={handleLogin} className="flex flex-col gap-3">
                   <div className="relative">
                       <input 
                          type="email" 
                          placeholder="Email address" 
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="input-aero w-full p-2 pl-9 text-sm outline-none transition-all duration-500"
                          autoFocus
                       />
                       <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   </div>

                   <div className="relative">
                       <input 
                          type="password" 
                          placeholder="Password" 
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="input-aero w-full p-2 pl-9 text-sm outline-none transition-all duration-500"
                       />
                       <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   </div>
                   <div className="flex justify-between items-center mt-2">
                        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <input type="checkbox" className="rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                            Auto-sign in
                        </label>
                        <button disabled={isLoading} className="btn-aero-primary px-6 py-1.5 shadow-md flex items-center gap-2">
                           {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Sign in'}
                        </button>
                   </div>
                   
                   <div className="border-t border-slate-300/50 mt-4 pt-3 flex flex-col gap-2 text-center">
                       <button type="button" onClick={() => { setError(null); setMode('register'); setEmail(''); setPassword(''); }} className="text-sky-700 hover:underline text-xs font-bold">
                           Create a new account
                       </button>
                       <button type="button" onClick={() => { setError(null); setMode('import'); }} className="text-slate-500 hover:text-sky-700 text-[11px] flex items-center justify-center gap-1">
                           <Download size={12} /> Import from another device
                       </button>
                   </div>
               </form>
           )}

           {mode === 'register' && (
               <form onSubmit={handleRegister} className="flex flex-col gap-3">
                   <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Full Name" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="input-aero w-full p-2 pl-9 text-sm outline-none transition-all duration-500"
                        />
                        <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   </div>
                   <div className="relative">
                        <input 
                            type="email" 
                            placeholder="Email address (Gmail, Outlook, Yahoo...)" 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="input-aero w-full p-2 pl-9 text-sm outline-none transition-all duration-500"
                        />
                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   </div>
                   <div className="relative">
                        <input 
                            type="password" 
                            placeholder="Create Password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="input-aero w-full p-2 pl-9 text-sm outline-none transition-all duration-500"
                        />
                        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   </div>
                   <div className="flex gap-2 mt-3 justify-end">
                        <button 
                            type="button" 
                            onClick={() => setMode('login')}
                            className="btn-aero px-4 py-1.5"
                        >
                            Cancel
                        </button>
                        <button disabled={isLoading} type="submit" className="btn-aero-primary px-4 py-1.5 flex items-center gap-1">
                            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <>Sign Up <ArrowRight size={14} /></>}
                        </button>
                   </div>
               </form>
           )}

           {mode === 'import' && (
               <form onSubmit={handleImport} className="flex flex-col gap-3">
                   <div className="bg-sky-50 border border-sky-200 p-3 rounded text-[11px] text-slate-700 mb-2">
                       <p className="font-bold mb-1">Passport Import:</p>
                       Paste your <strong>Passport Code</strong> from your other device to log in. 
                       <br/><span className="italic text-slate-500 opacity-80">(Messages are not transferred)</span>
                   </div>
                   
                   <textarea 
                      placeholder="Paste your code starting with eyJ..."
                      value={passportCode}
                      onChange={e => setPassportCode(e.target.value)}
                      className="input-aero w-full p-2 text-[10px] font-mono outline-none h-24 resize-none transition-all duration-500"
                      autoFocus
                   />
                   
                   <div className="flex gap-2 mt-2 justify-between items-center">
                        <button 
                            type="button" 
                            onClick={() => setMode('login')}
                            className="text-xs text-slate-500 hover:text-slate-700"
                        >
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading || !passportCode} className="btn-aero-primary px-4 py-1.5 flex items-center gap-1">
                            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <> <Key size={14} /> Import </>}
                        </button>
                   </div>
               </form>
           )}
       </div>
       
       

       <button
          onClick={() => { const user = mockBackend.loginGuest(); onLogin(user); }}
          className="absolute bottom-4 right-4 btn-aero-primary px-3 py-1 text-[11px] leading-tight shadow-md"
       >
          <span className="block">Only want to give a look?</span>
          <span className="block font-bold">Start as a Guest</span>
       </button>
    </div>
  );
};
