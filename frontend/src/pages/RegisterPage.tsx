import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  UserIcon,
  Building01Icon,
  ArrowRight01Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !password) {
      setError('Please fill out all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await register({
        email,
        password,
        firstName,
        lastName,
        organizationName: organizationName.trim() || undefined,
      });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to create organization account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center p-4 bg-background selection:bg-primary/20 selection:text-primary relative overflow-hidden">
      {/* Background ambient gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="size-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3 shadow-lg shadow-primary/5">
            <HugeiconsIcon icon={Shield01Icon} className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">API Sentinel</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Setup your dedicated team workspace & observability telemetry
          </p>
        </div>

        <Card className="border-border/60 bg-card/80 backdrop-blur-xl shadow-xl shadow-black/20">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-semibold">Create Workspace</CardTitle>
            <CardDescription className="text-xs">
              Provision a new API Sentinel tenant for your engineering team
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-3.5">
              {error && (
                <Alert variant="destructive" className="py-2.5 px-3 text-xs flex items-center gap-2">
                  <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
                  <AlertDescription className="text-xs leading-relaxed">{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="firstName" className="text-xs font-medium">
                    First Name
                  </Label>
                  <div className="relative">
                    <HugeiconsIcon
                      icon={UserIcon}
                      className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="firstName"
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-8 text-xs h-8.5 bg-background/50"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="lastName" className="text-xs font-medium">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="text-xs h-8.5 bg-background/50"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="organizationName" className="text-xs font-medium">
                  Organization / Team Name
                </Label>
                <div className="relative">
                  <HugeiconsIcon
                    icon={Building01Icon}
                    className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="organizationName"
                    placeholder="Acme Platform Engineering"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    className="pl-8 text-xs h-8.5 bg-background/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-medium">
                  Work Email
                </Label>
                <div className="relative">
                  <HugeiconsIcon
                    icon={Mail01Icon}
                    className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="email"
                    type="email"
                    placeholder="jane@acme.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-8 text-xs h-8.5 bg-background/50"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label htmlFor="password" className="text-xs font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <HugeiconsIcon
                      icon={LockPasswordIcon}
                      className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-8 text-xs h-8.5 bg-background/50"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="confirmPassword" className="text-xs font-medium">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="text-xs h-8.5 bg-background/50"
                    required
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button type="submit" className="w-full h-9 text-xs gap-1.5" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span>Creating workspace...</span>
                ) : (
                  <>
                    <span>Create Organization Account</span>
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
                  </>
                )}
              </Button>

              <div className="text-center text-xs text-muted-foreground">
                Already registered?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
export default RegisterPage;
