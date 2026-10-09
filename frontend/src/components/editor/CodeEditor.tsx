import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { MonacoBinding } from "y-monaco";
import type * as monaco from "monaco-editor";
import { useYjsDoc } from "../../hooks/useYjsDoc";
import { useAwareness } from "../../hooks/useAwareness";
import { useRemoteCursorStyles } from "../../hooks/useRemoteCursorStyles";
import { useSession } from "../../hooks/useSession";
import { usePermissions } from "../../hooks/usePermissions";
import { useChat } from "../../hooks/useChat";
import { useCodeRunner } from "../../hooks/useCodeRunner";
import { useFollowMode } from "../../hooks/useFollowMode";
import { useComments } from "../../hooks/useComments";
import { useAuthorKey } from "../../hooks/useAuthorKey";
import { useAuth } from "../../hooks/useAuth";
import { useAiChat } from "../../hooks/useAiChat";
import { useAiReview } from "../../hooks/useAiReview";
import { useAiCompletions } from "../../hooks/useAiCompletions";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import ParticipantList from "../session/ParticipantList";
import ShareLinkModal from "../session/ShareLinkModal";
import SessionSettings from "../session/SessionSettings";
import ViewOnlyBadge from "../session/ViewOnlyBadge";
import ExportGitHubModal from "../session/ExportGitHubModal";
import HistoryModal from "../history/HistoryModal";
import ChatPanel from "../chat/ChatPanel";
import CommentsPanel from "../comments/CommentsPanel";
import AiPanel from "../ai/AiPanel";
import RunButton from "../execution/RunButton";
import OutputConsole from "../execution/OutputConsole";
import LanguageSelector from "./LanguageSelector";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import DropdownMenu, { type MenuItem } from "../ui/DropdownMenu";
import {
  ArrowLeftIcon,
  ChatIcon,
  ClockIcon,
  CommentIcon,
  LinkIcon,
  LockIcon,
  MoreIcon,
  SlidersIcon,
  SparklesIcon,
  UploadIcon,
} from "../ui/Icons";
import { cn } from "../../utils/cn";
import { registerLanguageCompletions } from "../../utils/completions";
import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageOption } from "../../utils/languages";

interface CodeEditorProps {
  roomName: string;
  displayName?: string;
  onAuthRejected?: () => void; // called when the server refuses our password
  onSessionEnded?: () => void; // called when the session expires or is deleted
}

type Panel = "chat" | "comments" | "ai";

const AI_SUGGESTIONS_KEY = "collab-ai-suggestions";

function readSuggestionsPreference(): boolean {
  try {
    return localStorage.getItem(AI_SUGGESTIONS_KEY) === "1";
  } catch {
    return false; // off unless the person turned it on
  }
}

export default function CodeEditor({ roomName, displayName, onAuthRejected, onSessionEnded }: CodeEditorProps) {
  // ---------- Shared document, presence, cursors ----------
  const { doc, provider, isConnected } = useYjsDoc(roomName, onAuthRejected, displayName, onSessionEnded);
  const users = useAwareness(provider, displayName);
  useRemoteCursorStyles(users);

  // ---------- Ownership and permissions ----------
  const { isOwner } = useSession(roomName);
  const { canEdit, setCanEdit } = usePermissions(doc);
  const isReadOnly = !isOwner && !canEdit; // the owner is never locked out

  // ---------- Who am I in this room ----------
  const me = users.find((u) => u.clientId === provider?.awareness.clientID) ?? null;
  const authorKey = useAuthorKey();
  const { user } = useAuth();

  // ---------- Layout ----------
  const isNarrow = useMediaQuery("(max-width: 767px)");
  // One side panel at a time. On large screens it docks beside the editor, on small ones it slides over it.
  const [activePanel, setActivePanel] = useState<Panel | null>(() =>
    window.matchMedia("(min-width: 1024px)").matches ? "chat" : null
  );
  const togglePanel = (panel: Panel) => setActivePanel((current) => (current === panel ? null : panel));
  const closePanel = useCallback(() => setActivePanel(null), []);

  // ---------- Chat ----------
  const { messages, send } = useChat(doc);
  const chatOpen = activePanel === "chat";
  const [seenAt, setSeenAt] = useState(Date.now());

  // While the chat is open, everything counts as seen
  useEffect(() => {
    if (chatOpen && messages.length > 0) {
      setSeenAt(messages[messages.length - 1].timestamp);
    }
  }, [chatOpen, messages]);

  const unread = chatOpen
    ? 0
    : messages.filter((m) => m.timestamp > seenAt && m.clientId !== me?.clientId).length;

  // ---------- Editor state ----------
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [language, setLanguage] = useState<LanguageOption>(DEFAULT_LANGUAGE);
  const editor = isEditorReady ? editorRef.current : null;
  const monacoApi = isEditorReady ? monacoRef.current : null;

  // ---------- Modals ----------
  const [showShare, setShowShare] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // ---------- Follow mode ----------
  const follow = useFollowMode(provider, editor, monacoApi);
  const followed = users.find((u) => u.clientId === follow.followingId) ?? null;

  // ---------- Inline comments ----------
  const [composerLine, setComposerLine] = useState(1);
  const [focusTick, setFocusTick] = useState(0);
  const [selection, setSelection] = useState<{ line: number; tick: number } | null>(null);

  const openComposer = useCallback((line: number) => {
    setComposerLine(line);
    setActivePanel("comments");
    setFocusTick((t) => t + 1);
  }, []);
  const openLine = useCallback((line: number) => {
    setActivePanel("comments");
    setSelection((s) => ({ line, tick: (s?.tick ?? 0) + 1 }));
  }, []);

  const commentsApi = useComments(doc, editor, monacoApi, {
    onAddRequest: openComposer,
    onOpenLine: openLine,
  });

  const addComment = (line: number, text: string) =>
    commentsApi.add(line, text, {
      name: me?.name ?? "Guest",
      color: me?.color ?? "#888888",
      authorKey,
    });

  const jumpToLine = (line: number) => {
    editorRef.current?.revealLineInCenter(line);
    editorRef.current?.setPosition({ lineNumber: line, column: 1 });
    if (isNarrow) closePanel(); // on small screens the panel covers the editor
  };

  // ---------- AI: assistant, review, inline suggestions ----------
  const [aiSuggestions, setAiSuggestions] = useState(readSuggestionsPreference);
  const aiChat = useAiChat(roomName, language.monacoId);
  const aiReview = useAiReview(roomName, language.monacoId, editor, monacoApi);
  const suggestionProblem = useAiCompletions({
    editor,
    monacoApi,
    sessionId: roomName,
    enabled: aiSuggestions && !isReadOnly,
  });

  const toggleSuggestions = () => {
    const next = !aiSuggestions;
    setAiSuggestions(next);
    try {
      localStorage.setItem(AI_SUGGESTIONS_KEY, next ? "1" : "0");
    } catch {
      /* the choice just won't be remembered */
    }
  };

  const getSelection = () => {
    const ed = editorRef.current;
    const sel = ed?.getSelection();
    const model = ed?.getModel();
    if (!ed || !sel || !model || sel.isEmpty()) return null;
    return { text: model.getValueInRange(sel), startLine: sel.startLineNumber };
  };

  const insertAtCursor = (code: string) => {
    const ed = editorRef.current;
    const sel = ed?.getSelection();
    if (!ed || !sel || isReadOnly) return;
    ed.executeEdits("ai-insert", [{ range: sel, text: code, forceMoveMarkers: true }]);
    ed.focus();
  };

  // ---------- Code execution (interactive console) ----------
  const runner = useCodeRunner(roomName, language.monacoId);

  const handleEditorMount: OnMount = (editorInstance, monacoInstance) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;
    registerLanguageCompletions(monacoInstance); // suggestion lists for the languages Monaco has no built-in support for
    setIsEditorReady(true);
  };

  // Bind the Monaco model to the shared Y.Text
  useEffect(() => {
    if (!doc || !provider || !isEditorReady || !editorRef.current) return;

    const yText = doc.getText("monaco");
    const model = editorRef.current.getModel();
    if (!model) return;

    const binding = new MonacoBinding(
      yText,
      model,
      new Set([editorRef.current]),
      provider.awareness
    );

    return () => {
      binding.destroy();
    };
  }, [doc, provider, isEditorReady]);

  // Sync the selected language into shared Yjs state so everyone sees the same language
  useEffect(() => {
    if (!doc) return;
    const langMap = doc.getMap("settings");

    const applyRemoteLanguage = () => {
      const remoteLang = langMap.get("language");
      const langOption = LANGUAGES.find((l) => l.monacoId === remoteLang);
      if (langOption) setLanguage(langOption);
    };

    langMap.observe(applyRemoteLanguage);
    applyRemoteLanguage();

    return () => {
      langMap.unobserve(applyRemoteLanguage);
    };
  }, [doc]);

  const handleLanguageChange = (lang: LanguageOption) => {
    if (isReadOnly) return;
    setLanguage(lang);
    if (doc) {
      doc.getMap("settings").set("language", lang.monacoId);
    }
  };

  const handleRun = () => {
    if (!editorRef.current || runner.status === "running") return;
    runner.run(editorRef.current.getValue());
  };

  // ---------- The ⋯ menu ----------
  const menuItems: MenuItem[] = [
    { id: "history", label: "Version history", icon: <ClockIcon size={15} />, onSelect: () => setShowHistory(true) },
    {
      id: "suggestions",
      label: "AI suggestions",
      icon: <SparklesIcon size={15} />,
      checked: aiSuggestions,
      onSelect: toggleSuggestions,
    },
    {
      id: "guests",
      label: "Guests can edit",
      icon: <LockIcon size={15} />,
      checked: canEdit,
      hidden: !isOwner,
      onSelect: () => setCanEdit(!canEdit),
    },
    {
      id: "settings",
      label: "Session settings",
      icon: <SlidersIcon size={15} />,
      hidden: !isOwner,
      onSelect: () => setShowSettings(true),
    },
    {
      id: "export",
      label: "Export to GitHub",
      icon: <UploadIcon size={15} />,
      hidden: !isOwner,
      onSelect: () => setShowExport(true),
    },
  ];

  // ---------- Main UI ----------
  return (
    <div className="flex h-dvh flex-col bg-canvas text-neutral-200">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-2 py-2 sm:px-3">
        <div className="flex items-center gap-2">
          <Link
            to={user ? "/dashboard" : "/"}
            title={user ? "Back to your sessions" : "Back to home"}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-raised px-2 text-xs text-neutral-200 transition-colors hover:bg-[#2d2d30] md:h-8"
          >
            <ArrowLeftIcon size={14} />
            <span className="hidden sm:inline">{user ? "Dashboard" : "Home"}</span>
          </Link>
          <span
            title={isConnected ? "Connected" : "Connecting..."}
            className={cn("h-2.5 w-2.5 shrink-0 rounded-full", isConnected ? "bg-emerald-500" : "animate-pulse bg-amber-500")}
          />
          <LanguageSelector selected={language} onChange={handleLanguageChange} disabled={isReadOnly} />
          <RunButton onClick={handleRun} isRunning={runner.status === "running"} disabled={!isEditorReady} />
          <ViewOnlyBadge isOwner={isOwner} canEdit={canEdit} />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <ParticipantList
            users={users}
            myClientId={me?.clientId}
            followingId={follow.followingId}
            onToggleFollow={follow.toggle}
          />
          <Button onClick={() => setShowShare(true)} aria-label="Share" title="Share this session">
            <LinkIcon size={14} />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <IconButton label="Comments" active={activePanel === "comments"} onClick={() => togglePanel("comments")}>
            <CommentIcon size={15} />
            {commentsApi.comments.length > 0 && <span className="text-[11px] text-muted">{commentsApi.comments.length}</span>}
            <span className="hidden xl:inline">Comments</span>
          </IconButton>
          <IconButton label="AI assistant" active={activePanel === "ai"} onClick={() => togglePanel("ai")}>
            <SparklesIcon size={15} />
            <span className="hidden xl:inline">AI</span>
          </IconButton>
          <IconButton label="Chat" active={activePanel === "chat"} badge={unread} onClick={() => togglePanel("chat")}>
            <ChatIcon size={15} />
            <span className="hidden xl:inline">Chat</span>
          </IconButton>
          <DropdownMenu label="More" trigger={<MoreIcon size={16} />} items={menuItems} />
        </div>
      </header>

      {followed && (
        <div className="flex items-center gap-3 bg-accent-soft px-3 py-1 text-xs text-blue-100">
          <span>
            Following <strong style={{ color: followed.color }}>{followed.name}</strong>
          </span>
          <button type="button" onClick={follow.stop} className="underline hover:text-white">
            Stop
          </button>
        </div>
      )}

      {aiSuggestions && suggestionProblem && (
        <div className="bg-amber-950/60 px-3 py-1 text-xs text-amber-300">
          AI suggestions paused: {suggestionProblem}
        </div>
      )}

      {/* Editor and console on the left, one side panel on the right */}
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <Editor
              height="100%"
              language={language.monacoId}
              defaultValue=""
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                readOnly: isReadOnly,
                readOnlyMessage: { value: "The session owner has set this session to view-only." },
                glyphMargin: true, // room for the comment icons
                inlineSuggest: { enabled: true }, // grey AI suggestions (when switched on)
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                fontSize: isNarrow ? 13 : 14,
                wordWrap: isNarrow ? "on" : "off",
                padding: { top: 8 },
                wordBasedSuggestions: false, // our own lists already offer the words in the file
                quickSuggestions: { other: true, comments: false, strings: false },
                suggestOnTriggerCharacters: true,
                snippetSuggestions: "top",
              }}
            />
          </div>

          <OutputConsole
            segments={runner.segments}
            status={runner.status}
            summary={runner.summary}
            onSubmitInput={runner.sendInput}
            onKill={runner.kill}
            onClear={runner.clear}
          />
        </main>

        {activePanel && (
          <>
            {/* Dark backdrop behind the panel on small screens */}
            <button
              type="button"
              aria-label="Close panel"
              onClick={closePanel}
              className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            />
            {/* The panels still carry their own fixed widths until round 2, so the wrapper overrides them */}
            <aside className="fixed inset-y-0 right-0 z-40 flex w-[min(100vw,24rem)] flex-col border-l border-line bg-surface shadow-2xl lg:static lg:z-auto lg:w-80 lg:shadow-none xl:w-96 [&>*]:h-full! [&>*]:w-full! [&>*]:border-l-0!">
              {activePanel === "comments" && (
                <CommentsPanel
                  comments={commentsApi.comments}
                  myKey={authorKey}
                  isOwner={isOwner}
                  composerLine={composerLine}
                  onComposerLineChange={setComposerLine}
                  focusTick={focusTick}
                  selection={selection}
                  getLineText={(line) => editorRef.current?.getModel()?.getLineContent(line) ?? ""}
                  onAdd={addComment}
                  onDelete={commentsApi.remove}
                  onJump={jumpToLine}
                  onClose={closePanel}
                />
              )}
              {activePanel === "ai" && (
                <AiPanel
                  chat={aiChat}
                  review={aiReview}
                  getSelection={getSelection}
                  canInsert={!isReadOnly}
                  onInsert={insertAtCursor}
                  onJump={jumpToLine}
                  onClose={closePanel}
                />
              )}
              {activePanel === "chat" && (
                <ChatPanel
                  messages={messages}
                  me={me}
                  onSend={(msg) => send({ ...msg, userId: user?.id })}
                  onClose={closePanel}
                />
              )}
            </aside>
          </>
        )}
      </div>

      {/* Modals (restyled in round 2) */}
      {showShare && <ShareLinkModal sessionId={roomName} onClose={() => setShowShare(false)} />}
      {showSettings && <SessionSettings sessionId={roomName} onClose={() => setShowSettings(false)} />}
      {showHistory && (
        <HistoryModal
          sessionId={roomName}
          isOwner={isOwner}
          language={language.monacoId}
          getCurrentCode={() => editorRef.current?.getValue() ?? ""}
          onClose={() => setShowHistory(false)}
        />
      )}
      {showExport && (
        <ExportGitHubModal
          sessionId={roomName}
          defaultFilename={`main.${language.extension}`}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}