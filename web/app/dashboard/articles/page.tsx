"use client";

import React, { useState } from "react";
import { useClub, TrackType } from "@/lib/useClubStore";
import styles from "./articles.module.css";

export default function ArticlesPage() {
  const { articles, addArticle } = useClub();
  const [filterType, setFilterType] = useState<"all" | "papers" | "blogs">("all");
  const [showNewModal, setShowNewModal] = useState(false);

  // New Article Form
  const [newTitle, setNewTitle] = useState("");
  const [newExcerpt, setNewExcerpt] = useState("");
  const [newTrack, setNewTrack] = useState<TrackType>("Research");
  const [isPaper, setIsPaper] = useState(false);
  const [tagsInput, setTagsInput] = useState("PyTorch, Deep Learning");

  const filteredArticles = articles.filter((art) => {
    if (filterType === "papers") return art.isPaper;
    if (filterType === "blogs") return !art.isPaper;
    return true;
  });

  const handleCreateArticle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    addArticle({
      title: newTitle,
      excerpt: newExcerpt,
      author: "Julian Chen",
      authorTrack: newTrack,
      publishDate: "Just now",
      readTime: "5 min read",
      tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      peerReviewed: isPaper,
      isPaper
    });

    setShowNewModal(false);
    setNewTitle("");
    setNewExcerpt("");
  };

  return (
    <div className={styles.articlesPage}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Article Hub & Research Papers</h1>
          <p className={styles.pageSubtitle}>
            Technical writeups, reproduced research papers, and competition post-mortems written by SST club members.
          </p>
        </div>

        <button
          type="button"
          className={styles.newArticleBtn}
          onClick={() => setShowNewModal(true)}
        >
          + Publish Article
        </button>
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterTabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${filterType === "all" ? styles.tabActive : ""}`}
          onClick={() => setFilterType("all")}
        >
          All Publications ({articles.length})
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${filterType === "papers" ? styles.tabActive : ""}`}
          onClick={() => setFilterType("papers")}
        >
          Research Papers
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${filterType === "blogs" ? styles.tabActive : ""}`}
          onClick={() => setFilterType("blogs")}
        >
          Engineering Blogs
        </button>
      </div>

      {/* Articles List */}
      <div className={styles.articlesList}>
        {filteredArticles.map((art) => (
          <article key={art.id} className={styles.articleCard}>
            <div className={styles.cardHeader}>
              <div className={styles.tagWrap}>
                <span className={art.isPaper ? styles.paperTag : styles.blogTag}>
                  {art.isPaper ? "RESEARCH PAPER" : "ENGINEERING BLOG"}
                </span>
                <span className={styles.trackTag}>{art.authorTrack.toUpperCase()} TRACK</span>
                {art.peerReviewed && (
                  <span className={styles.peerBadge}>✓ Peer Reviewed</span>
                )}
              </div>
              <span className={styles.viewCount}>{art.views}</span>
            </div>

            <h2 className={styles.articleTitle}>{art.title}</h2>
            <p className={styles.articleExcerpt}>{art.excerpt}</p>

            <div className={styles.tagsRow}>
              {art.tags.map((tag) => (
                <span key={tag} className={styles.tagPill}>
                  #{tag}
                </span>
              ))}
            </div>

            <div className={styles.cardFooter}>
              <div className={styles.authorMeta}>
                <div className={styles.authorAvatar}>
                  {art.author.split(" ").map((n) => n[0]).join("")}
                </div>
                <span>By <strong>{art.author}</strong></span>
                <span>•</span>
                <span>{art.publishDate}</span>
                <span>•</span>
                <span>{art.readTime}</span>
              </div>

              <button
                type="button"
                className={styles.readBtn}
                onClick={() => alert(`Reading "${art.title}"`)}
              >
                Read Article →
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* Publish Article Modal */}
      {showNewModal && (
        <div className={styles.modalOverlay} onClick={() => setShowNewModal(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Publish Article or Research Paper</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setShowNewModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateArticle} className={styles.articleForm}>
              <div className={styles.formGroup}>
                <label>Article Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scaling GNN Architectures on Distributed GPUs"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={styles.inputField}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Track Category</label>
                  <select
                    value={newTrack}
                    onChange={(e) => setNewTrack(e.target.value as TrackType)}
                    className={styles.inputField}
                  >
                    <option value="Research">Research Track</option>
                    <option value="Kaggle">Kaggle Track</option>
                    <option value="Product">Product Track</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Publication Type</label>
                  <select
                    value={isPaper ? "paper" : "blog"}
                    onChange={(e) => setIsPaper(e.target.value === "paper")}
                    className={styles.inputField}
                  >
                    <option value="paper">Formal Research Paper (RE:Thesis)</option>
                    <option value="blog">Technical Engineering Blog</option>
                  </select>
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Summary / Abstract</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide a concise summary of the core thesis, experimental results, or implementation..."
                  value={newExcerpt}
                  onChange={(e) => setNewExcerpt(e.target.value)}
                  className={styles.textareaField}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Tags (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="PyTorch, Graph Neural Networks, CUDA"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className={styles.inputField}
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowNewModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn}>
                  Publish to Hub
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
