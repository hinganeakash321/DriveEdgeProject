"use client";

import { Sparkles } from "lucide-react";
import { AiChat, chatConfigForRole } from "@/components/ai-chat";
import { useAuth } from "@/lib/auth";
import { FadeIn } from "@/components/ui";

export function AiAssistantPageContent() {
  const { user, loading } = useAuth();
  const role = loading ? undefined : user?.role;
  const config = chatConfigForRole(role);

  return (
    <div className="container-xl py-8">
      <FadeIn>
        <span className="chip"><Sparkles className="h-3.5 w-3.5 text-teal" /> DriveEdge AI</span>
        <h1 className="mt-3 text-2xl font-bold text-navy">{config.heading}</h1>
        <p className="mt-1 text-muted">{config.subtext}</p>
      </FadeIn>
      <FadeIn delay={0.1} className="card mt-6 h-[70vh] overflow-hidden p-0 shadow-pop">
        <AiChat embedded config={config} />
      </FadeIn>
    </div>
  );
}
