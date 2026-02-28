// app/chatbot/page.tsx
import { Suspense } from "react";
import ChatbotClient from "./ChatbotClient";

export default function ChatbotPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 text-neutral-100" />}>
      <ChatbotClient />
    </Suspense>
  );
}