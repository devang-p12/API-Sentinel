import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Shield01Icon,
  Mail01Icon,
  LockPasswordIcon,
  ArrowRight01Icon,
  SparklesIcon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoAdmin = () => {
    setEmail('admin@sentinel.local');
    setPassword('sentinel123');
    setError(null);
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center p-4 bg-background selection:bg-primary/20 selection:text-primary relative overflow-hidden">
      {/* Background ambient gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="size-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 shadow-lg shadow-primary/5">
            <HugeiconsIcon icon={Shield01Icon} className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">API Sentinel</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-Time API Observability, Automated Probing & SLA Assurance
          </p>
        </div>

        <Card className="border-border/60 bg-card/80 backdrop-blur-xl shadow-xl shadow-black/20">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">Sign in</CardTitle>
            <CardDescription className="text-xs">
              Enter your credentials to access your workspaces and monitors
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive" className="py-2.5 px-3 text-xs flex items-center gap-2">
                  <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
                  <AlertDescription className="text-xs leading-relaxed">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">
                  Work Email
                </Label>
                <div className="relative">
                  <HugeiconsIcon
                    icon={Mail01Icon}
                    className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 text-xs h-9 bg-background/50"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-xs font-medium">
                    Password
                  </Label>
                </div>
                <div className="relative">
                  <HugeiconsIcon
                    icon={LockPasswordIcon}
                    className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 text-xs h-9 bg-background/50"
                    required
                  />
                </div>
              </div>

              {/* Demo 1-Click Credentials Banner */}
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fillDemoAdmin}
                  className="w-full text-[11px] h-8 border-dashed border-primary/30 text-primary hover:bg-primary/5 flex items-center justify-center gap-1.5 font-mono"
                >
                  <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
                  Fill Demo Admin (admin@sentinel.local)
                </Button>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button type="submit" className="w-full h-9 text-xs gap-1.5" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span>Signing in...</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                  </>
                )}
              </Button>

              <div className="text-center text-xs text-muted-foreground">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary hover:underline font-medium">
                  Create organization account
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
export default LoginPage;
