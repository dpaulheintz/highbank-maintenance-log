"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { sendEmail, buildEmailIssue } from "@/lib/email";
import type { Comment, IssueWithRelations, Employee } from "@/lib/types";

interface Props {
  issue: IssueWithRelations;
  employees: Employee[];
  locationName: string;
}

export default function UpdateSection({ issue, employees, locationName }: Props) {
  const [updates, setUpdates] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from("comments")
      .select("*")
      .eq("issue_id", issue.id)
      .eq("is_update", true)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setUpdates(data as Comment[]);
      });
  }, [issue.id]);

  useEffect(() => {
    const saved = localStorage.getItem("hb_reported_by");
    if (saved) setAuthor(saved);
  }, []);

  async function postUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !author.trim()) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from("comments")
      .insert({
        issue_id: issue.id,
        author: author.trim(),
        body: body.trim(),
        is_update: true,
      })
      .select()
      .single();

    if (!error && data) {
      setUpdates((prev) => [...prev, data as Comment]);
      localStorage.setItem("hb_reported_by", author.trim());

      const ownerEmployee = issue.employees;
      const managerEmails = (issue.manager_ids || []).map((id) => employees.find((e) => e.id === id)?.email).filter(Boolean) as string[];
      const emailIssue = buildEmailIssue(issue, locationName, issue.vendors?.name || null);
      sendEmail({ type: "job_update", issue: emailIssue, ownerEmail: ownerEmployee?.email, ownerName: ownerEmployee?.name, managerEmails, updateText: body.trim(), updatedBy: author.trim() });

      setBody("");
    }
    setSubmitting(false);
  }

  return (
    <div className="border-t border-border pt-3 mt-3">
      <h4 className="text-xs font-medium text-accent mb-3 uppercase tracking-wide">Updates</h4>

      {updates.length > 0 && (
        <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
          {updates.map((u) => (
            <div key={u.id} className="text-sm border-l-2 border-accent/30 pl-3">
              <div className="flex gap-2 items-baseline">
                <span className="font-medium text-xs text-accent">{u.author}</span>
                <span className="text-xs text-text-muted">
                  {new Date(u.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-text text-sm mt-0.5 whitespace-pre-wrap">{u.body}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={postUpdate} className="flex flex-col gap-2">
        <input
          placeholder="Your name"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="edit-input"
        />
        <textarea
          placeholder="Type an update..."
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
          {submitting ? "Posting..." : "Post Update"}
        </button>
      </form>
    </div>
  );
}
