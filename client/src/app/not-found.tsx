import Link from "next/link";
import { Home, LifeBuoy, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "404",
  description: "This route doesn't exist.",
};

const shieldPath =
  "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z";

export default function NotFound() {
  return (
    <div className="relative min-h-screen bg-background text-foreground flex items-center justify-center overflow-hidden px-6">
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500 blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-red-500 blur-[140px]" />
      </div>

      {/* Large shield watermark, dead center, behind the content */}
      <svg
        viewBox="0 0 24 24"
        className="absolute h-[70vh] w-[70vh] max-h-[560px] max-w-[560px] fill-foreground/[0.03] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d={shieldPath} />
      </svg>

      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/home" className="flex items-center gap-2 font-bold text-lg tracking-tighter">
            <Shield className="w-8 h-8" data-app-logo-icon />
          </Link>
        </div>
        <p className="font-bold text-xs tracking-[0.35em] uppercase text-muted-foreground mb-4">
          Error Code
        </p>

        <h1 className="font-mono-nums text-8xl md:text-9xl font-bold tracking-tighter leading-none mb-4">
          404
        </h1>

        <h2 className="text-xl md:text-2xl font-bold tracking-tight uppercase mb-3">
          Off Protocol
        </h2>

        <p className="text-muted-foreground leading-relaxed mb-10">
          This route doesn&apos;t exist in the system. Discipline means staying
          on the right path no matter what, let&apos;s get you back to it.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Button asChild className="w-full sm:w-auto h-11">
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Return to Base
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full sm:w-auto h-11 text-muted-foreground">
            <Link href="/support">
              <LifeBuoy className="w-4 h-4 mr-2" />
              Contact Support
            </Link>
          </Button>
        </div>

        <p className="mt-16 text-xs text-muted-foreground font-mono tracking-wide">
          DISCIPLINE EQUALS FREEDOM
        </p>
      </div>
    </div>
  );
}
