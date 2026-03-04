"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getCurrentUser } from "@/lib/auth";
import { apiGetCustomerThreads, apiUpdateCustomerThreads, apiGetThreads, apiUpdateThreads } from "@/lib/api";
import type { MessageThread, CustomerThreadRef } from "@/lib/types";

interface LoadedThread {
  ref: CustomerThreadRef;
  thread: MessageThread;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function proInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function MessagesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadedThreads, setLoadedThreads] = useState<LoadedThread[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sendError, setSendError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserRef = useRef<{ id: string; name: string } | null>(null);

  const loadThreads = async (): Promise<LoadedThread[]> => {
    const user = getCurrentUser();
    if (!user) return [];
    currentUserRef.current = { id: user.id, name: user.name };

    const refs = await apiGetCustomerThreads(user.id);
    const result: LoadedThread[] = [];
    for (const ref of refs) {
      try {
        const proThreads = await apiGetThreads(ref.proProfileId);
        const thread =
          proThreads.find((t) => t.id === ref.threadId) ??
          proThreads.find((t) => t.customerId === user.id) ??
          proThreads.find((t) => t.customerName === user.name);
        if (thread) result.push({ ref, thread });
      } catch (err) {
        console.error("sniply/messages: failed to fetch thread for pro", err);
      }
    }
    return result;
  };

  // Initial auth check + load
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) { router.replace("/login"); return; }
    if (user.role === "pro") { router.replace("/pro/dashboard"); return; }

    loadThreads().then((threads) => {
      setLoadedThreads(threads);
      setLoading(false);
    }).catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for new pro replies every 4s
  useEffect(() => {
    const interval = setInterval(() => {
      loadThreads().then((threads) => setLoadedThreads(threads)).catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll when selected thread messages change
  useEffect(() => {
    if (selectedIdx !== null) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedIdx, loadedThreads]);

  const markAsRead = async (idx: number) => {
    const item = loadedThreads[idx];
    if (!item || !item.ref.unread) return;
    const user = currentUserRef.current;
    if (!user) return;

    const refs = await apiGetCustomerThreads(user.id);
    const refIdx = refs.findIndex((r) => r.proProfileId === item.ref.proProfileId);
    if (refIdx >= 0) {
      refs[refIdx] = { ...refs[refIdx], unread: false };
      await apiUpdateCustomerThreads(user.id, refs);
    }
    setLoadedThreads((prev) =>
      prev.map((lt, i) =>
        i === idx ? { ...lt, ref: { ...lt.ref, unread: false } } : lt
      )
    );
  };

  const selectThread = (idx: number) => {
    setSelectedIdx(idx);
    setReplyText("");
    setSendError("");
    void markAsRead(idx);
  };

  const sendMessage = () => {
    if (!replyText.trim() || selectedIdx === null) return;
    const item = loadedThreads[selectedIdx];
    if (!item) return;
    const user = currentUserRef.current;
    if (!user) return;

    const msg = {
      from: "customer" as const,
      text: replyText.trim(),
      time: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    };
    const updatedThread: MessageThread = {
      ...item.thread,
      messages: [...item.thread.messages, msg],
      preview: msg.text,
      timestamp: new Date().toISOString(),
      unread: true,
    };

    // Optimistic update
    setLoadedThreads((prev) =>
      prev.map((lt, i) =>
        i === selectedIdx
          ? { ...lt, thread: updatedThread, ref: { ...lt.ref, lastMessage: msg.text, timestamp: new Date().toISOString(), unread: false } }
          : lt
      )
    );
    setReplyText("");

    // Persist to API
    void (async () => {
      try {
        const threads = await apiGetThreads(item.ref.proProfileId);
        const tIdx = threads.findIndex((t) => t.id === item.thread.id);
        if (tIdx >= 0) threads[tIdx] = updatedThread;
        else threads.push(updatedThread);
        await apiUpdateThreads(item.ref.proProfileId, threads);

        const refs = await apiGetCustomerThreads(user.id);
        const rIdx = refs.findIndex((r) => r.proProfileId === item.ref.proProfileId);
        if (rIdx >= 0) {
          refs[rIdx] = { ...refs[rIdx], lastMessage: msg.text, timestamp: new Date().toISOString(), unread: false };
          await apiUpdateCustomerThreads(user.id, refs);
        }
      } catch {
        // Roll back optimistic update
        setLoadedThreads((prev) =>
          prev.map((lt, i) => i === selectedIdx ? { ...lt, thread: item.thread, ref: item.ref } : lt)
        );
        setReplyText(msg.text);
        setSendError("Message couldn't be sent. Please try again.");
      }
    })();
  };

  const selectedItem = selectedIdx !== null ? loadedThreads[selectedIdx] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-[800px] mx-auto px-6 py-10">
        <h1 className="font-heading font-bold text-gray-900 text-3xl mb-6">Messages</h1>

        {loadedThreads.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/8 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--color-primary)]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="font-heading font-bold text-gray-900 text-xl mb-2">No messages yet</h2>
            <p className="text-gray-500 text-sm mb-6">
              Message a barber from their profile page to start a conversation.
            </p>
            <Link
              href="/browse"
              className="btn-primary inline-flex items-center gap-2"
              style={{ height: "44px", padding: "0 24px" }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Browse Pros
            </Link>
          </div>
        ) : (
          <div className="flex gap-4 h-[calc(100dvh-180px)] md:h-[560px]">
            {/* Thread list */}
            <div
              className={`${selectedItem ? "hidden md:flex" : "flex"} flex-col w-full md:w-[280px] shrink-0 bg-white border border-gray-200 rounded-xl overflow-hidden`}
            >
              {loadedThreads.map((lt, idx) => (
                <button
                  key={`${lt.ref.proProfileId}-${lt.thread.id}`}
                  onClick={() => selectThread(idx)}
                  className={`flex items-start gap-3 p-4 border-b last:border-b-0 border-gray-100 text-left hover:bg-gray-50 transition-colors ${
                    selectedIdx === idx ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {proInitials(lt.ref.proName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-sm font-semibold truncate ${lt.ref.unread ? "text-gray-900" : "text-gray-700"}`}>
                        {lt.ref.proName}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {lt.ref.unread && <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />}
                        <span className="text-xs text-gray-400">{formatTimestamp(lt.ref.timestamp)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {lt.thread.preview || "No messages yet"}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Conversation panel */}
            {selectedItem ? (
              <div className="flex-1 bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden">
                {/* Conversation header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
                  <button
                    onClick={() => setSelectedIdx(null)}
                    className="md:hidden text-gray-400 hover:text-gray-700 mr-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-xs flex items-center justify-center shrink-0">
                    {proInitials(selectedItem.ref.proName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{selectedItem.ref.proName}</p>
                  </div>
                  <Link
                    href={`/barber/${selectedItem.ref.proProfileId}`}
                    className="text-xs font-semibold text-[var(--color-primary)] hover:underline shrink-0"
                  >
                    View Profile →
                  </Link>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {selectedItem.thread.messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <p className="text-sm text-gray-400">No messages yet. Say hello!</p>
                    </div>
                  ) : (
                    selectedItem.thread.messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.from === "customer" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            msg.from === "customer"
                              ? "bg-[var(--color-primary)] text-white rounded-br-sm"
                              : "bg-gray-100 text-gray-800 rounded-bl-sm"
                          }`}
                        >
                          {msg.text}
                          <p className={`text-[10px] mt-1 ${msg.from === "customer" ? "text-blue-200" : "text-gray-400"}`}>
                            {msg.time}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply input */}
                {sendError && (
                  <p className="px-4 pb-1 text-xs text-red-500 shrink-0">{sendError}</p>
                )}
                <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    placeholder={`Message ${selectedItem.ref.proName.split(" ")[0]}…`}
                    value={replyText}
                    onChange={(e) => { setReplyText(e.target.value); if (sendError) setSendError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                    className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!replyText.trim()}
                    className="w-9 h-9 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center hover:bg-[#243A6F] transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="hidden md:flex flex-1 bg-white border border-gray-200 rounded-xl items-center justify-center text-gray-400 text-sm">
                Select a conversation
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
