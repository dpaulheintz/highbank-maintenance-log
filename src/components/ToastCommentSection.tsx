"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { sendToastEmail } from "@/lib/email";
import type { ToastComment, ToastRequest } from "@/lib/types";

interface Props {
  request: ToastRequest;
}

export default function ToastCommentSection({ request }: Props) {
  const [comments, setComments] = useState<ToastComment[]>([]);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from("toast_comments")
      .select("*")
      .eq("toast_request_id", request.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setComments(data as ToastComment[]);
      });
  }, [request.id]);

  async function uploadFiles(): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from("toast-attachments")
        .upload(path, file);
      if (!error) {
        const { data } = supabase.storage
          .from("toast-attachments")
          .getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);

    const attachmentUrls = await uploadFiles();

    const { data, error } = await supabase
      .from("toast_comments")
      .insert({
        toast_request_id: request.id,
        author: "Charles",
        body: body.trim(),
        attachment_urls: attachmentUrls,
      })
      .select()
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, data as ToastComment]);

      sendToastEmail({
        type: "toast_comment",
        toastRequest: {
          submitter_name: request.submitter_name,
          submitter_email: request.submitter_email,
          location: request.location,
          change_type: request.change_type,
          menu_item_name: request.menu_item_name,
          current_value: request.current_value,
          requested_change: request.requested_change,
          notes_for_charles: request.notes_for_charles,
        },
        commentText: body.trim(),
        commentAuthor: "Charles",
        attachmentUrls,
      });

      setBody("");
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
    }
    setSubmitting(false);
  }

  function isImage(url: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  }

  function fileName(url: string): string {
    return decodeURIComponent(url.split("/").pop() || "file");
  }

  return (
    <div className="border-t border-border pt-3 mt-1">
      <h4 className="text-[10px] font-medium text-accent uppercase tracking-wide mb-2">Comments</h4>

      {comments.length > 0 && (
        <div className="space-y-2.5 mb-3 max-h-48 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="text-sm border-l-2 border-accent/30 pl-3">
              <div className="flex gap-2 items-baseline">
                <span className="font-medium text-xs text-accent">{c.author}</span>
                <span className="text-[10px] text-text-muted">
                  {new Date(c.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-text text-sm mt-0.5 whitespace-pre-wrap">{c.body}</p>
              {c.attachment_urls && c.attachment_urls.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {c.attachment_urls.map((url, i) =>
                    isImage(url) ? (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`Attachment ${i + 1}`}
                          className="w-14 h-14 object-cover rounded border border-border hover:border-accent transition-colors"
                        />
                      </a>
                    ) : (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-accent hover:underline bg-surface px-2 py-1 rounded border border-border"
                      >
                        {fileName(url)}
                      </a>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          placeholder="Add a comment..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="edit-input resize-none text-sm"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-[10px] text-text-muted hover:text-accent cursor-pointer flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            {files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : "Attach files"}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
            className="hidden"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="ml-auto px-3 py-1 bg-accent text-bg text-[11px] font-medium rounded hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Posting..." : "Post Comment"}
          </button>
        </div>
      </form>
    </div>
  );
}
