"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Comment } from "@/lib/types";

export default function CommentSection({ issueId }: { issueId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("comments")
      .select("*")
      .eq("issue_id", issueId)
      .eq("is_update", false)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setComments(data as Comment[]);
      });
  }, [issueId, open]);

  useEffect(() => {
    const saved = localStorage.getItem("hb_reported_by");
    if (saved) setAuthor(saved);
  }, []);

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !author.trim()) return;
    setSubmitting(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({ issue_id: issueId, author: author.trim(), body: body.trim() })
      .select()
      .single();
    setSubmitting(false);
    if (!error && data) {
      setComments([...comments, data as Comment]);
      setBody("");
      localStorage.setItem("hb_reported_by", author.trim());
    }
  }

  return (
    <div className="border-t border-border pt-3 mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-text-muted hover:text-text cursor-pointer"
      >
        {open ? "Hide Comments" : `Comments${comments.length > 0 ? ` (${comments.length})` : ""}`}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <div className="flex gap-2 items-baseline">
                <span className="font-medium text-xs text-accent">{c.author}</span>
                <span className="text-xs text-text-muted">
                  {new Date(c.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-text text-sm mt-0.5 whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
          <form onSubmit={addComment} className="flex flex-col gap-2">
            <input
              placeholder="Your name"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="edit-input"
            />
            <textarea
              placeholder="Add a comment…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              className="edit-input resize-none"
            />
            <button
              type="submit"
              disabled={submitting || !body.trim() || !author.trim()}
              className="self-start px-3 py-1.5 bg-accent text-bg text-xs font-medium rounded hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Posting…" : "Post Comment"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
