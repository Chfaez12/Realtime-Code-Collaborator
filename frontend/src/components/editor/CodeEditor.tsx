import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
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
import ParticipantList from "../session/ParticipantList";
import ShareLinkModal from "../session/ShareLinkModal";
import SessionSettings from "../session/SessionSettings";
import PermissionToggle from "../session/PermissionToggle";
import HistoryModal from "../history/HistoryModal";
import ChatPanel from "../chat/ChatPanel";
import CommentsPanel from "../comments/CommentsPanel";
import RunButton from "../execution/RunButton";
import OutputConsole from "../execution/OutputConsole";
import LanguageSelector from "./LanguageSelector";
import { DEFAULT_LANGUAGE, LANGUAGES, type LanguageOption } from "../../utils/languages";
import { useAuth } from "../../hooks/useAuth";
import ExportGitHubModal from "../session/ExportGitHubModal";


interface CodeEditorProps {
  roomName: string;
  displayName?: string;
  onAuthRejected?: () => void; // called when the server refuses our password
}

const headerButton: CSSProperties = {
  fontSize: "12px",
  padding: "4px 10px",
  background: "#1e1e1e",
  color: "#fff",
  border: "1px solid #444",
  borderRadius: "4px",
  cursor: "pointer",
};

export default function CodeEditor({ roomName, displayName, onAuthRejected }: CodeEditorProps) {
  // ---------- Shared document, presence, cursors ----------
  const { doc, provider, isConnected } = useYjsDoc(roomName, onAuthRejected, displayName);
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
  // ---------- Chat ----------
  const { messages, send } = useChat(doc);
  const [showChat, setShowChat] = useState(true);
  const [seenAt, setSeenAt] = useState(Date.now());

  // While the panel is open, everything counts as seen
  useEffect(() => {
    if (showChat && messages.length > 0) {
      setSeenAt(messages[messages.length - 1].timestamp);
    }
  }, [showChat, messages]);

  const unread = showChat
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
  const [showComments, setShowComments] = useState(false);
  const [composerLine, setComposerLine] = useState(1);
  const [focusTick, setFocusTick] = useState(0);
  const [selection, setSelection] = useState<{ line: number; tick: number } | null>(null);

  const openComposer = useCallback((line: number) => {
    setComposerLine(line);
    setShowComments(true);
    setFocusTick((t) => t + 1);
  }, []);
  const openLine = useCallback((line: number) => {
    setShowComments(true);
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
  };

  // ---------- Code execution (interactive console) ----------
  const runner = useCodeRunner(roomName, language.monacoId);

  const handleEditorMount: OnMount = (editorInstance, monacoInstance) => {
    editorRef.current = editorInstance;
    monacoRef.current = monacoInstance;
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

  // ---------- Main UI ----------
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: isConnected ? "green" : "orange" }}>
            {isConnected ? "● Connected" : "○ Connecting..."}
          </span>
          <LanguageSelector selected={language} onChange={handleLanguageChange} disabled={isReadOnly} />
          <RunButton onClick={handleRun} isRunning={runner.status === "running"} disabled={!isEditorReady} />
          <button onClick={() => setShowShare(true)} style={headerButton}>
            🔗 Share
          </button>
          <PermissionToggle isOwner={isOwner} canEdit={canEdit} onChange={setCanEdit} />
          {isOwner && (
            <button onClick={() => setShowSettings(true)} style={headerButton}>
              ⚙ Settings
            </button>
          )}
          <button onClick={() => setShowHistory(true)} style={headerButton}>
            🕘 History
          </button>
          {isOwner && (
               <button onClick={() => setShowExport(true)} style={headerButton}>
                 ⬆ GitHub
               </button>
             )}
          <button onClick={() => setShowComments((v) => !v)} style={headerButton}>
            💭 Comments{commentsApi.comments.length > 0 ? ` (${commentsApi.comments.length})` : ""}
          </button>
          <button onClick={() => setShowChat((v) => !v)} style={headerButton}>
            💬 Chat
            {unread > 0 && (
              <span
                style={{
                  marginLeft: "6px", padding: "0 6px", borderRadius: "8px",
                  background: "#ef4444", color: "#fff", fontSize: "11px",
                }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
          {followed && (
            <span
              style={{
                fontSize: "12px", padding: "3px 8px", borderRadius: "4px",
                background: "#1e3a8a", color: "#bfdbfe", display: "flex", alignItems: "center", gap: "8px",
              }}
            >
              Following <strong style={{ color: followed.color }}>{followed.name}</strong>
              <button
                onClick={follow.stop}
                style={{ background: "transparent", border: "none", color: "#bfdbfe", cursor: "pointer", fontSize: "12px" }}
              >
                Stop
              </button>
            </span>
          )}
        </div>
        <ParticipantList
          users={users}
          myClientId={me?.clientId}
          followingId={follow.followingId}
          onToggleFollow={follow.toggle}
        />
      </div>

      {/* Editor + console on the left, side panels on the right */}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, minHeight: 0 }}>
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
        </div>

        {showComments && (
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
            onClose={() => setShowComments(false)}
          />
        )}

        {showChat && (
                    <ChatPanel
            messages={messages}
            me={me}
            onSend={(msg) => send({ ...msg, userId: user?.id })}
            onClose={() => setShowChat(false)}
          />
        )}
      </div>

      {/* Modals */}
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