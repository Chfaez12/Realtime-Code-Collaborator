import { useEffect, useState } from "react";
import type { WebsocketProvider } from "y-websocket";
import { getUserIdentity } from "../utils/userIdentity";

export interface AwarenessUser {
  clientId: number;
  name: string;
  color: string;
}

const sameUsers = (a: AwarenessUser[], b: AwarenessUser[]) =>
  a.length === b.length &&
  a.every((u, i) => u.clientId === b[i].clientId && u.name === b[i].name && u.color === b[i].color);

export function useAwareness(provider: WebsocketProvider | null, displayName?: string) {
  const [users, setUsers] = useState<AwarenessUser[]>([]);

  // Set this client's own identity once the provider exists
  useEffect(() => {
    if (!provider) return;

    // Colors already used by others in the room, so we avoid duplicates
    const taken: string[] = [];
    provider.awareness.getStates().forEach((state, id) => {
      if (id !== provider.awareness.clientID && state.user?.color) {
        taken.push(state.user.color);
      }
    });

    const identity = getUserIdentity(taken);
    provider.awareness.setLocalStateField("user", {
      name: displayName || identity.name,
      color: identity.color,
    });
  }, [provider, displayName]);

  // Listen for everyone's awareness state changing (join/leave/cursor move)
  useEffect(() => {
    if (!provider) return;

    const updateUsers = () => {
      const states = provider.awareness.getStates();
      const list: AwarenessUser[] = [];

      states.forEach((state, clientId) => {
        if (state.user) {
          list.push({
            clientId,
            name: state.user.name,
            color: state.user.color,
          });
        }
      });

      list.sort((a, b) => a.clientId - b.clientId);
      setUsers((prev) => (sameUsers(prev, list) ? prev : list));
    };

    provider.awareness.on("change", updateUsers);
    updateUsers();

    return () => {
      provider.awareness.off("change", updateUsers);
    };
  }, [provider]);

  return users;
}