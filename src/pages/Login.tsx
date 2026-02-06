import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, Shield, Users, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: 'Validation Error',
        description: 'Please enter both email and password.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
      toast({
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
      });
      navigate('/dashboard');
    } catch (error: any) {
      const message = (error?.message || '').toLowerCase();
      const isInactive =
        message.includes('inactive') ||
        message.includes('deactivated') ||
        message.includes('disabled');
      toast({
        title: isInactive ? 'Account Inactive' : 'Login Failed',
        description: isInactive
          ? 'Your account is inactive. Please contact the administrator to activate it.'
          : error.message || 'Invalid credentials. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-slate-50">
      {/* Left Panel - Branding & Visuals (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-900 via-blue-900 to-blue-800 relative overflow-hidden items-center justify-center p-12">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/30 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/30 rounded-full blur-[100px] animate-pulse delay-75" />

        <div className="relative z-10 w-full max-w-2xl flex flex-col items-center text-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-2xl shadow-2xl transform transition-transform duration-500 hover:scale-[1.02]">
              <img
                src="/images-removebg-preview.jfif"
                alt="Project Management Illustration"
                className="w-full h-auto max-w-[400px] object-contain drop-shadow-2xl"
                onError={(e) => {
                  // Fallback if image fails
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.classList.add('hidden');
                }}
              />
              {/* Fallback Icon if Image Missing/Hidden */}
              <div className="hidden first:flex items-center justify-center h-64 w-64">
                <TrendingUp className="h-32 w-32 text-white/50" />
              </div>
            </div>
          </div>

          <div className="space-y-6 max-w-lg">
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
              Manage Projects with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-200">Confidence</span>
            </h1>
            <p className="text-lg text-blue-100/90 leading-relaxed font-light">
              Streamline your workflow, collaborate in real-time, and achieve your goals with our premium project management suite.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6 w-full max-w-lg">
            {[
              { icon: Shield, label: "Secure", value: "100%" },
              { icon: Users, label: "Active", value: "10k+" },
              { icon: TrendingUp, label: "Growth", value: "3x" },
            ].map((stat, idx) => (
              <div key={idx} className="flex flex-col items-center p-4 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                <stat.icon className="h-6 w-6 text-blue-300 mb-2" />
                <span className="text-xl font-bold text-white">{stat.value}</span>
                <span className="text-xs text-blue-200">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-white lg:bg-slate-50 relative">
        {/* Mobile Background Decoration */}
        <div className="lg:hidden absolute inset-0 bg-slate-50" />

        <div className="w-full max-w-[440px] relative z-10 animate-in fade-in slide-in-from-right-8 duration-700">

          <div className="bg-white lg:bg-transparent lg:shadow-none shadow-xl rounded-2xl p-8 lg:p-0 border lg:border-none border-slate-100">
            {/* Header */}
            <div className="flex flex-col space-y-2 mb-10">
              <div className="flex items-center gap-3 lg:justify-start justify-center mb-6">
                <img
                  src="/images-removebg-preview.jfif"
                  alt="ProjectHub Logo"
                  className="h-9 w-9 object-contain lg:hidden"
                />
                <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
                  ProjectHub
                </span>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight lg:text-left text-center">
                Welcome back
              </h2>
              <p className="text-slate-500 text-sm lg:text-left text-center">
                Enter your credentials to access your workspace.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pr-12 border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white transition-all duration-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-12 w-12 text-slate-400 hover:text-slate-600 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 transform hover:-translate-y-0.5"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 text-center border-t border-slate-100">
              <p className="text-sm text-slate-500">
                Don't have an account?{' '}
                <Link to="/contact-admin" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-all">
                  Contact administrator
                </Link>
              </p>
            </div>

            {/* Footer Links */}
            <div className="mt-8 flex justify-center gap-6 text-xs text-slate-400">
              <a href="#" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-slate-600 transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
