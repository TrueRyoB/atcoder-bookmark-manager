// ==UserScript==
// @name         AtCoder Bookmark Manager
// @namespace    local.safe
// @version      2.0.0
// @description  Bookmark, track, and view AtCoder tasks with persistent GM storage
// @match        https://atcoder.jp/*
// @grant        GM.getValue
// @grant        GM.setValue
// @license      MIT
// ==/UserScript==
 
(async function () {
  "use strict";
 
  const STORAGE_KEY = "ac_bookmarks_v3";
 
  const STATUS = {
    NONE: "none",
    TODO: "todo",
    DONE: "done",
  };
 
  const STATUS_ORDER = {
    [STATUS.TODO]: 0,
    [STATUS.DONE]: 1,
    [STATUS.NONE]: 2,
  };
 
  let overlayEl = null;
  let overlayListEl = null;
  let overlaySearchEl = null;
  let floatingPanelEl = null;
  let bookmarkBtnEl = null;
  let viewerBtnEl = null;
 
  function isTaskPage() {
    return /^\/contests\/[^/]+\/tasks\/[^/]+$/.test(location.pathname);
  }
 
  function canonicalUrl() {
    return `${location.origin}${location.pathname}`;
  }
 
  function getTaskMeta() {
    const url = canonicalUrl();
    const pathMatch = location.pathname.match(/^\/contests\/([^/]+)\/tasks\/([^/]+)$/);
 
    const contestId = pathMatch?.[1] ?? "";
    const taskId = pathMatch?.[2] ?? "";
 
    const title =
      document.querySelector("h1")?.textContent?.trim() ||
      document.querySelector("h2")?.textContent?.trim() ||
      document.title.replace(/\s*-\s*AtCoder\s*$/, "").trim() ||
      "unknown";
 
    return {
      url,
      title,
      contestId,
      taskId,
    };
  }
 
  async function loadData() {
    const raw = await GM.getValue(STORAGE_KEY, "{}");
 
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    }
 
    return raw && typeof raw === "object" ? raw : {};
  }
 
  async function saveData(data) {
    await GM.setValue(STORAGE_KEY, JSON.stringify(data));
  }
 
  function getStatusText(status) {
    switch (status) {
      case STATUS.TODO:
        return "★";
      case STATUS.DONE:
        return "✓";
      default:
        return "☆";
    }
  }
 
  function getStatusLabel(status) {
    switch (status) {
      case STATUS.TODO:
        return "todo";
      case STATUS.DONE:
        return "done";
      default:
        return "none";
    }
  }
 
  function nextStatus(status) {
    switch (status) {
      case STATUS.NONE:
        return STATUS.TODO;
      case STATUS.TODO:
        return STATUS.DONE;
      default:
        return STATUS.NONE;
    }
  }
 
  function makeButton(label) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.cssText = `
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 999px;
      background: white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.18);
      font-size: 20px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      user-select: none;
    `;
    return btn;
  }
 
  function ensureFloatingPanel() {
    if (floatingPanelEl) return floatingPanelEl;
 
    const panel = document.createElement("div");
    panel.id = "ac-bookmark-panel";
    panel.style.cssText = `
      position: fixed;
      right: 12px;
      bottom: 12px;
      z-index: 999999;
      display: flex;
      gap: 8px;
      align-items: center;
    `;
 
    bookmarkBtnEl = makeButton("☆");
    bookmarkBtnEl.id = "ac-bookmark-btn";
    bookmarkBtnEl.title = "Bookmark this problem";
 
    viewerBtnEl = document.createElement("button");
    viewerBtnEl.type = "button";
    viewerBtnEl.textContent = "Bookmarks";
    viewerBtnEl.title = "Open bookmark viewer";
    viewerBtnEl.style.cssText = `
      height: 40px;
      padding: 0 12px;
      border: none;
      border-radius: 999px;
      background: black;
      color: white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.18);
      font-size: 14px;
      cursor: pointer;
      user-select: none;
    `;
 
    panel.appendChild(bookmarkBtnEl);
    panel.appendChild(viewerBtnEl);
    document.body.appendChild(panel);
 
    floatingPanelEl = panel;
    return panel;
  }
 
  function ensureOverlay() {
    if (overlayEl) return overlayEl;
 
    overlayEl = document.createElement("div");
    overlayEl.id = "ac-bookmark-overlay";
    overlayEl.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 1000000;
      background: rgba(0, 0, 0, 0.45);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;
 
    const modal = document.createElement("div");
    modal.style.cssText = `
      width: min(960px, 100%);
      max-height: min(85vh, 900px);
      background: white;
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.28);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
 
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid #e5e7eb;
      background: #fafafa;
    `;
 
    const left = document.createElement("div");
    left.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    `;
 
    const title = document.createElement("div");
    title.textContent = "AtCoder Bookmarks";
    title.style.cssText = `
      font-size: 18px;
      font-weight: 700;
    `;
 
    const subtitle = document.createElement("div");
    subtitle.textContent = "Saved tasks, status, and quick links";
    subtitle.style.cssText = `
      font-size: 12px;
      color: #6b7280;
    `;
 
    left.appendChild(title);
    left.appendChild(subtitle);
 
    const controls = document.createElement("div");
    controls.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    `;
 
    overlaySearchEl = document.createElement("input");
    overlaySearchEl.type = "search";
    overlaySearchEl.placeholder = "Search title / URL";
    overlaySearchEl.style.cssText = `
      width: 260px;
      max-width: 48vw;
      height: 36px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      padding: 0 12px;
      outline: none;
      font-size: 14px;
    `;
 
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "Close";
    closeBtn.style.cssText = `
      height: 36px;
      padding: 0 12px;
      border: none;
      border-radius: 10px;
      background: #111827;
      color: white;
      cursor: pointer;
      font-size: 14px;
    `;
 
    controls.appendChild(overlaySearchEl);
    controls.appendChild(closeBtn);
 
    header.appendChild(left);
    header.appendChild(controls);
 
    overlayListEl = document.createElement("div");
    overlayListEl.style.cssText = `
      overflow: auto;
      padding: 16px;
      display: grid;
      gap: 10px;
      background: white;
    `;
 
    modal.appendChild(header);
    modal.appendChild(overlayListEl);
    overlayEl.appendChild(modal);
    document.body.appendChild(overlayEl);
 
    overlayEl.addEventListener("click", (e) => {
      if (e.target === overlayEl) closeOverlay();
    });
 
    closeBtn.addEventListener("click", closeOverlay);
 
    overlaySearchEl.addEventListener("input", () => {
      renderOverlayList();
    });
 
    return overlayEl;
  }
 
  function closeOverlay() {
    if (overlayEl) overlayEl.style.display = "none";
  }
 
  function openOverlay() {
    ensureOverlay();
    overlayEl.style.display = "flex";
    renderOverlayList();
    overlaySearchEl.value = overlaySearchEl.value || "";
    overlaySearchEl.focus();
  }
 
  async function mutateEntry(url, updater) {
    const data = await loadData();
    const current = data[url] || null;
    const updated = updater(current);
 
    if (updated === null) {
      delete data[url];
    } else {
      data[url] = updated;
    }
 
    await saveData(data);
    await refreshBookmarkButton();
    await renderOverlayList();
  }
 
  async function toggleCurrentTask() {
    const meta = getTaskMeta();
    const data = await loadData();
    const current = data[meta.url] || null;
    const currentStatus = current?.status || STATUS.NONE;
    const newStatus = nextStatus(currentStatus);
 
    if (newStatus === STATUS.NONE) {
      delete data[meta.url];
    } else {
      data[meta.url] = {
        url: meta.url,
        title: meta.title,
        contestId: meta.contestId,
        taskId: meta.taskId,
        status: newStatus,
        savedAt: current?.savedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
 
    await saveData(data);
    await refreshBookmarkButton();
    await renderOverlayList();
  }
 
  async function refreshBookmarkButton() {
    if (!bookmarkBtnEl) return;
 
    if (!isTaskPage()) {
      bookmarkBtnEl.style.display = "none";
      return;
    }
 
    bookmarkBtnEl.style.display = "inline-flex";
 
    const meta = getTaskMeta();
    const data = await loadData();
    const entry = data[meta.url];
    const status = entry?.status || STATUS.NONE;
 
    bookmarkBtnEl.textContent = getStatusText(status);
    bookmarkBtnEl.title =
      status === STATUS.NONE
        ? "Mark as upsolve target"
        : status === STATUS.TODO
          ? "Mark as solved"
          : "Remove bookmark";
  }
 
  function sortEntries(entries) {
    return entries.sort((a, b) => {
      const ao = STATUS_ORDER[a.status] ?? 99;
      const bo = STATUS_ORDER[b.status] ?? 99;
      if (ao !== bo) return ao - bo;
      const at = Date.parse(a.updatedAt || a.savedAt || "");
      const bt = Date.parse(b.updatedAt || b.savedAt || "");
      return (bt || 0) - (at || 0);
    });
  }
 
  async function renderOverlayList() {
    if (!overlayListEl) return;
 
    const data = await loadData();
    const entries = sortEntries(
      Object.values(data).filter((x) => x && typeof x === "object")
    );
 
    const q = (overlaySearchEl?.value || "").trim().toLowerCase();
 
    const filtered = q
      ? entries.filter((e) => {
          const hay = `${e.title || ""} ${e.url || ""} ${e.contestId || ""} ${e.taskId || ""} ${e.status || ""}`.toLowerCase();
          return hay.includes(q);
        })
      : entries;
 
    overlayListEl.innerHTML = "";
 
    const summary = document.createElement("div");
    summary.style.cssText = `
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 2px;
    `;
    summary.textContent = `${filtered.length} / ${entries.length} saved`;
    overlayListEl.appendChild(summary);
 
    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = `
        padding: 24px;
        border: 1px dashed #d1d5db;
        border-radius: 12px;
        color: #6b7280;
        background: #fafafa;
      `;
      empty.textContent = "No saved entries.";
      overlayListEl.appendChild(empty);
      return;
    }
 
    for (const entry of filtered) {
      const row = document.createElement("div");
      row.style.cssText = `
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 14px 16px;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
      `;
 
      const left = document.createElement("div");
      left.style.cssText = `
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      `;
 
      const topLine = document.createElement("div");
      topLine.style.cssText = `
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      `;
 
      const link = document.createElement("a");
      link.href = entry.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = entry.title || entry.url;
      link.style.cssText = `
        color: #0366d6;
        text-decoration: none;
        font-weight: 600;
        word-break: break-word;
      `;
 
      const badge = document.createElement("span");
      badge.textContent = getStatusLabel(entry.status || STATUS.NONE);
      badge.style.cssText = `
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 999px;
        background: #f3f4f6;
        color: #374151;
      `;
 
      const meta = document.createElement("div");
      meta.style.cssText = `
        font-size: 12px;
        color: #6b7280;
        word-break: break-word;
      `;
      meta.textContent = `${entry.contestId || ""}${entry.contestId && entry.taskId ? " / " : ""}${entry.taskId || ""}  ${entry.savedAt ? "・ " + new Date(entry.savedAt).toLocaleString() : ""}`;
 
      topLine.appendChild(link);
      topLine.appendChild(badge);
      left.appendChild(topLine);
      left.appendChild(meta);
 
      const actions = document.createElement("div");
      actions.style.cssText = `
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
        justify-content: flex-end;
      `;
 
      const cycleBtn = document.createElement("button");
      cycleBtn.type = "button";
      cycleBtn.textContent = "Toggle";
      cycleBtn.style.cssText = `
        height: 34px;
        padding: 0 12px;
        border: none;
        border-radius: 10px;
        background: #111827;
        color: white;
        cursor: pointer;
        font-size: 13px;
      `;
      cycleBtn.title = "Cycle status: none → todo → done → none";
 
      cycleBtn.addEventListener("click", async () => {
        await mutateEntry(entry.url, (current) => {
          const curStatus = current?.status || STATUS.NONE;
          const newStatus = nextStatus(curStatus);
 
          if (newStatus === STATUS.NONE) {
            return null;
          }
 
          return {
            ...(current || {}),
            url: entry.url,
            title: entry.title || current?.title || entry.url,
            contestId: entry.contestId || current?.contestId || "",
            taskId: entry.taskId || current?.taskId || "",
            status: newStatus,
            savedAt: current?.savedAt || entry.savedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });
      });
 
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.textContent = "Delete";
      deleteBtn.style.cssText = `
        height: 34px;
        padding: 0 12px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        background: white;
        color: #111827;
        cursor: pointer;
        font-size: 13px;
      `;
      deleteBtn.title = "Remove this bookmark";
 
      deleteBtn.addEventListener("click", async () => {
        await mutateEntry(entry.url, () => null);
      });
 
      actions.appendChild(cycleBtn);
      actions.appendChild(deleteBtn);
 
      row.appendChild(left);
      row.appendChild(actions);
      overlayListEl.appendChild(row);
    }
  }
 
  function wireEvents() {
    if (bookmarkBtnEl) {
      bookmarkBtnEl.addEventListener("click", toggleCurrentTask);
    }
 
    if (viewerBtnEl) {
      viewerBtnEl.addEventListener("click", openOverlay);
    }
  }
 
  async function init() {
    if (!document.body) {
      window.addEventListener("DOMContentLoaded", init, { once: true });
      return;
    }
 
    ensureFloatingPanel();
    wireEvents();
    await refreshBookmarkButton();
  }
 
  await init();
})();
