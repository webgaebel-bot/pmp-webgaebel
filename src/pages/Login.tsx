
// // Login.tsx
// import React, { useState, useCallback } from 'react';
// import { useNavigate, Navigate, Link } from 'react-router-dom';
// import { useAuth } from '@/contexts/AuthContext';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
// import { Loader2, Eye, EyeOff } from 'lucide-react';
// import { useToast } from '@/hooks/use-toast';

// // Constants
// const VALIDATION_MESSAGES = {
//   EMAIL_REQUIRED: 'Email address is required',
//   PASSWORD_REQUIRED: 'Password is required',
//   INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
//   ACCOUNT_INACTIVE: 'Your account is inactive. Please contact the administrator to activate it.',
//   LOGIN_SUCCESS: 'Welcome back! You have successfully logged in.',
// } as const;

// const ERROR_PATTERNS = {
//   INACTIVE_ACCOUNT: /inactive|deactivated|disabled/i,
// } as const;

// // Custom hook for password visibility
// const usePasswordVisibility = () => {
//   const [isVisible, setIsVisible] = useState(false);
//   const toggleVisibility = useCallback(() => setIsVisible(prev => !prev), []);
//   return { isVisible, toggleVisibility };
// };

// // Login Form Component
// const LoginForm: React.FC<{
//   onSubmit: (email: string, password: string) => Promise<void>;
//   isLoading: boolean;
// }> = ({ onSubmit, isLoading }) => {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const { isVisible: showPassword, toggleVisibility: togglePasswordVisibility } = usePasswordVisibility();

//   const handleSubmit = useCallback(async (e: React.FormEvent) => {
//     e.preventDefault();
//     await onSubmit(email, password);
//   }, [email, password, onSubmit]);

//   return (
//     <form onSubmit={handleSubmit} className="space-y-6">
//       <div className="space-y-4">
//         {/* Email Field */}
//         <div className="space-y-2">
//           <Label htmlFor="email" className="text-foreground font-medium">
//             Email Address
//           </Label>
//           <Input
//             id="email"
//             type="email"
//             placeholder="name@company.com"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             className="h-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
//             disabled={isLoading}
//             autoComplete="email"
//             aria-label="Email address"
//           />
//         </div>

//         {/* Password Field */}
//         <div className="space-y-2">
//           <div className="flex items-center justify-between">
//             <Label htmlFor="password" className="text-foreground font-medium">
//               Password
//             </Label>
//             <Link
//               to="/forgot-password"
//               className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
//             >
//               Forgot password?
//             </Link>
//           </div>
//           <div className="relative">
//             <Input
//               id="password"
//               type={showPassword ? 'text' : 'password'}
//               placeholder="••••••••"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//               className="h-11 pr-11 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
//               disabled={isLoading}
//               autoComplete="current-password"
//               aria-label="Password"
//             />
//             <Button
//               type="button"
//               variant="ghost"
//               size="icon"
//               className="absolute right-0 top-0 h-11 w-11 text-muted-foreground hover:text-foreground"
//               onClick={togglePasswordVisibility}
//               aria-label={showPassword ? 'Hide password' : 'Show password'}
//             >
//               {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
//             </Button>
//           </div>
//         </div>
//       </div>

//       <Button
//         type="submit"
//         className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all duration-300"
//         disabled={isLoading}
//       >
//         {isLoading ? (
//           <>
//             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//             Signing in...
//           </>
//         ) : (
//           'Sign In'
//         )}
//       </Button>
//     </form>
//   );
// };

// // Left Panel Component
// const LeftPanel: React.FC<{ logoImg: string; bgImage: string }> = ({ logoImg, bgImage }) => (
//   <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/80 to-primary relative overflow-hidden items-center justify-center p-12">
//     {/* Background decorative elements */}
//     <div className="absolute inset-0 bg-[url(https://rainy-gradients.vercel.app/noise.svg)] opacity-10" />
//     <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-white/10 rounded-full blur-[100px] animate-pulse" />
//     <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-white/10 rounded-full blur-[100px] animate-pulse delay-1000" />

//     <div className="relative z-10 w-full max-w-2xl flex flex-col items-center text-center space-y-12">
      

//       <div className="w-full max-w-md">
//         <img
//           src={bgImage}
//           alt="Platform illustration"
//           className="w-full h-auto object-contain rounded-xl shadow-2xl"
//           loading="lazy"
//         />
//       </div>
//     </div>
//   </div>
// );

// // Right Panel Component
// const RightPanel: React.FC<{
//   logoImg: string;
//   isLoading: boolean;
//   onSubmit: (email: string, password: string) => Promise<void>;
// }> = ({ logoImg, isLoading, onSubmit }) => (
//   <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-background">
//     <div className="w-full max-w-[400px] animate-in fade-in slide-in-from-right-8 duration-500">
//       <div className="bg-card lg:bg-transparent lg:shadow-none shadow-lg rounded-2xl p-8 lg:p-0">
//         {/* Header Section */}
//         <div className="mb-8">
//           <div className="flex items-center gap-3 justify-center lg:hidden mb-6">
//             <img src={logoImg} alt="Project Portal" className="h-8 w-8 object-contain" />
//             <span className="text-xl font-bold text-foreground">Project Portal</span>
//           </div>
//           <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight text-center lg:text-left">
//             Welcome back
//           </h1>
//           <p className="text-muted-foreground text-sm mt-2 text-center lg:text-left">
//             Enter your credentials to access your workspace
//           </p>
//         </div>

//         {/* Login Form */}
//         <LoginForm onSubmit={onSubmit} isLoading={isLoading} />

//         {/* Footer Section */}
//         <div className="mt-8 pt-6 text-center border-t border-border">
//           <p className="text-sm text-muted-foreground">
//             Don't have an account?{' '}
//             <Link
//               to="/contact"
//               className="text-primary hover:text-primary/80 transition-colors font-medium"
//             >
//               Contact administrator
//             </Link>
//           </p>
//         </div>
//       </div>
//     </div>
//   </div>
// );

// // Loading Component
// const LoadingScreen: React.FC = () => (
//   <div className="flex h-screen w-full items-center justify-center bg-background">
//     <Loader2 className="h-8 w-8 animate-spin text-primary" />
//   </div>
// );

// // Main Login Component
// const Login: React.FC = () => {
//   const navigate = useNavigate();
//   const { login, isAuthenticated, isLoading: authLoading } = useAuth();
//   const { toast } = useToast();
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const bgImage = '/portal-logo.png';
//   const logoImg = '/portal-logo.png';

//   const handleLogin = useCallback(async (email: string, password: string) => {
//     // Validation
//     if (!email.trim()) {
//       toast({
//         title: 'Validation Error',
//         description: VALIDATION_MESSAGES.EMAIL_REQUIRED,
//         variant: 'destructive',
//       });
//       return;
//     }

//     if (!password) {
//       toast({
//         title: 'Validation Error',
//         description: VALIDATION_MESSAGES.PASSWORD_REQUIRED,
//         variant: 'destructive',
//       });
//       return;
//     }

//     setIsSubmitting(true);

//     try {
//       await login(email, password);
//       toast({
//         title: 'Success',
//         description: VALIDATION_MESSAGES.LOGIN_SUCCESS,
//       });
//       navigate('/dashboard', { replace: true });
//     } catch (error: any) {
//       const errorMessage = error?.message || '';
//       const isInactiveAccount = ERROR_PATTERNS.INACTIVE_ACCOUNT.test(errorMessage);

//       toast({
//         title: isInactiveAccount ? 'Account Inactive' : 'Login Failed',
//         description: isInactiveAccount
//           ? VALIDATION_MESSAGES.ACCOUNT_INACTIVE
//           : VALIDATION_MESSAGES.INVALID_CREDENTIALS,
//         variant: 'destructive',
//       });
//     } finally {
//       setIsSubmitting(false);
//     }
//   }, [login, navigate, toast]);

//   // Loading state
//   if (authLoading) {
//     return <LoadingScreen />;
//   }

//   // Redirect if already authenticated
//   if (isAuthenticated) {
//     return <Navigate to="/dashboard" replace />;
//   }

//   return (
//     <div className="flex min-h-screen w-full bg-background">
//       <LeftPanel logoImg={logoImg} bgImage={bgImage} />
//       <RightPanel
//         logoImg={logoImg}
//         isLoading={isSubmitting}
//         onSubmit={handleLogin}
//       />
//     </div>
//   );
// };

// export default Login;

// Login.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Loader2, 
  Eye, 
  EyeOff, 
  Sparkles,
  ArrowRight,
  Shield,
  Zap,
  Users,
  BarChart3,
  CheckCircle2,
  Github,
  Chrome
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import portalLogo from '@/assets/images-removebg-preview.png';

// Types
interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

// Constants
const VALIDATION_MESSAGES = {
  EMAIL_REQUIRED: 'Email address is required',
  EMAIL_INVALID: 'Please enter a valid email address',
  PASSWORD_REQUIRED: 'Password is required',
  PASSWORD_MIN_LENGTH: 'Password must be at least 6 characters',
  INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  ACCOUNT_INACTIVE: 'Your account is inactive. Please contact support.',
  LOGIN_SUCCESS: 'Welcome back! Redirecting to dashboard...',
} as const;

const FEATURES: Feature[] = [
  {
    icon: <Zap className="h-5 w-5" />,
    title: 'Lightning Fast',
    description: 'Real-time updates and instant responses',
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: 'Enterprise Security',
    description: 'Bank-grade encryption and security',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: 'Advanced Analytics',
    description: 'Data-driven insights for your business',
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: 'Team Collaboration',
    description: 'Seamless teamwork across departments',
  },
];

// Custom Hooks
const usePasswordVisibility = () => {
  const [isVisible, setIsVisible] = useState(false);
  const toggleVisibility = useCallback(() => setIsVisible(prev => !prev), []);
  return { isVisible, toggleVisibility };
};

const useRememberMe = () => {
  const [rememberMe, setRememberMe] = useState(() => {
    const saved = localStorage.getItem('rememberMe');
    return saved === 'true';
  });

  const saveCredentials = useCallback((email: string, password: string) => {
    if (rememberMe) {
      localStorage.setItem('savedEmail', email);
      localStorage.setItem('savedPassword', btoa(password));
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('savedEmail');
      localStorage.removeItem('savedPassword');
      localStorage.setItem('rememberMe', 'false');
    }
  }, [rememberMe]);

  const getSavedCredentials = useCallback(() => {
    const email = localStorage.getItem('savedEmail');
    const password = localStorage.getItem('savedPassword');
    return {
      email: email || '',
      password: password ? atob(password) : '',
      rememberMe: localStorage.getItem('rememberMe') === 'true',
    };
  }, []);

  return { rememberMe, setRememberMe, saveCredentials, getSavedCredentials };
};

// Components
const AnimatedBackground: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden">
    <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse" />
    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-700" />
    
    {/* Grid Pattern */}
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
  </div>
);

const FeatureCard: React.FC<{ feature: Feature; index: number }> = ({ feature, index }) => (
  <div 
    className="flex items-start gap-3 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 group"
    style={{ animationDelay: `${index * 100}ms` }}
  >
    <div className="p-2 rounded-lg bg-primary/20 text-primary group-hover:scale-110 transition-transform duration-300">
      {feature.icon}
    </div>
    <div>
      <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
      <p className="text-sm text-white/70">{feature.description}</p>
    </div>
  </div>
);

const SocialLoginButton: React.FC<{
  icon: React.ReactNode;
  provider: string;
  onClick: () => void;
}> = ({ icon, provider, onClick }) => (
  <Button
    type="button"
    variant="outline"
    onClick={onClick}
    className="flex-1 gap-2 bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-foreground"
  >
    {icon}
    <span className="hidden sm:inline">{provider}</span>
  </Button>
);

const LoginForm: React.FC<{
  onSubmit: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  isLoading: boolean;
}> = ({ onSubmit, isLoading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const { isVisible: showPassword, toggleVisibility: togglePasswordVisibility } = usePasswordVisibility();
  const { rememberMe, setRememberMe, getSavedCredentials } = useRememberMe();

  useEffect(() => {
    const saved = getSavedCredentials();
    if (saved.rememberMe) {
      setEmail(saved.email);
      setPassword(saved.password);
      setRememberMe(true);
    }
  }, [getSavedCredentials, setRememberMe]);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = VALIDATION_MESSAGES.EMAIL_REQUIRED;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = VALIDATION_MESSAGES.EMAIL_INVALID;
    }

    if (!password) {
      newErrors.password = VALIDATION_MESSAGES.PASSWORD_REQUIRED;
    } else if (password.length < 6) {
      newErrors.password = VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      await onSubmit(email, password, rememberMe);
    }
  }, [email, password, rememberMe, onSubmit]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-foreground font-medium">
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
            className={`h-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20 ${
              errors.email ? 'border-destructive focus:ring-destructive/20' : ''
            }`}
            disabled={isLoading}
            autoComplete="email"
          />
          {errors.email && (
            <p className="text-sm text-destructive animate-in slide-in-from-top-1">
              {errors.email}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-foreground font-medium">
              Password
            </Label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              className={`h-12 pr-12 transition-all duration-200 focus:ring-2 focus:ring-primary/20 ${
                errors.password ? 'border-destructive focus:ring-destructive/20' : ''
              }`}
              disabled={isLoading}
              autoComplete="current-password"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-12 w-12 text-muted-foreground hover:text-foreground"
              onClick={togglePasswordVisibility}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive animate-in slide-in-from-top-1">
              {errors.password}
            </p>
          )}
        </div>

        {/* Remember Me & Terms */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              disabled={isLoading}
            />
            <Label
              htmlFor="remember"
              className="text-sm font-normal text-muted-foreground cursor-pointer"
            >
              Remember me
            </Label>
          </div>
          <Link
            to="/terms"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Terms & Conditions
          </Link>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold shadow-lg shadow-primary/20 transition-all duration-300 group"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            Sign In
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </>
        )}
      </Button>

     

    
    </form>
  );
};

const LeftPanel: React.FC = () => {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  return (
    <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden items-center justify-center p-12">
      <AnimatedBackground />
      
      <div className="relative z-10 w-full max-w-2xl">
        {/* Logo & Badge */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
            <Sparkles className="h-4 w-4 text-yellow-400" />
            <span className="text-sm font-medium text-white">SaaS Platform</span>
          </div>
          
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/95 p-2 shadow-xl">
              <img src={portalLogo} alt="Project Portal" className="h-full w-full object-contain" />
            </div>
            <span className="text-3xl font-bold text-white">Project Portal</span>
          </div>
          
          <h2 className="text-4xl font-bold text-white mb-4">
            Modern SaaS Platform
          </h2>
          <p className="text-lg text-white/70">
            Streamline your workflow, boost productivity, and scale your business with our enterprise-grade solution.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {[
            { value: '10K+', label: 'Active Users' },
            { value: '99.9%', label: 'Uptime SLA' },
            { value: '24/7', label: 'Support' },
          ].map((stat, idx) => (
            <div key={idx} className="text-center p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-white/60">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map((feature, idx) => (
            <div
              key={idx}
              onMouseEnter={() => setHoveredFeature(idx)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              <FeatureCard feature={feature} index={idx} />
            </div>
          ))}
        </div>

    
      </div>
    </div>
  );
};

const RightPanel: React.FC<{
  isLoading: boolean;
  onSubmit: (email: string, password: string, rememberMe: boolean) => Promise<void>;
}> = ({ isLoading, onSubmit }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-gradient-to-br from-background via-background to-background/95">
      <div className={`w-full max-w-[440px] transition-all duration-700 transform ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}>
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl p-8 border border-border shadow-2xl">
          {/* Mobile Logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-background p-2 shadow-lg ring-1 ring-border">
              <img src={portalLogo} alt="Project Portal" className="h-full w-full object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Welcome Back</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in to continue</p>
          </div>

          {/* Desktop Header */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Welcome back
            </h1>
            <p className="text-muted-foreground mt-2">
              Enter your credentials to access your workspace
            </p>
          </div>

          {/* Login Form */}
          <LoginForm onSubmit={onSubmit} isLoading={isLoading} />

          {/* Footer */}
          <div className="mt-8 pt-6 text-center border-t border-border">
            <p className="text-sm text-muted-foreground">
              Need access for your team?{' '}
              <Link
                to="/contact"
                className="text-primary hover:text-primary/80 transition-colors font-semibold"
              >
                Request access
              </Link>
            </p>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground mb-3">
            Trusted by innovative companies worldwide
          </p>
          <div className="flex justify-center gap-6 opacity-50">
            {['TechCorp', 'InnovateLabs', 'FutureSoft', 'DataDrive'].map((company) => (
              <span key={company} className="text-xs font-medium text-muted-foreground">
                {company}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingScreen: React.FC = () => (
  <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-background to-background/95">
    <div className="text-center space-y-4">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg animate-pulse" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">Loading your workspace...</p>
    </div>
  </div>
);

// Main Component
const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { saveCredentials } = useRememberMe();

  const handleLogin = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    setIsSubmitting(true);

    try {
      await login(email, password);
      saveCredentials(email, password);
      
      toast({
        title: 'Success',
        description: VALIDATION_MESSAGES.LOGIN_SUCCESS,
        duration: 3000,
      });
      
      // Small delay for better UX
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 500);
    } catch (error: any) {
      const errorMessage = error?.message || '';
      const isInactiveAccount = /inactive|deactivated|disabled/i.test(errorMessage);

      toast({
        title: isInactiveAccount ? 'Account Inactive' : 'Authentication Failed',
        description: isInactiveAccount
          ? VALIDATION_MESSAGES.ACCOUNT_INACTIVE
          : VALIDATION_MESSAGES.INVALID_CREDENTIALS,
        variant: 'destructive',
        duration: 4000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [login, navigate, toast, saveCredentials]);

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <LeftPanel />
      <RightPanel isLoading={isSubmitting} onSubmit={handleLogin} />
    </div>
  );
};

export default Login;
