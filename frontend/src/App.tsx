import CodeEditor from "./components/editor/CodeEditor";

function App() {
  // Hardcoded room name for now — later this comes from the session URL/route
  const roomName = "test-room-1";

  return (
    <div style={{ height: "100vh" }}>
      <CodeEditor roomName={roomName} />
    </div>
  );
}

export default App;