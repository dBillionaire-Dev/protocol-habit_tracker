import { Shield, Lock, Activity, TrendingUp, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function Landing() {
  const { loginAsGuest, isGuestLoggingIn } = useAuth();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel: Branding */}
      <div className="lg:w-1/2 bg-zinc-950 text-white p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        {/* Abstract Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500 blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-red-500 blur-[120px]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-8 h-8" />
            <span className="text-xl font-bold tracking-widest">PROTOCOL</span>
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tighter mb-6 leading-[1.1]">
            DISCIPLINE<br />IS NOT A<br />GAME.
          </h1>
          
          <p className="text-lg text-zinc-400 max-w-md leading-relaxed">
            A serious framework for tracking habits. 
            Accumulate debt for failures. 
            Stack penalties for missed targets. 
            Accountability is the only metric that matters.
          </p>
        </div>

        <div className="relative z-10 mt-12 grid grid-cols-2 gap-8 text-sm font-mono text-zinc-500">
          <div>
            <p className="text-white mb-2 font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-500" /> 
              AVOIDANCE DEBT
            </p>
            Bad habits aren't just reset. They accrue debt that must be paid down.
          </div>
          <div>
            <p className="text-white mb-2 font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              PENALTY STACKING
            </p>
            Miss a daily task? Tomorrow it gets harder. The standard increases until you execute.
          </div>
        </div>
      </div>

      {/* Right Panel: Auth */}
      <div className="lg:w-1/2 bg-background p-8 lg:p-16 flex flex-col justify-center items-center">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Access Terminal</h2>
            <p className="text-muted-foreground">Identify yourself to access your protocols.</p>
          </div>

          <div className="space-y-4">
            <Button className="w-full h-12 text-base shadow-lg" asChild data-testid="button-login">
              <a href="/api/login">
                <Lock className="w-4 h-4 mr-2" />
                Authenticate with Replit
              </a>
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full h-12 text-base"
              onClick={() => loginAsGuest()}
              disabled={isGuestLoggingIn}
              data-testid="button-guest-login"
            >
              <User className="w-4 h-4 mr-2" />
              {isGuestLoggingIn ? "Loading..." : "Continue as Guest"}
            </Button>
            
            <p className="text-xs text-center text-muted-foreground px-8">
              By authenticating, you agree to accept full responsibility for your actions and inactions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
