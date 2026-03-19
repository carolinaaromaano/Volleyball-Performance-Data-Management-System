import React, { useMemo, useState } from "react";
import LoginForm from "./components/LoginForm.jsx";
import TeamsPage from "./components/TeamsPage.jsx";
import { getToken } from "./api/client.js";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => Boolean(getToken()));

  const content = useMemo(() => {
    if (!loggedIn) {
      return (
        <LoginForm
          onLoggedIn={() => {
            setLoggedIn(true);
          }}
        />
      );
    }
    return <TeamsPage />;
  }, [loggedIn]);

  return (
    <div className="app">
      <h1 style={{ marginTop: 0, marginBottom: 16 }}>Volleyball Performance</h1>
      {content}
    </div>
  );
}

