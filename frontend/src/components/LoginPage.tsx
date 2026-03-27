import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sun, Moon, Eye, EyeOff, Shield, Users, BookOpen } from 'lucide-react';
import invetoLogo from '@/assets/inveto-logo.png';

export default function LoginPage() {
  const { login } = useAuth();
  const { isDark, toggle } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const result = await login(email, password);
    if (!result.success) setError(result.error || 'Login failed');
  };

  const demoLogin = async (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
    const result = await login(email, password);
    if (!result.success) setError(result.error || 'Login failed');
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="absolute rounded-full border border-primary-foreground/20"
              style={{ width: `${60 + i * 40}px`, height: `${60 + i * 40}px`, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
          ))}
        </div>
        <div className="relative z-10 text-center p-12">
          <div className="flex items-center justify-center gap-4 mb-6">
            <img src={invetoLogo} alt="INVETO Logo" className="h-20 w-20 rounded-2xl object-cover shadow-lg" />
            <h1 className="text-5xl font-display font-bold text-primary-foreground tracking-tight">INVETO</h1>
          </div>
          <p className="text-primary-foreground/80 text-lg max-w-md mx-auto leading-relaxed">
            Smart Inventory & Order Management System with AI-powered predictions and real-time analytics
          </p>
          <div className="mt-10 grid grid-cols-3 gap-6 max-w-sm mx-auto">
            {[
              { icon: Shield, label: 'Secure' },
              { icon: Users, label: 'Multi-User' },
              { icon: BookOpen, label: 'Analytics' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-primary-foreground/70 text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2 lg:hidden">
              <img src={invetoLogo} alt="INVETO" className="h-10 w-10 rounded-xl object-cover" />
              <span className="text-2xl font-display font-bold">INVETO</span>
            </div>
            <button onClick={toggle} className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors ml-auto">
              {isDark ? <Sun className="h-5 w-5 text-foreground" /> : <Moon className="h-5 w-5 text-foreground" />}
            </button>
          </div>

          <h2 className="text-3xl font-display font-bold text-foreground mb-2">Welcome back</h2>
          <p className="text-muted-foreground mb-8">Sign in to your account to continue</p>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-6 text-destructive text-sm animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" required className="h-12" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Password</label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required className="h-12 pr-12" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 gradient-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity">
              Sign In
            </Button>
          </form>

          <div className="mt-8">
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">Quick Demo Login</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Admin', email: 'admin@inveto.com', pw: 'admin123', desc: 'Full access' },
                { label: 'Staff', email: 'staff@inveto.com', pw: 'staff123', desc: 'Limited' },
                { label: 'Viewer', email: 'viewer@inveto.com', pw: 'viewer123', desc: 'Read only' },
              ].map(d => (
                <button key={d.label} onClick={() => demoLogin(d.email, d.pw)}
                  className="p-3 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-center group">
                  <span className="block text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{d.label}</span>
                  <span className="block text-xs text-muted-foreground">{d.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
