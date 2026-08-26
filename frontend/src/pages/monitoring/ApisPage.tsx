import { RegisterForm } from "@/components/RegisterForm";

export default function ApisPage() {
  return (
    <div className="min-h-full bg-background p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            API Registration
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register and configure a new API endpoint.
          </p>
        </div>
        <RegisterForm />
      </div>
    </div>
  );
}
