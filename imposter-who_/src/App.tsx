/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  UserPlus,
  Play,
  Eye,
  EyeOff,
  Vote,
  RefreshCw,
  Trash2,
  Trophy,
  AlertCircle,
  ChevronRight,
  Medal,
  HelpCircle,
  X,
  Info,
  Pencil,
  Check,
  RotateCcw,
  AlertTriangle,
  Ghost,
  MessageSquare,
} from "lucide-react";

// --- Types ---

type GamePhase =
  | "LOBBY"
  | "REVEAL"
  | "CLUES"
  | "VOTING"
  | "RESULT"
  | "LEADERBOARD"
  | "REMOTE_LOBBY"
  | "REMOTE_JOIN";

interface Player {
  id: string;
  name: string;
  isImposter?: boolean;
  team_name?: string;
  is_host?: number;
}

interface Group {
  id: number;
  name: string;
  playerIds: string[];
  score: number;
}

interface GameState {
  players: Player[];
  groups: Group[];
  secretWord: string;
  category: string;
  phase: GamePhase;
  currentRevealIndex: number;
  isWordVisible?: boolean;
  playerVotes: Record<string, string[]>;
  currentVotingPlayerIndex: number;
  numImposters: number;
  discussionStarterId: string | null;
  imposterHintWord: string | null;
  imposterHintWord2: string | null;
}

// --- Constants ---

const CATEGORIES = {
  "Everyday Pinoy Objects": [
    "tabo",
    "electric fan",
    "banig",
    "sari-sari store",
    "payungan",
    "tsinelas",
    "balde",
    "walis tambo",
  ],
  "Pinoy Foods": [
    "adobo",
    "sinigang",
    "balut",
    "lumpia",
    "sisig",
    "halo-halo",
    "lechon",
    "kwek-kwek",
  ],
  "Pinoy Drinks": [
    "gulaman",
    "buko juice",
    "sago",
    "taho",
    "red horse",
    "gin bilog",
    "kape barako",
    "calamansi juice",
  ],
  "Pinoy Games & Sports": [
    "basketball",
    "sepak takraw",
    "patintero",
    "arnis",
    "tumbang preso",
    "piko",
    "sungka",
    "sabong",
  ],
  "PH Places & Landmarks": [
    "boracay",
    "baguio",
    "luneta",
    "mayon",
    "chocolate hills",
    "intramuros",
    "tagaytay",
    "siargao",
  ],
  "Pinoy Icons & Animals": [
    "kalabaw",
    "tarsier",
    "butanding",
    "philippine eagle",
    "askal",
    "maya bird",
    "jeepney",
    "tricycle",
  ],
};

// --- Main Component ---

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    groups: [],
    secretWord: "",
    category: "",
    phase: "LOBBY",
    currentRevealIndex: 0,
    isWordVisible: false,
    playerVotes: {},
    currentVotingPlayerIndex: 0,
    numImposters: 2,
    discussionStarterId: null,
    imposterHintWord: null,
    imposterHintWord2: null,
  });

  const [newGroupName, setNewGroupName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newPlayerNames, setNewPlayerNames] = useState<Record<number, string>>({
    0: "",
    1: "",
    2: "",
    3: "",
    4: "",
  });
  const [teamSize, setTeamSize] = useState(2);
  const [gameMode, setGameMode] = useState<"TEAM" | "SOLO" | "REMOTE">("TEAM");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    Object.keys(CATEGORIES),
  );
  const [showHelp, setShowHelp] = useState(false);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<
    { name: string; score: number; members?: string[]; type: string }[]
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [aiStatus, setAiStatus] = useState<"CHECKING" | "READY" | "ERROR">(
    "CHECKING",
  );
  const [aiError, setAiError] = useState<string>("");

  // --- Remote Play State ---
  const [remoteRoom, setRemoteRoom] = useState<any>(null);
  const [remotePlayerName, setRemotePlayerName] = useState("");
  const [isRemoteHost, setIsRemoteHost] = useState(false);
  const [isHostJoined, setIsHostJoined] = useState(true);
  const [remoteJoinCode, setRemoteJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [localRemoteVotes, setLocalRemoteVotes] = useState<string[]>([]);
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);
  const [remoteLobbyTab, setRemoteLobbyTab] = useState<"PLAYERS" | "BOARD">(
    "PLAYERS",
  );
  const [rankType, setRankType] = useState<"team" | "solo">("team");

  // --- Effects ---

  useEffect(() => {
    checkAiHealth();
    fetchGlobalLeaderboard();
  }, []);

  useEffect(() => {
    if (
      gameState.phase === "LOBBY" ||
      gameState.phase === "REMOTE_LOBBY" ||
      gameState.phase === "LEADERBOARD"
    ) {
      fetchGlobalLeaderboard();
    }
  }, [gameState.phase, rankType]);

  const checkAiHealth = async () => {
    try {
      const res = await fetch("/api/health");
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (data.status === "ok") {
        setAiStatus("READY");
      } else {
        setAiStatus("ERROR");
        setAiError(
          data.details || data.message || "AI Service responded with an error",
        );
      }
    } catch (err: any) {
      console.error("Health check failed:", err);
      setAiStatus("ERROR");
      setAiError(
        err.name === "SyntaxError"
          ? "Invalid response from server (possible 404 or backend not running)"
          : err.message || "Failed to reach game server",
      );
    }
  };

  const fetchGlobalLeaderboard = async () => {
    try {
      const res = await fetch(`/api/leaderboard?type=${rankType}`);
      if (res.ok) {
        const data = await res.json();
        setGlobalLeaderboard(data);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    }
  };

  // --- Actions ---

  const addGroup = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (gameMode === "TEAM") {
      const trimmedGroup = newGroupName.trim();
      const currentNames = Array.from(
        { length: teamSize },
        (_, i) => newPlayerNames[i]?.trim() || "",
      );

      if (trimmedGroup && currentNames.every((name) => name)) {
        // Validation
        const groupExists = gameState.groups.some(
          (g) => g.name.toLowerCase() === trimmedGroup.toLowerCase(),
        );

        if (groupExists) {
          alert(`The team name "${trimmedGroup}" is already taken!`);
          return;
        }

        // Check for duplicate names within the team being added
        const lowerNames = currentNames.map((n) => n.toLowerCase());
        const hasSelfDuplicate = lowerNames.some(
          (val, i) => lowerNames.indexOf(val) !== i,
        );
        if (hasSelfDuplicate) {
          alert("Teammates cannot have the same name!");
          return;
        }

        // Check for duplicates against existing players
        for (const name of currentNames) {
          if (
            gameState.players.some(
              (p) => p.name.toLowerCase() === name.toLowerCase(),
            )
          ) {
            alert(`The player name "${name}" is already taken!`);
            return;
          }
        }

        const newPlayers = currentNames.map((name) => ({
          id: Math.random().toString(36).substr(2, 9),
          name,
        }));

        const newGroup: Group = {
          id:
            gameState.groups.length > 0
              ? Math.max(...gameState.groups.map((g) => g.id)) + 1
              : 1,
          name: trimmedGroup,
          playerIds: newPlayers.map((p) => p.id),
          score: 0,
        };

        setGameState((prev) => ({
          ...prev,
          players: [...prev.players, ...newPlayers],
          groups: [...prev.groups, newGroup],
        }));

        setNewGroupName("");
        setNewPlayerNames({ 0: "", 1: "", 2: "", 3: "", 4: "" });
      }
    } else {
      const p1 = newPlayerNames[0]?.trim();
      if (p1) {
        // Validation
        const p1Exists = gameState.players.some(
          (p) => p.name.toLowerCase() === p1.toLowerCase(),
        );

        if (p1Exists) {
          alert(`The name "${p1}" is already taken!`);
          return;
        }

        const p1Id = Math.random().toString(36).substr(2, 9);
        const newPlayers = [{ id: p1Id, name: p1 }];

        const newGroup: Group = {
          id:
            gameState.groups.length > 0
              ? Math.max(...gameState.groups.map((g) => g.id)) + 1
              : 1,
          name: p1,
          playerIds: [p1Id],
          score: 0,
        };

        setGameState((prev) => ({
          ...prev,
          players: [...prev.players, ...newPlayers],
          groups: [...prev.groups, newGroup],
        }));

        setNewPlayerNames((prev) => ({ ...prev, 0: "" }));
      }
    }
    inputRef.current?.focus();
  };

  const removeGroup = (groupId: number) => {
    const groupToRemove = gameState.groups.find((g) => g.id === groupId);
    if (!groupToRemove) return;

    setGameState((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== groupId),
      players: prev.players.filter(
        (p) => !groupToRemove.playerIds.includes(p.id),
      ),
    }));
  };

  const editGroup = (groupId: number) => {
    const groupToEdit = gameState.groups.find((g) => g.id === groupId);
    if (!groupToEdit) return;

    if (groupToEdit.playerIds.length === 1) {
      setGameMode("SOLO");
      setNewPlayerNames({
        0:
          gameState.players.find((p) => p.id === groupToEdit.playerIds[0])
            ?.name || "",
      });
    } else {
      setGameMode("TEAM");
      setTeamSize(groupToEdit.playerIds.length);
      setNewGroupName(groupToEdit.name);
      const names: Record<number, string> = {};
      groupToEdit.playerIds.forEach((pid, i) => {
        names[i] = gameState.players.find((p) => p.id === pid)?.name || "";
      });
      setNewPlayerNames(names);
    }

    removeGroup(groupId);
  };

  const startGame = async () => {
    if (gameState.groups.length < 2) return;

    // Reset imposter status on all players
    const allPlayers = [...gameState.players].map((p) => ({
      ...p,
      isImposter: false,
    }));

    // Pick random unique players as imposters
    const imposterIndices: number[] = [];
    const numToPick = Math.min(gameState.numImposters, allPlayers.length - 1);

    const availableIndices = allPlayers.map((_, i) => i);
    // Shuffle available indices
    availableIndices.sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.max(1, numToPick); i++) {
      imposterIndices.push(availableIndices[i]);
    }

    imposterIndices.forEach((idx) => {
      allPlayers[idx].isImposter = true;
    });

    // Shuffle players for the reveal phase
    const shuffledPlayers = allPlayers.sort(() => Math.random() - 0.5);

    // Pick random category and word
    const categoryNames =
      selectedCategories.length > 0
        ? selectedCategories
        : Object.keys(CATEGORIES);

    let assignedCategory =
      categoryNames[Math.floor(Math.random() * categoryNames.length)];

    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: [assignedCategory] }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `AI Generation failed (${response.status}). Keep in mind this game requires a running backend.`,
        );
      }

      const data = await response.json();
      const generatedWord = data.word || "";
      const imposterHint1 = data.imposterHint || "";
      const imposterHint2 = data.imposterHint2 || "";

      if (!generatedWord) {
        throw new Error("AI returned no word.");
      }

      setGameState((prev) => ({
        ...prev,
        players: shuffledPlayers,
        secretWord: generatedWord,
        category: assignedCategory,
        phase: "REVEAL",
        currentRevealIndex: 0,
        imposterHintWord: imposterHint1,
        imposterHintWord2: imposterHint2,
        playerVotes: {},
        currentVotingPlayerIndex: 0,
        discussionStarterId:
          shuffledPlayers[Math.floor(Math.random() * shuffledPlayers.length)]
            .id,
      }));
    } catch (err: any) {
      console.error("AI word generation failed:", err);
      setAiStatus("ERROR");
      setAiError(
        err.message ||
          "AI word generation failed. Please check your API key and connection.",
      );
      setIsGenerating(false);
      return;
    }

    setIsGenerating(false);
  };

  const nextReveal = () => {
    if (gameState.currentRevealIndex < gameState.players.length - 1) {
      setGameState((prev) => ({
        ...prev,
        currentRevealIndex: prev.currentRevealIndex + 1,
        isWordVisible: false,
      }));
    } else {
      setGameState((prev) => ({ ...prev, phase: "CLUES" }));
    }
  };

  const resetGame = async () => {
    // Clear UI immediately
    setGlobalLeaderboard([]);

    try {
      await fetch("/api/reset-leaderboard", { method: "POST" });
      await fetchGlobalLeaderboard();
    } catch (err) {
      console.error("Failed to reset leaderboard:", err);
    }

    setGameState({
      players: [],
      groups: [],
      secretWord: "",
      category: "",
      phase: "LOBBY",
      currentRevealIndex: 0,
      isWordVisible: false,
      playerVotes: {},
      currentVotingPlayerIndex: 0,
      discussionStarterId: null,
      imposterHintWord: null,
    });
  };

  const playAgain = () => {
    fetchGlobalLeaderboard();
    setGameState((prev) => ({
      ...prev,
      phase: "LOBBY",
      secretWord: "",
      category: "",
      currentRevealIndex: 0,
      isWordVisible: false,
      playerVotes: {},
      currentVotingPlayerIndex: 0,
      discussionStarterId: null,
      imposterHintWord: null,
    }));
  };

  // --- Remote Play Effects ---

  useEffect(() => {
    let interval: any;
    if (remoteRoom?.code) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/rooms/${remoteRoom.code}?name=${remotePlayerName}`,
          );
          if (res.status === 401) {
            setRemoteRoom(null);
            setGameState((prev) => ({ ...prev, phase: "LOBBY" }));
            setKickedMessage(
              "You have been removed from the room by the host.",
            );
            // auto-clear message after 5 seconds
            setTimeout(() => setKickedMessage(null), 5000);
            return;
          }

          if (res.ok) {
            const data = await res.json();
            setRemoteRoom(data);

            const isPresent = data.players.some(
              (p: any) => p.name === remotePlayerName,
            );

            // If I'm not in the player list and I'm not the host who chose not to join,
            // or if I was simply kicked.
            if (!isPresent && !isRemoteHost && gameState.phase !== "LOBBY") {
              setRemoteRoom(null);
              setGameState((prev) => ({ ...prev, phase: "LOBBY" }));
              setKickedMessage("You have been removed from the room.");
              setTimeout(() => setKickedMessage(null), 5000);
              return;
            }

            // Sync GameState with Room State
            const mappedPlayers = data.players.map((p: any) => ({
              id: p.name,
              name: p.name,
              isImposter: p.role === "imposter",
              team_name: p.team_name,
              is_host: p.is_host,
            }));

            const remoteVotes: Record<string, string[]> = {};
            data.players.forEach((p: any) => {
              if (p.vote) {
                remoteVotes[p.name] = p.vote.includes(",")
                  ? p.vote.split(",")
                  : [p.vote];
              }
            });

            const serverPhase =
              data.state === "lobby"
                ? "REMOTE_LOBBY"
                : (data.state.toUpperCase() as GamePhase);

            setGameState((prev) => ({
              ...prev,
              phase:
                prev.phase === "LEADERBOARD" && serverPhase === "REMOTE_LOBBY"
                  ? "LEADERBOARD"
                  : serverPhase,
              players: mappedPlayers,
              playerVotes: remoteVotes,
              numImposters: data.settings?.numImposters || prev.numImposters,
              secretWord: data.game_data?.word || "",
              category: data.game_data?.type || "",
              imposterHintWord: data.game_data?.imposterHint || "",
              imposterHintWord2: data.game_data?.imposterHint2 || "",
              discussionStarterId:
                data.settings?.discussionStarter ||
                mappedPlayers[0]?.id ||
                null,
            }));
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [remoteRoom?.code, remotePlayerName]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (remoteRoom?.code && remotePlayerName) {
        // Send a beacon to the leave endpoint for immediate cleanup
        const url = `/api/rooms/${remoteRoom.code}/leave`;
        const data = JSON.stringify({ name: remotePlayerName });
        const blob = new Blob([data], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [remoteRoom?.code, remotePlayerName]);

  const createRemoteRoom = async () => {
    setIsJoining(true);
    const hostName = remotePlayerName || "Host";
    setRemotePlayerName(hostName);
    try {
      const res = await fetch("/api/rooms/create", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setRemoteRoom({ code: data.code, players: [], state: "lobby" });
        setIsRemoteHost(true);
        setIsHostJoined(true);

        await fetch("/api/rooms/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: data.code,
            name: hostName,
            isHost: true,
          }),
        });

        setGameState((prev) => ({ ...prev, phase: "REMOTE_LOBBY" }));
      }
    } catch (err) {
      alert("Failed to create room");
    } finally {
      setIsJoining(false);
    }
  };

  const joinRemoteRoom = async () => {
    if (!remoteJoinCode || !remotePlayerName) return;
    setIsJoining(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: remoteJoinCode.toUpperCase(),
          name: remotePlayerName,
          isHost: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRemoteRoom({
          code: remoteJoinCode.toUpperCase(),
          players: [],
          state: "lobby",
        });
        setIsRemoteHost(false);
        setGameState((prev) => ({ ...prev, phase: "REMOTE_LOBBY" }));
      } else {
        alert(data.error || "Failed to join room");
      }
    } catch (err) {
      alert("Room not found");
    } finally {
      setIsJoining(false);
    }
  };

  const leaveRemoteRoom = async () => {
    if (!remoteRoom?.code || !remotePlayerName) {
      setRemoteRoom(null);
      setGameState((prev) => ({ ...prev, phase: "LOBBY" }));
      return;
    }

    try {
      await fetch(`/api/rooms/${remoteRoom.code}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: remotePlayerName }),
      });
    } catch (err) {
      console.error("Failed to leave room explicitly:", err);
    }

    setRemoteRoom(null);
    setGameState((prev) => ({ ...prev, phase: "LOBBY" }));
    setLocalRemoteVotes([]);
  };

  const startRemoteGame = async () => {
    if (!remoteRoom?.code) return;
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/rooms/${remoteRoom.code}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: selectedCategories,
          numImposters: gameState.numImposters,
        }),
      });
      if (res.ok) {
        // State will sync via polling or we can force it
        const statusRes = await fetch(`/api/rooms/${remoteRoom.code}`);
        const data = await statusRes.json();
        setRemoteRoom(data);
      }
    } catch (err) {
      alert("Failed to start game");
    } finally {
      setIsGenerating(false);
    }
  };

  const updateRemoteState = async (newState: string) => {
    if (!remoteRoom?.code || !isRemoteHost) return;
    if (newState === "voting" || newState === "lobby") setLocalRemoteVotes([]);
    await fetch(`/api/rooms/${remoteRoom.code}/update-state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: newState }),
    });
  };

  const submitRemoteVote = async (names: string[]) => {
    if (!remoteRoom?.code) return;
    const voteStr = names.join(",");
    await fetch(`/api/rooms/${remoteRoom.code}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: remotePlayerName, vote: voteStr }),
    });
  };

  const joinRemoteTeam = async (team: string) => {
    if (!remoteRoom?.code) return;
    const trimmedName = remotePlayerName.trim();

    // Check if player is already in room in the server's view
    const isPlayerInRoom = remoteRoom.players.some(
      (p: any) => p.name === trimmedName,
    );
    if (!isPlayerInRoom) {
      await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: remoteRoom.code,
          name: trimmedName,
          isHost: isRemoteHost,
        }),
      });
      if (isRemoteHost) setIsHostJoined(true);
    }

    await fetch(`/api/rooms/${remoteRoom.code}/join-team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmedName, team }),
    });

    // Force immediate sync
    const res = await fetch(
      `/api/rooms/${remoteRoom.code}?name=${encodeURIComponent(trimmedName)}`,
    );
    if (res.ok) {
      const data = await res.json();
      setRemoteRoom(data);
    }
  };

  const handleRemoteReveal = async () => {
    if (!remoteRoom?.code || !isRemoteHost) return;

    // Calculate points exactly like revealResult does
    const imposterPlayers = remoteRoom.players.filter(
      (p: any) => p.role === "imposter",
    );
    const imposterIds = imposterPlayers.map((p: any) => p.name);
    const nonImposterVoters = remoteRoom.players.filter(
      (p: any) => p.role !== "imposter",
    );

    const scoresToSubmit: Record<
      string,
      { score: number; members: string[]; type: string }
    > = {};

    nonImposterVoters.forEach((voter: any) => {
      const votes = voter.vote
        ? voter.vote.includes(",")
          ? voter.vote.split(",")
          : [voter.vote]
        : [];

      // Points for Hunters
      const correctCount = votes.filter((v: string) =>
        imposterIds.includes(v),
      ).length;

      if (correctCount > 0) {
        const rawKey = voter.team_name || voter.name;
        const key = rawKey.trim().toUpperCase();
        const type = voter.team_name ? "team" : "solo";
        if (!scoresToSubmit[key])
          scoresToSubmit[key] = { score: 0, members: [], type };
        scoresToSubmit[key].score += correctCount;
        if (!scoresToSubmit[key].members.includes(voter.name)) {
          scoresToSubmit[key].members.push(voter.name);
        }
      }

      // Points for Imposters
      imposterPlayers.forEach((imp: any) => {
        if (!votes.includes(imp.name)) {
          const rawKey = imp.team_name || imp.name;
          const key = rawKey.trim().toUpperCase();
          const type = imp.team_name ? "team" : "solo";
          if (!scoresToSubmit[key])
            scoresToSubmit[key] = { score: 0, members: [], type };
          scoresToSubmit[key].score += 1;
          if (!scoresToSubmit[key].members.includes(imp.name)) {
            scoresToSubmit[key].members.push(imp.name);
          }
        }
      });
    });

    const batch = Object.entries(scoresToSubmit).map(([name, data]) => ({
      name,
      score: data.score,
      members: data.members,
      type: data.type,
    }));

    console.log("Total impurities identified:", imposterIds);
    console.log("Calculated score batch:", batch);

    if (batch.length > 0) {
      try {
        console.log("Submitting remote scores to leaderboard...");
        const res = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(batch),
        });
        if (res.ok) {
          console.log("Scores successfully recorded.");
        }
        setTimeout(fetchGlobalLeaderboard, 500);
      } catch (err) {
        console.error("Failed to submit remote scores:", err);
      }
    } else {
      console.warn("No points were gained this round. Nothing to submit.");
    }

    await updateRemoteState("result");
  };

  const kickPlayer = async (name: string) => {
    if (!remoteRoom?.code || !isRemoteHost) return;
    try {
      await fetch(`/api/rooms/${remoteRoom.code}/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    } catch (err) {
      console.error("Failed to kick player:", err);
    }
  };

  const updateRoomSettings = async (settings: any) => {
    if (!remoteRoom?.code || !isRemoteHost) return;
    try {
      await fetch(`/api/rooms/${remoteRoom.code}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
    } catch (err) {
      console.error("Failed to update settings:", err);
    }
  };

  const toggleHostParticipation = async () => {
    if (!remoteRoom?.code || !isRemoteHost) return;

    if (isHostJoined) {
      // Leave
      try {
        await fetch(`/api/rooms/${remoteRoom.code}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: remotePlayerName }),
        });
        setIsHostJoined(false);
      } catch (err) {
        console.error("Failed to leave participation:", err);
      }
    } else {
      // Join
      try {
        const res = await fetch("/api/rooms/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: remoteRoom.code,
            name: remotePlayerName,
            isHost: true,
          }),
        });
        if (res.ok) setIsHostJoined(true);
        else alert("Failed to join as player");
      } catch (err) {
        console.error("Failed to join participation:", err);
      }
    }
  };

  const updateRemoteName = async (newName: string) => {
    if (!remoteRoom?.code || !newName) return;
    try {
      const res = await fetch(`/api/rooms/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: remoteRoom.code,
          name: newName,
          isHost: isRemoteHost,
          oldName: remotePlayerName,
        }),
      });

      if (res.ok) {
        setRemotePlayerName(newName);
        localStorage.setItem("remotePlayerName", newName);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update name");
      }
    } catch (err) {
      console.error("Failed to update name:", err);
      alert("Connection error. Could not update name.");
    }
  };

  const resetSystem = async () => {
    if (
      !window.confirm(
        "Are you sure you want to reset everything? All scores and players will be cleared.",
      )
    )
      return;

    try {
      await fetch("/api/reset-leaderboard", { method: "POST" });
      setGameState({
        players: [],
        groups: [],
        secretWord: "",
        category: "",
        phase: "LOBBY",
        currentRevealIndex: 0,
        isWordVisible: false,
        playerVotes: {},
        currentVotingPlayerIndex: 0,
        numImposters: 2,
        discussionStarterId: null,
        imposterHintWord: null,
        imposterHintWord2: null,
      });
      fetchGlobalLeaderboard();
      alert("System Reset Complete!");
    } catch (err) {
      console.error("Reset failed:", err);
    }
  };

  const renderLeaderboard = () => {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-12 min-h-screen">
        <div className="text-center space-y-6">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-block px-5 py-1.5 bg-amber-500 text-white rounded-full text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] shadow-[4px_4px_0_#92400e]"
          >
            Hall of Fame
          </motion.div>
          <motion.h1
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-6xl sm:text-8xl lg:text-9xl font-black italic tracking-tighter uppercase leading-[0.8] text-zinc-900"
          >
            All-Time <br />
            <span className="text-amber-500">Legends</span>
          </motion.h1>
        </div>

        <div className="bg-white rounded-[3rem] sm:rounded-[4rem] p-8 sm:p-12 shadow-[20px_20px_0_#18181b] border-8 border-zinc-900 space-y-8 relative">
          <button
            onClick={() =>
              setGameState((prev) => ({
                ...prev,
                phase: remoteRoom ? "REMOTE_LOBBY" : "LOBBY",
              }))
            }
            className="absolute -top-6 -left-0 xs:-left-6 w-14 h-14 bg-zinc-900 text-white rounded-2xl flex items-center justify-center hover:bg-emerald-500 transition-all shadow-[4px_4px_0_#000] hover:scale-110 active:scale-95 z-10"
          >
            <RotateCcw size={24} />
          </button>

          <div className="flex justify-center gap-4 mb-4">
            <button
              onClick={() => setRankType("team")}
              className={`px-6 py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
                rankType === "team"
                  ? "bg-zinc-900 text-white shadow-[4px_4px_0_#10b981]"
                  : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
              }`}
            >
              Elite Teams
            </button>
            <button
              onClick={() => setRankType("solo")}
              className={`px-6 py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
                rankType === "solo"
                  ? "bg-zinc-900 text-white shadow-[4px_4px_0_#10b981]"
                  : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
              }`}
            >
              Solo Legends
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 overflow-y-auto max-h-[60vh] pr-4 custom-scrollbar lg:max-h-[70vh]">
            {globalLeaderboard.length > 0 ? (
              globalLeaderboard.map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-6 bg-zinc-50 rounded-[2rem] border-4 border-zinc-100 group hover:border-zinc-900 transition-all hover:translate-x-2"
                >
                  <div className="flex items-center gap-6">
                    <div
                      className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-black text-xl sm:text-2xl border-4 ${
                        i === 0
                          ? "bg-amber-100 border-amber-500 text-amber-600"
                          : i === 1
                            ? "bg-zinc-200 border-zinc-400 text-zinc-500"
                            : i === 2
                              ? "bg-orange-100 border-orange-400 text-orange-600"
                              : "bg-white border-zinc-200 text-zinc-400"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xl sm:text-3xl font-black text-zinc-900 uppercase tracking-tighter italic truncate max-w-[120px] xs:max-w-[200px] sm:max-w-md">
                        {entry.name}
                      </span>
                      {entry.members &&
                        entry.members.length > 0 &&
                        entry.type === "team" && (
                          <span className="text-[10px] sm:text-xs font-black text-emerald-500 uppercase tracking-widest italic opacity-60">
                            {entry.members.join(" • ")}
                          </span>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl sm:text-4xl font-black text-emerald-500">
                      {entry.score}
                    </span>
                    <span className="text-[10px] sm:text-xs font-black text-zinc-400 uppercase tracking-widest mt-2 sm:mt-4">
                      pts
                    </span>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-20 space-y-4">
                <Trophy
                  size={80}
                  className="mx-auto text-zinc-100"
                  strokeWidth={1}
                />
                <p className="text-zinc-400 font-bold italic text-lg uppercase tracking-widest">
                  No legends yet.
                </p>
                <p className="text-zinc-300 font-black text-xs uppercase tracking-[0.2em]">
                  Start a game to take your place in history!
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col xs:flex-row gap-4 pt-8">
            <button
              onClick={fetchGlobalLeaderboard}
              className="flex-1 py-5 bg-zinc-900 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center justify-center gap-3 shadow-[0_6px_0_#000] active:shadow-none active:translate-y-1"
            >
              <RefreshCw size={24} /> Refresh Rankings
            </button>
            <button
              onClick={resetSystem}
              className="px-8 py-5 bg-red-50 text-red-500 rounded-[2rem] font-black uppercase tracking-widest border-4 border-red-100 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-3 active:translate-y-1"
            >
              <Trash2 size={24} /> Reset System
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderRemoteLobby = () => {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 lg:space-y-8 min-h-screen">
        <div className="text-center space-y-4 relative">
          <div className="absolute -top-1 -right-1 lg:-top-2 lg:-right-2">
            <button
              onClick={() =>
                setGameState((prev) => ({ ...prev, phase: "LEADERBOARD" }))
              }
              title="View Global Leaderboard"
              className="p-1.5 lg:p-2 text-amber-500 hover:text-amber-600 transition-all hover:scale-110 active:scale-95 flex flex-col items-center"
            >
              <Trophy size={24} className="lg:w-8 lg:h-8" fill="currentColor" />
              <span className="text-[6px] lg:text-[8px] font-black uppercase mt-0.5 lg:mt-1">
                Board
              </span>
            </button>
          </div>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-block px-4 py-1 lg:px-5 lg:py-1.5 bg-emerald-500 text-white rounded-full text-[10px] lg:text-xs font-black uppercase tracking-[0.2em]"
          >
            Lobby Code:{" "}
            <span className="text-lg lg:text-xl ml-2">{remoteRoom?.code}</span>
          </motion.div>
          <h2 className="text-3xl lg:text-5xl font-black text-zinc-900 uppercase italic leading-tight">
            Waiting for <br />
            <span className="text-emerald-500">Barkada</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            {/* Identity Section */}
            <div className="bg-white rounded-2xl lg:rounded-[2rem] p-5 lg:p-6 shadow-[6px_6px_0_#18181b] lg:shadow-[10px_10px_0_#18181b] border-2 lg:border-4 border-zinc-900 space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block px-2">
                Your Identity
              </label>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <input
                  type="text"
                  value={remotePlayerName}
                  onChange={(e) => setRemotePlayerName(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl bg-zinc-50 border-2 border-zinc-100 font-black text-zinc-900 uppercase text-sm lg:text-base"
                  placeholder="Your Name"
                />
                <button
                  onClick={() => updateRemoteName(remotePlayerName)}
                  className="px-6 py-3 bg-zinc-900 text-white rounded-xl font-black uppercase text-xs sm:w-auto"
                >
                  Update
                </button>
              </div>
              {isRemoteHost && (
                <button
                  onClick={toggleHostParticipation}
                  className={`w-full py-3 rounded-xl font-black uppercase text-xs transition-all border-2 ${isHostJoined ? "bg-red-50 border-red-200 text-red-500" : "bg-emerald-50 border-emerald-200 text-emerald-600"}`}
                >
                  {isHostJoined ? "Leave Participation" : "Join Participation"}
                </button>
              )}
            </div>

            {/* Host Settings */}
            {isRemoteHost && (
              <div className="bg-white rounded-2xl lg:rounded-[2rem] p-6 lg:p-8 shadow-[8px_8px_0_#18181b] lg:shadow-[15px_15px_0_#18181b] border-4 lg:border-8 border-zinc-900 space-y-6">
                <h3 className="text-lg lg:text-xl font-black uppercase tracking-tighter italic border-b-4 border-zinc-900 pb-2">
                  Host Panel
                </h3>
                <div className="space-y-3">
                  <span className="font-black uppercase tracking-widest text-zinc-400 text-[10px] block">
                    Imposter Count
                  </span>
                  <div className="flex flex-wrap gap-2 lg:gap-3">
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        onClick={() =>
                          updateRoomSettings({
                            ...remoteRoom?.settings,
                            numImposters: num,
                          })
                        }
                        className={`w-10 h-10 lg:w-12 lg:h-12 rounded-lg lg:rounded-xl font-black transition-all border-2 lg:border-4 flex items-center justify-center text-xs lg:text-base ${
                          gameState.numImposters === num
                            ? "bg-zinc-900 border-zinc-900 text-white"
                            : "bg-zinc-50 border-zinc-100 text-zinc-400"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="font-black uppercase tracking-widest text-zinc-400 text-[10px] block">
                    Topics
                  </span>
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:flex sm:flex-wrap gap-2">
                    {Object.keys(CATEGORIES).map((cat) => {
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => {
                            const newSelection = isSelected
                              ? selectedCategories.filter((c) => c !== cat)
                              : [...selectedCategories, cat];
                            setSelectedCategories(newSelection);
                          }}
                          className={`px-3 py-2 lg:py-1.5 rounded-lg border-2 transition-all font-black text-[9px] lg:text-[10px] uppercase truncate ${isSelected ? "bg-emerald-500 border-emerald-600 text-white" : "bg-zinc-50 border-zinc-100 text-zinc-400"}`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <span className="font-black uppercase tracking-widest text-zinc-400 text-[10px] block">
                    Manage Teams
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="Add Team Name"
                      className="flex-1 px-4 py-3 rounded-xl bg-zinc-50 border-2 border-zinc-100 font-black text-[11px] uppercase focus:border-emerald-500 outline-none transition-all"
                    />
                    <button
                      onClick={() => {
                        if (!newTeamName.trim()) return;
                        const teams =
                          remoteRoom?.settings?.availableTeams || [];
                        if (teams.includes(newTeamName.trim())) return;
                        updateRoomSettings({
                          ...remoteRoom?.settings,
                          availableTeams: [...teams, newTeamName.trim()],
                        });
                        setNewTeamName("");
                      }}
                      className="px-4 py-3 bg-zinc-900 text-white rounded-xl font-black uppercase text-[11px]"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content (Players & Action) */}
            <div className="bg-white rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-8 shadow-[10px_10px_0_#18181b] lg:shadow-[20px_20px_0_#18181b] border-4 lg:border-8 border-zinc-900 space-y-6 lg:space-y-8">
              {(remoteRoom?.settings?.availableTeams || []).length > 0 && (
                <div className="space-y-4 pb-4 border-b-4 border-zinc-50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block px-2 text-center italic">
                    Select Your Team
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {remoteRoom.settings.availableTeams.map((team: string) => {
                      const isMyTeam =
                        remoteRoom.players.find(
                          (p: any) => p.name === remotePlayerName,
                        )?.team_name === team;
                      return (
                        <button
                          key={team}
                          onClick={() => joinRemoteTeam(team)}
                          className={`p-4 rounded-2xl border-4 font-black uppercase text-xs transition-all ${
                            isMyTeam
                              ? "bg-emerald-500 border-emerald-500 text-white shadow-lg transform scale-[1.02]"
                              : "bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-zinc-300"
                          }`}
                        >
                          {team}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => joinRemoteTeam("")}
                      className={`p-4 rounded-2xl border-4 font-black uppercase text-xs transition-all ${
                        !remoteRoom.players.find(
                          (p: any) => p.name === remotePlayerName,
                        )?.team_name
                          ? "bg-zinc-900 border-zinc-900 text-white shadow-lg"
                          : "bg-zinc-50 border-zinc-100 text-zinc-300 hover:border-zinc-300"
                      }`}
                    >
                      No Team
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block px-2 italic">
                  Players Inside ({remoteRoom?.players?.length || 0})
                </span>
                <div className="grid grid-cols-1 gap-4">
                  {remoteRoom?.players?.map((p: any, i: number) => (
                    <motion.div
                      key={i}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border-4 border-zinc-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black border-2 border-zinc-100">
                          {i + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-black text-zinc-900 uppercase">
                            {p.name}
                          </span>
                          {p.team_name && (
                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest italic group-hover:underline">
                              Team: {p.team_name}
                            </span>
                          )}
                        </div>
                        {p.is_host === 1 && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-lg text-[10px] font-black uppercase">
                            Host
                          </span>
                        )}
                      </div>
                      {isRemoteHost && p.name !== remotePlayerName && (
                        <button
                          onClick={() => kickPlayer(p.name)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>

              {isRemoteHost ? (
                <button
                  onClick={startRemoteGame}
                  disabled={
                    !remoteRoom?.players ||
                    remoteRoom.players.length < 3 ||
                    remoteRoom.players.length <=
                      (remoteRoom.settings?.numImposters || 1) ||
                    isGenerating ||
                    selectedCategories.length === 0
                  }
                  className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_6px_0_#064e3b] active:shadow-none active:translate-y-1 transition-all disabled:opacity-30 flex items-center justify-center gap-3"
                >
                  {isGenerating ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <Play size={24} fill="currentColor" />
                  )}
                  {remoteRoom?.players?.length < 3
                    ? "Need 3+ Players"
                    : (remoteRoom.settings?.numImposters || 1) >=
                        (remoteRoom?.players?.length || 0)
                      ? "Too Many Imposters"
                      : selectedCategories.length === 0
                        ? "Select Category"
                        : "Start Game"}
                </button>
              ) : (
                <div className="text-center p-6 bg-zinc-100 rounded-2xl border-4 border-dashed border-zinc-200">
                  <p className="text-zinc-500 font-black uppercase tracking-widest text-sm animate-pulse">
                    Host will start the game soon...
                  </p>
                </div>
              )}

              <button
                onClick={leaveRemoteRoom}
                className="w-full py-4 bg-zinc-100 text-zinc-400 rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-[0_4px_0_#d4d4d8] active:shadow-none active:translate-y-1"
              >
                Leave Lobby
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] lg:rounded-[3rem] p-6 lg:p-8 shadow-[10px_10px_0_#18181b] lg:shadow-[20px_20px_0_#18181b] border-4 lg:border-8 border-zinc-900 space-y-6">
            <div className="flex items-center justify-between border-b-4 border-zinc-50 pb-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setRankType("team")}
                  className={`text-[10px] font-black uppercase tracking-widest transition-all ${
                    rankType === "team"
                      ? "text-zinc-900 border-b-2 border-zinc-900"
                      : "text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  Elite Teams
                </button>
                <button
                  onClick={() => setRankType("solo")}
                  className={`text-[10px] font-black uppercase tracking-widest transition-all ${
                    rankType === "solo"
                      ? "text-zinc-900 border-b-2 border-zinc-900"
                      : "text-zinc-400 hover:text-zinc-600"
                  }`}
                >
                  Solo Legends
                </button>
                <button
                  onClick={fetchGlobalLeaderboard}
                  className="p-1 hover:bg-zinc-100 rounded-lg transition-colors text-zinc-400 hover:text-emerald-500"
                  title="Refresh Rankings"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
              <Trophy
                size={20}
                className="lg:w-6 lg:h-6 text-amber-500"
                fill="currentColor"
              />
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {globalLeaderboard.length > 0 ? (
                globalLeaderboard.slice(0, 10).map((entry, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-between items-center p-4 bg-zinc-50 rounded-2xl border-2 border-zinc-100"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black border-2 ${
                          i === 0
                            ? "bg-amber-100 border-amber-300 text-amber-600"
                            : i === 1
                              ? "bg-zinc-100 border-zinc-200 text-zinc-400"
                              : i === 2
                                ? "bg-orange-50 border-orange-200 text-orange-600"
                                : "bg-white border-zinc-100 text-zinc-300"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-zinc-900 uppercase italic truncate max-w-[150px]">
                          {entry.name}
                        </span>
                        {entry.members &&
                          entry.members.length > 0 &&
                          entry.type === "team" && (
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight truncate max-w-[150px]">
                              {entry.members.join(", ")}
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-black text-emerald-500">
                        {entry.score}
                      </span>
                      <span className="text-[8px] font-black text-zinc-300 uppercase mt-1">
                        pts
                      </span>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-12">
                  <p className="text-zinc-300 font-bold uppercase tracking-widest italic animate-pulse">
                    Board is empty
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() =>
                setGameState((prev) => ({ ...prev, phase: "LEADERBOARD" }))
              }
              className="w-full py-4 bg-amber-50 text-amber-600 rounded-2xl font-black uppercase tracking-widest hover:bg-amber-100 transition-all border-2 lg:border-4 border-amber-100 shadow-[0_4px_0_#fef3c7] active:shadow-none active:translate-y-1 text-xs lg:text-sm"
            >
              Full Rankings
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderRemoteJoin = () => {
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-6 lg:space-y-8 min-h-screen flex flex-col justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-4xl lg:text-6xl font-black text-zinc-900 uppercase italic leading-none">
            Join <br />
            <span className="text-emerald-500">Room</span>
          </h2>
          <p className="text-zinc-500 font-bold text-sm lg:text-base">
            Enter the 5-digit code shown on the host's screen.
          </p>
        </div>

        <div className="bg-white rounded-2xl lg:rounded-[3rem] p-6 lg:p-8 shadow-[10px_10px_0_#18181b] lg:shadow-[20px_20px_0_#18181b] border-4 lg:border-8 border-zinc-900 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                Room Code
              </label>
              <input
                type="text"
                value={remoteJoinCode}
                onChange={(e) =>
                  setRemoteJoinCode(e.target.value.toUpperCase())
                }
                placeholder="ABCDE"
                maxLength={5}
                className="w-full px-5 py-4 rounded-xl lg:rounded-2xl bg-zinc-50 border-2 lg:border-4 border-zinc-100 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-black text-2xl lg:text-3xl text-center tracking-[0.2em] text-zinc-900"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                Your Name
              </label>
              <input
                type="text"
                value={remotePlayerName}
                onChange={(e) => setRemotePlayerName(e.target.value)}
                placeholder="E.g. Pinoy Hunter"
                className="w-full px-5 py-3 lg:py-4 rounded-xl lg:rounded-2xl bg-zinc-50 border-2 lg:border-4 border-zinc-100 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-black text-zinc-900 text-sm lg:text-base"
              />
            </div>
          </div>

          <button
            onClick={joinRemoteRoom}
            disabled={!remoteJoinCode || !remotePlayerName || isJoining}
            className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_6px_0_#064e3b] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-3"
          >
            {isJoining ? (
              <RefreshCw className="animate-spin" />
            ) : (
              <ChevronRight size={24} />
            )}
            Join Party
          </button>

          <button
            onClick={() =>
              setGameState((prev) => ({ ...prev, phase: "LOBBY" }))
            }
            className="w-full py-4 bg-zinc-100 text-zinc-400 rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-[0_4px_0_#d4d4d8] active:shadow-none active:translate-y-1"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  };

  const renderLobby = () => (
    <div className="max-w-2xl mx-auto px-4 py-4 sm:py-8 lg:py-12 space-y-8 sm:space-y-12">
      <div className="text-center space-y-6 sm:space-y-8 relative">
        <motion.div
          initial={{ rotate: -5, scale: 0.9 }}
          animate={{ rotate: 0, scale: 1 }}
          className="inline-block px-5 py-1.5 bg-emerald-500 text-white rounded-full text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] mb-2 shadow-[4px_4px_0_#064e3b] sm:shadow-[6px_6px_0_#064e3b]"
        >
          Party Game
        </motion.div>
        <h1 className="text-4xl xs:text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter text-zinc-900 uppercase italic leading-[0.85] sm:leading-[0.8]">
          Developers <br />
          <span className="text-emerald-500">Imposter Game</span>
        </h1>
        <p className="text-zinc-500 font-bold text-xs sm:text-sm md:text-base max-w-sm mx-auto">
          A high-stakes game of deception, social engineering, and group
          dynamics.
        </p>

        <div className="absolute -top-2 -right-2 flex gap-1">
          <button
            onClick={() =>
              setGameState((prev) => ({ ...prev, phase: "LEADERBOARD" }))
            }
            title="View Hall of Fame"
            className="p-2 text-amber-500 hover:text-amber-600 transition-all hover:scale-110 active:scale-95"
          >
            <Trophy size={28} fill="currentColor" />
          </button>
          <button
            onClick={resetGame}
            title="Reset All Data"
            className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
          >
            <RefreshCw size={20} />
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            <HelpCircle size={24} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 shadow-[10px_10px_0_#18181b] sm:shadow-[20px_20px_0_#18181b] border-4 border-zinc-900 space-y-8">
        <div className="flex bg-zinc-100 p-1 rounded-2xl mb-6 border-4 border-zinc-100 overflow-hidden">
          <button
            onClick={() => setGameMode("TEAM")}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${gameMode === "TEAM" ? "bg-white text-zinc-900 shadow-sm border-2 border-zinc-200" : "text-zinc-400 hover:text-zinc-600 border-2 border-transparent"}`}
          >
            Team Mode
          </button>
          <button
            onClick={() => setGameMode("SOLO")}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${gameMode === "SOLO" ? "bg-white text-zinc-900 shadow-sm border-2 border-zinc-200" : "text-zinc-400 hover:text-zinc-600 border-2 border-transparent"}`}
          >
            Solo Mode
          </button>
          <button
            onClick={() => setGameMode("REMOTE")}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${gameMode === "REMOTE" ? "bg-white text-zinc-900 shadow-sm border-2 border-zinc-200" : "text-zinc-400 hover:text-zinc-600 border-2 border-transparent"}`}
          >
            Remote Mode
          </button>
        </div>

        <AnimatePresence mode="wait">
          {gameMode === "REMOTE" ? (
            <motion.div
              key="remote-ui"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                  Remote Player Name
                </label>
                <input
                  type="text"
                  value={remotePlayerName}
                  onChange={(e) => setRemotePlayerName(e.target.value)}
                  placeholder="Enter your name for remote play..."
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 border-2 border-zinc-100 font-black text-zinc-900 uppercase focus:border-emerald-500 focus:outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={createRemoteRoom}
                  disabled={isJoining || !remotePlayerName}
                  className="py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-[0_4px_0_#064e3b] active:shadow-none active:translate-y-1 flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Users size={20} />
                  <span className="text-[10px]">Host Room</span>
                </button>
                <button
                  onClick={() => {
                    if (!remotePlayerName) {
                      alert("Please enter a name first");
                      return;
                    }
                    setGameState((prev) => ({ ...prev, phase: "REMOTE_JOIN" }));
                  }}
                  className="py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-[0_4px_0_#000] active:shadow-none active:translate-y-1 flex flex-col items-center justify-center gap-1"
                >
                  <ChevronRight size={20} />
                  <span className="text-[10px]">Join Code</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.form
              key="local-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={addGroup}
              className="space-y-4"
            >
              <AnimatePresence mode="popLayout">
                {gameMode === "TEAM" ? (
                  <motion.div
                    key="team-form"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                        Team Identity
                      </label>
                      <input
                        ref={inputRef}
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Group Name (e.g. The Legends)"
                        className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border-4 border-zinc-100 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-black text-zinc-900 placeholder:text-zinc-300"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                        Team Size
                      </label>
                      <div className="flex gap-2">
                        {[2, 3, 4, 5].map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setTeamSize(size)}
                            className={`flex-1 py-3 rounded-xl border-2 transition-all font-black ${teamSize === size ? "bg-zinc-900 border-zinc-900 text-white shadow-md scale-105" : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:border-zinc-300"}`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                      {Array.from({ length: teamSize }).map((_, i) => (
                        <div key={i} className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                            Player {i + 1}
                          </label>
                          <input
                            type="text"
                            value={newPlayerNames[i] || ""}
                            onChange={(e) =>
                              setNewPlayerNames((prev) => ({
                                ...prev,
                                [i]: e.target.value,
                              }))
                            }
                            placeholder="Name"
                            className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border-4 border-zinc-100 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-black text-zinc-900 placeholder:text-zinc-300"
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="solo-form"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-2">
                        Player Name
                      </label>
                      <input
                        ref={inputRef}
                        type="text"
                        value={newPlayerNames[0] || ""}
                        onChange={(e) =>
                          setNewPlayerNames((prev) => ({
                            ...prev,
                            0: e.target.value,
                          }))
                        }
                        placeholder="Name"
                        className="w-full px-5 py-4 rounded-2xl bg-zinc-50 border-4 border-zinc-100 focus:border-emerald-500 focus:bg-white focus:outline-none transition-all font-black text-zinc-900 placeholder:text-zinc-300"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={
                  gameMode === "TEAM"
                    ? !newGroupName.trim() ||
                      !Array.from({ length: teamSize }).every((_, i) =>
                        newPlayerNames[i]?.trim(),
                      )
                    : !newPlayerNames[0]?.trim()
                }
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-500 transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-3 shadow-[0_6px_0_#000] active:shadow-none active:translate-y-1"
              >
                <UserPlus size={20} />
                {gameMode === "TEAM" ? "Register Team" : "Register Player"}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="space-y-3 max-h-[40vh] sm:max-h-80 overflow-y-auto pr-2 custom-scrollbar pt-6 border-t-4 border-zinc-50">
          <AnimatePresence mode="popLayout">
            {gameState.groups.map((group) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="p-5 bg-zinc-50 rounded-[1.5rem] border-4 border-zinc-100 space-y-3 relative group hover:border-zinc-900 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-black text-zinc-900 uppercase italic tracking-tight">
                      {group.name}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={() => editGroup(group.id)}
                      className="p-2 text-zinc-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => removeGroup(group.id)}
                      className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  {group.playerIds.map((pid) => (
                    <span
                      key={pid}
                      className="flex-1 px-3 py-2 bg-white rounded-xl text-[10px] font-black text-zinc-500 border-2 border-zinc-100 uppercase tracking-wider text-center"
                    >
                      {gameState.players.find((p) => p.id === pid)?.name}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {gameState.groups.length === 0 && (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto border-4 border-dashed border-zinc-200">
                <Users size={24} className="text-zinc-300" />
              </div>
              <p className="text-zinc-400 font-bold italic text-sm">
                Add at least 2 {gameMode === "TEAM" ? "teams" : "players"} to
                begin the hunt.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-[2rem] p-6 shadow-[8px_8px_0_#18181b] border-4 border-zinc-900 flex justify-between items-center mb-6">
          <span className="font-black uppercase tracking-widest text-zinc-900 text-[10px] md:text-sm">
            Target Imposters
          </span>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                onClick={() =>
                  setGameState((prev) => ({ ...prev, numImposters: num }))
                }
                className={`w-10 h-10 md:w-12 md:h-12 rounded-xl font-black text-lg transition-all border-2 flex items-center justify-center ${gameState.numImposters === num ? "bg-zinc-900 border-zinc-900 text-white shadow-md scale-105" : "bg-zinc-50 border-zinc-200 text-zinc-400 hover:border-zinc-300"}`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 shadow-[8px_8px_0_#18181b] border-4 border-zinc-900 mb-6 space-y-4">
          <span className="font-black uppercase tracking-widest text-zinc-900 text-[10px] md:text-sm block">
            Select Categories
          </span>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.keys(CATEGORIES).map((cat) => {
              const isSelected = selectedCategories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategories((prev) =>
                      isSelected
                        ? prev.filter((c) => c !== cat)
                        : [...prev, cat],
                    );
                  }}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all font-bold text-[10px] md:text-xs uppercase tracking-wider ${isSelected ? "bg-zinc-900 border-zinc-900 text-white shadow-md" : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:border-zinc-300"}`}
                >
                  <div
                    className={`w-4 h-4 rounded-[4px] border-2 flex items-center justify-center transition-all ${isSelected ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-zinc-300"}`}
                  >
                    {isSelected && <Check size={12} strokeWidth={4} />}
                  </div>
                  <span className="truncate">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start Game Validation & Button */}
        <div className="space-y-4">
          <button
            disabled={
              gameState.groups.length < 2 ||
              gameState.players.length <= gameState.numImposters ||
              selectedCategories.length === 0 ||
              isGenerating
            }
            onClick={startGame}
            className="w-full py-4 md:py-6 bg-emerald-500 text-white rounded-[2rem] font-black text-xl md:text-2xl shadow-[0_8px_0_#064e3b] md:shadow-[0_10px_0_#064e3b] active:shadow-none active:translate-y-2 transition-all disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-3 uppercase italic tracking-widest"
          >
            {isGenerating ? (
              <RefreshCw size={28} className="animate-spin" />
            ) : (
              <Play size={28} fill="currentColor" />
            )}
            {isGenerating
              ? "Generating Word..."
              : gameState.groups.length < 2
                ? "Add more groups"
                : gameState.players.length <= gameState.numImposters
                  ? "More players than imposters needed"
                  : selectedCategories.length === 0
                    ? "Select a category"
                    : "Launch Game"}
          </button>

          {/* Optional: Validation Warning text */}
          <div className="flex flex-wrap justify-center gap-2">
            {gameState.groups.length < 2 && (
              <span className="text-[9px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-2 py-1 rounded-full border-2 border-red-100 flex items-center gap-1 animate-pulse">
                ⚠️ Need 2+ Groups
              </span>
            )}
            {gameState.players.length <= gameState.numImposters &&
              gameState.players.length > 0 && (
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-2 py-1 rounded-full border-2 border-red-100 flex items-center gap-1 animate-pulse">
                  ⚠️ Too Many Imposters
                </span>
              )}
            {selectedCategories.length === 0 && (
              <span className="text-[9px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-2 py-1 rounded-full border-2 border-red-100 flex items-center gap-1 animate-pulse">
                ⚠️ Select a Category
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[3rem] p-8 border-8 border-zinc-900 shadow-2xl space-y-6 relative"
            >
              <button
                onClick={() => setShowHelp(false)}
                className="absolute top-6 right-6 p-2 bg-zinc-100 rounded-full hover:bg-zinc-200 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="space-y-2">
                <h3 className="text-3xl font-black uppercase italic tracking-tighter">
                  How to Play
                </h3>
                <div className="w-12 h-2 bg-emerald-500 rounded-full" />
              </div>

              <div className="space-y-4 text-zinc-600 font-bold text-sm leading-relaxed overflow-y-auto max-h-[50vh] pr-2 custom-scrollbar">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center flex-shrink-0 text-xs">
                    1
                  </div>
                  <p>
                    <strong>Setup:</strong> Register your players in{" "}
                    <span className="text-emerald-500">Solo</span> or{" "}
                    <span className="text-emerald-500">Team</span> mode. Select
                    how many{" "}
                    <span className="text-red-500 underline decoration-2">
                      Imposters
                    </span>{" "}
                    you want to hide, and choose your favorite word categories!
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center flex-shrink-0 text-xs">
                    2
                  </div>
                  <p>
                    <strong>The Secret:</strong> Give the device to each player
                    privately. Normal players will see the secret word.
                    Imposters will only see the word "IMPOSTER".
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center flex-shrink-0 text-xs">
                    3
                  </div>
                  <p>
                    <strong>The Setup:</strong> Take turns giving a one-word
                    clue about the secret word. Imposters must blend in and
                    guess what the word might be!
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center flex-shrink-0 text-xs">
                    4
                  </div>
                  <p>
                    <strong>Voting & Scoring:</strong> Everyone votes for who
                    they think the Imposters are!
                    <br />
                    <br />• <strong>Hunters</strong> get{" "}
                    <span className="text-emerald-500">+1pt</span> for every
                    Imposter they correctly vote for.
                    <br />• <strong>Imposters</strong> get{" "}
                    <span className="text-red-500">+1pt</span> for every player
                    they fooled into NOT voting for them!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowHelp(false)}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest"
              >
                Got it!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderReveal = () => {
    if (remoteRoom) {
      const myPlayerInfo = remoteRoom.players.find(
        (p: any) => p.name === remotePlayerName,
      );
      const isImposter = myPlayerInfo?.role === "imposter";
      const progress =
        (remoteRoom.players.filter((p: any) => p.last_active).length /
          remoteRoom.players.length) *
        100;

      return (
        <div className="max-w-md mx-auto px-4 py-4 sm:p-6 flex flex-col items-center justify-center min-h-screen space-y-8">
          <div className="w-full space-y-6">
            <div className="text-center">
              <div className="inline-block px-3 py-1 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
                Mission Briefing • {gameState.category}
              </div>
              <h2 className="text-4xl font-black text-zinc-900 uppercase italic tracking-tighter">
                Secret <span className="text-emerald-500">Identity</span>
              </h2>
            </div>
          </div>

          <motion.div
            className="w-full bg-white rounded-[3rem] shadow-[20px_20px_0_#18181b] border-8 border-zinc-900 flex flex-col items-center justify-center p-8 relative overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <AnimatePresence mode="wait">
              {!gameState.isWordVisible ? (
                <motion.button
                  key="hidden"
                  onClick={() =>
                    setGameState((prev) => ({ ...prev, isWordVisible: true }))
                  }
                  className="flex flex-col items-center gap-6 py-10 text-zinc-300 hover:text-emerald-500 transition-all group"
                >
                  <EyeOff
                    size={100}
                    strokeWidth={1}
                    className="group-hover:scale-110 transition-transform"
                  />
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 group-hover:text-emerald-500">
                    Tap to Reveal Identity
                  </span>
                </motion.button>
              ) : (
                <motion.div
                  key="revealed"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-6 py-10 w-full"
                >
                  {isImposter ? (
                    <div className="text-center space-y-4">
                      <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto border-4 border-red-200">
                        <Ghost size={40} className="text-red-500" />
                      </div>
                      <h3 className="text-5xl font-black text-red-500 uppercase italic tracking-tighter">
                        IMPOSTER
                      </h3>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        Category: {gameState.category}
                      </p>
                      <p className="text-zinc-500 font-bold max-w-xs mx-auto text-sm leading-relaxed underline">
                        HINT: {gameState.imposterHintWord} &{" "}
                        {gameState.imposterHintWord2}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto border-4 border-emerald-200">
                        <Users size={40} className="text-emerald-500" />
                      </div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        Your Secret Word
                      </p>
                      <h3 className="text-5xl font-black text-emerald-500 uppercase italic tracking-tighter">
                        {gameState.secretWord}
                      </h3>
                      <p className="text-zinc-400 font-black uppercase text-xs tracking-widest">
                        {gameState.category}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() =>
                      setGameState((prev) => ({
                        ...prev,
                        isWordVisible: false,
                      }))
                    }
                    className="mt-4 px-6 py-2 bg-zinc-100 rounded-xl text-[10px] font-black uppercase text-zinc-400 hover:bg-zinc-200"
                  >
                    Hide Again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {isRemoteHost ? (
            <button
              onClick={() => updateRemoteState("clues")}
              className="w-full py-5 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest shadow-[0_6px_0_#000] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-3"
            >
              <RefreshCw size={24} />
              Start Clues Phase
            </button>
          ) : (
            <div className="text-center p-6 bg-zinc-100/50 rounded-2xl border-4 border-dashed border-zinc-200 w-full">
              <p className="text-zinc-400 font-black uppercase tracking-widest text-[10px]">
                Waiting for Host to advance...
              </p>
            </div>
          )}

          {/* Scoreboard removed as per user request */}
        </div>
      );
    }

    const currentPlayer = gameState.players[gameState.currentRevealIndex];

    const progress =
      ((gameState.currentRevealIndex + 1) / gameState.players.length) * 100;

    return (
      <div className="max-w-md mx-auto px-4 py-4 sm:p-6 flex flex-col items-center justify-center min-h-screen space-y-4 sm:space-y-8">
        <div className="w-full space-y-3 sm:space-y-6">
          <div className="flex justify-between items-end px-1 sm:px-2">
            <div className="space-y-1">
              <div className="inline-block px-3 py-1 bg-zinc-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                Round {gameState.groups.length}
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-zinc-900 uppercase italic leading-none tracking-tighter">
                Pass to{" "}
                <span className="text-emerald-500 underline decoration-4 underline-offset-4 break-all">
                  {currentPlayer.name}
                </span>
              </h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                Progress
              </p>
              <p className="text-xl font-black text-zinc-900 italic">
                {gameState.currentRevealIndex + 1}/{gameState.players.length}
              </p>
            </div>
          </div>

          <div className="w-full h-4 bg-zinc-100 rounded-full border-2 border-zinc-900 overflow-hidden p-0.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-emerald-500 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]"
            />
          </div>
        </div>

        <motion.div
          className="w-full bg-white rounded-[2rem] sm:rounded-[3rem] md:rounded-[4rem] shadow-[8px_8px_0_#18181b] sm:shadow-[12px_12px_0_#18181b] md:shadow-[20px_20px_0_#18181b] border-4 sm:border-8 border-zinc-900 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden"
          layoutId="reveal-card"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {/* Decorative background elements */}
          <div
            className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.05]"
            style={{
              backgroundImage: "radial-gradient(#000 2px, transparent 2px)",
              backgroundSize: "30px 30px",
            }}
          />
          <AnimatePresence mode="wait">
            {!gameState.isWordVisible ? (
              <motion.button
                key="hidden"
                initial={{ scale: 0.8, opacity: 0, rotate: -5 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 1.2, opacity: 0, rotate: 5 }}
                onClick={() =>
                  setGameState((prev) => ({ ...prev, isWordVisible: true }))
                }
                className="flex flex-col items-center gap-4 sm:gap-6 py-6 sm:py-10 text-zinc-300 hover:text-emerald-500 transition-all group"
              >
                <div className="relative">
                  <Eye
                    size={100}
                    strokeWidth={1}
                    className="group-hover:scale-110 transition-transform"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full -z-10"
                  />
                </div>
                <div className="space-y-1 text-center">
                  <span className="block font-black text-2xl uppercase tracking-tighter text-zinc-900">
                    Tap to Reveal
                  </span>
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em]">
                    Confidential
                  </span>
                </div>
              </motion.button>
            ) : (
              <motion.div
                key="visible"
                initial={{ y: 40, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                className="text-center space-y-5 w-full"
              >
                <div className="space-y-3">
                  <div className="inline-block px-4 py-1 bg-zinc-100 rounded-full border-2 border-zinc-200">
                    <p className="text-zinc-500 font-black uppercase tracking-[0.2em] text-xs">
                      Category: {gameState.category}
                    </p>
                  </div>

                  <div className="relative py-2">
                    <motion.h3
                      initial={{ letterSpacing: "0.3em", opacity: 0 }}
                      animate={{ letterSpacing: "-0.02em", opacity: 1 }}
                      className={`text-4xl xs:text-5xl sm:text-6xl font-black uppercase italic leading-tight break-words hyphens-auto word-break-all ${currentPlayer.isImposter ? "text-red-500" : "text-zinc-900"}`}
                      style={{
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {currentPlayer.isImposter
                        ? "IMPOSTER"
                        : gameState.secretWord}
                    </motion.h3>
                    {currentPlayer.isImposter && (
                      <motion.div
                        animate={{ opacity: [0.2, 0.5, 0.2] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="absolute inset-0 bg-red-500/5 blur-2xl -z-10"
                      />
                    )}
                  </div>
                </div>

                <div
                  className={`px-4 py-3 rounded-2xl border-4 ${currentPlayer.isImposter ? "border-red-100 bg-red-50/80" : "border-zinc-50 bg-zinc-50/50"}`}
                >
                  {currentPlayer.isImposter ? (
                    <div className="space-y-2">
                      <p className="text-red-600 font-black text-xs uppercase leading-tight">
                        You don't know the word! FAKE IT.
                      </p>
                      <div className="bg-white rounded-xl border-2 border-red-100 p-2 text-left space-y-1">
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                          Imposter Hints 🎭
                        </p>
                        <div className="flex flex-wrap gap-1">
                          <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-lg font-black text-[11px] border border-red-100">
                            {gameState.imposterHintWord}
                          </span>
                          {gameState.imposterHintWord2 && (
                            <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-lg font-black text-[11px] border border-red-100">
                              {gameState.imposterHintWord2}
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-500 font-medium text-[10px] italic">
                          Blend in using these related concepts.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-emerald-600 font-black text-xs uppercase leading-tight">
                      Describe this word without being too obvious.
                    </p>
                  )}
                </div>

                <button
                  onClick={nextReveal}
                  className="w-full py-4 bg-zinc-900 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center justify-center gap-3 shadow-[0_6px_0_#000] active:shadow-none active:translate-y-1"
                >
                  Confirm <ChevronRight size={22} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="flex items-center gap-3 text-zinc-400 font-black uppercase tracking-widest text-xs">
          <Info size={14} />
          <span>Don't let others see!</span>
        </div>

        {/* Local Scoreboard removed as per user request */}
      </div>
    );
  };

  const renderClues = () => {
    if (remoteRoom) {
      return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-12 min-h-screen">
          <div className="text-center space-y-10">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="inline-block px-8 py-2.5 bg-zinc-900 text-white rounded-full text-xs font-black uppercase tracking-[0.3em] shadow-[10px_10px_0_#10b981]"
            >
              Discussion Phase
            </motion.div>
            <div className="space-y-4">
              <h2 className="text-5xl sm:text-7xl lg:text-9xl font-black text-zinc-900 uppercase italic tracking-tighter leading-[0.85]">
                Speak Your <span className="text-emerald-500">Truth</span>
              </h2>
              <p className="text-zinc-500 font-bold max-w-md mx-auto text-lg leading-relaxed pt-4">
                Talk to each other. One short clue per player. Identify the{" "}
                <span className="text-red-500 underline">Imposter</span>.
              </p>

              {gameState.discussionStarterId && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center gap-3 bg-emerald-50 border-2 border-emerald-500 px-6 py-3 rounded-2xl mx-auto"
                >
                  <MessageSquare className="text-emerald-500" size={20} />
                  <span className="font-black uppercase text-sm text-zinc-900 italic">
                    Starter:{" "}
                    <span className="text-emerald-600 underline">
                      {gameState.discussionStarterId}
                    </span>
                  </span>
                </motion.div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {remoteRoom.players.map((p: any, i: number) => {
              const isStarter = p.name === gameState.discussionStarterId;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={`bg-white rounded-[2.5rem] p-6 shadow-[15px_15px_0_#18181b] border-4 flex items-center gap-6 group hover:-translate-y-2 transition-all ${isStarter ? "border-emerald-500" : "border-zinc-900"}`}
                >
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-white text-2xl italic rotate-3 group-hover:rotate-0 transition-transform ${isStarter ? "bg-emerald-500" : "bg-zinc-900"}`}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black uppercase italic text-zinc-900 tracking-tighter">
                        {p.name}
                      </h3>
                      {isStarter && (
                        <div className="bg-emerald-500 text-white p-1 rounded-lg">
                          <MessageSquare size={12} fill="currentColor" />
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">
                      {isStarter ? "Starts the Discussion" : "Participant"}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="pt-10 flex flex-col items-center gap-6">
            {isRemoteHost ? (
              <button
                onClick={() => updateRemoteState("voting")}
                className="px-12 py-6 bg-zinc-900 text-white rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xl hover:bg-emerald-500 transition-all shadow-[0_12px_0_#000] active:shadow-none active:translate-y-3 flex items-center justify-center gap-4"
              >
                <Vote size={28} /> Start Voting Phase <ChevronRight size={28} />
              </button>
            ) : (
              <div className="text-center p-8 bg-zinc-100 rounded-3xl border-4 border-dashed border-zinc-200">
                <p className="text-zinc-500 font-black uppercase tracking-widest text-sm animate-pulse">
                  The Host will start voting soon...
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 lg:py-16 space-y-12 sm:space-y-20 min-h-screen">
        <div className="text-center space-y-8 sm:space-y-10">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-block px-8 py-2.5 bg-zinc-900 text-white rounded-full text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] shadow-[6px_6px_0_#10b981] sm:shadow-[10px_10px_0_#10b981]"
          >
            Discussion Phase
          </motion.div>
          <div className="space-y-4">
            <h2 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-zinc-900 uppercase italic tracking-tighter leading-[0.85]">
              Speak Your <span className="text-emerald-500">Truth</span>
            </h2>
            <p className="text-zinc-400 font-black uppercase tracking-[0.3em] text-[10px] sm:text-sm">
              Round {gameState.groups.length} • {gameState.players.length}{" "}
              Players 👥
            </p>
          </div>
          <div className="space-y-4">
            <p className="text-zinc-500 font-bold max-w-md mx-auto text-sm sm:text-lg">
              Each player gives one short clue about the secret word. Don't be
              too obvious!
            </p>
            <div className="inline-flex items-center gap-3 bg-white px-6 py-4 rounded-2xl border-2 border-emerald-500 shadow-[4px_4px_0_#10b981]">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-sm font-black text-zinc-900 uppercase tracking-widest">
                <span className="text-emerald-600">
                  {
                    gameState.players.find(
                      (p) => p.id === gameState.discussionStarterId,
                    )?.name
                  }
                </span>{" "}
                starts the discussion!
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-10">
          {remoteRoom
            ? // Remote: Group players by team if teammates exist, or show as individuals
              Array.from(
                new Set(
                  remoteRoom.players.map((p: any) => p.team_name || "No Team"),
                ),
              ).map((teamName: any, teamIdx) => {
                const teamPlayers = remoteRoom.players.filter(
                  (p: any) => (p.team_name || "No Team") === teamName,
                );
                return (
                  <motion.div
                    key={teamName}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: teamIdx * 0.1 }}
                    className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-[8px_8px_0_#18181b] sm:shadow-[15px_15px_0_#18181b] border-4 border-zinc-900 space-y-8 relative overflow-hidden group hover:-translate-y-2 hover:shadow-[12px_12px_0_#18181b] sm:hover:shadow-[20px_20px_0_#18181b] transition-all"
                  >
                    <div className="flex justify-between items-start relative">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                            {teamName === "No Team" ? "Individual" : "Team"}
                          </p>
                        </div>
                        <h3 className="text-2xl font-black uppercase italic text-zinc-900 leading-none tracking-tighter">
                          {teamName}
                        </h3>
                      </div>
                    </div>

                    <div className="space-y-4 relative">
                      {teamPlayers.map((p: any, pIdx: number) => (
                        <div
                          key={p.name}
                          className="flex items-center gap-4 px-6 py-5 bg-zinc-50 rounded-[2rem] font-black text-zinc-900 border-2 border-zinc-100 group-hover:border-emerald-500/30 group-hover:bg-emerald-50/30 transition-all"
                        >
                          <div
                            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs italic ${p.name === gameState.discussionStarterId ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-zinc-200 text-zinc-400"}`}
                          >
                            {p.name === gameState.discussionStarterId ? (
                              <Vote size={16} />
                            ) : (
                              pIdx + 1
                            )}
                          </div>
                          <span className="uppercase tracking-tight text-lg flex items-center gap-2">
                            {p.name}
                            {p.name === gameState.discussionStarterId && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-1 rounded-lg font-black tracking-widest border border-emerald-200">
                                First
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })
            : gameState.groups.map((group, index) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-[8px_8px_0_#18181b] sm:shadow-[15px_15px_0_#18181b] border-4 border-zinc-900 space-y-8 relative overflow-hidden group hover:-translate-y-2 hover:shadow-[12px_12px_0_#18181b] sm:hover:shadow-[20px_20px_0_#18181b] transition-all"
                >
                  {/* Background Number */}
                  <div className="absolute -bottom-10 -right-10 text-[12rem] font-black text-zinc-50 opacity-0 group-hover:opacity-100 transition-all duration-500 select-none pointer-events-none italic">
                    {index + 1}
                  </div>

                  <div className="flex justify-between items-start relative">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                          Active Team
                        </p>
                      </div>
                      <h3 className="text-3xl font-black uppercase italic text-zinc-900 leading-none tracking-tighter">
                        {group.name}
                      </h3>
                    </div>
                    <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center font-black italic text-white shadow-lg rotate-3 group-hover:rotate-0 transition-transform">
                      #{group.id}
                    </div>
                  </div>

                  <div className="space-y-4 relative">
                    {group.playerIds.map((pid, pIdx) => (
                      <div
                        key={pid}
                        className="flex items-center gap-4 px-6 py-5 bg-zinc-50 rounded-[2rem] font-black text-zinc-900 border-2 border-zinc-100 group-hover:border-emerald-500/30 group-hover:bg-emerald-50/30 transition-all"
                      >
                        <div
                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs italic ${pid === gameState.discussionStarterId ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-zinc-200 text-zinc-400"}`}
                        >
                          {pid === gameState.discussionStarterId ? (
                            <Vote size={16} />
                          ) : (
                            pIdx + 1
                          )}
                        </div>
                        <span className="uppercase tracking-tight text-lg flex items-center gap-2">
                          {gameState.players.find((p) => p.id === pid)?.name}
                          {pid === gameState.discussionStarterId && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-1 rounded-lg font-black tracking-widest border border-emerald-200">
                              First
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="pt-10 flex flex-col items-center gap-6"
        >
          <button
            onClick={() =>
              setGameState((prev) => ({ ...prev, phase: "VOTING" }))
            }
            className="group relative px-6 py-5 md:px-12 md:py-6 bg-zinc-900 text-white rounded-[2rem] md:rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-lg md:text-xl hover:bg-emerald-500 transition-all shadow-[0_8px_0_#000] md:shadow-[0_12px_0_#000] active:shadow-none active:translate-y-3"
          >
            <span className="relative z-10 flex items-center gap-4">
              <Vote size={28} /> Initiate Voting <ChevronRight size={28} />
            </span>
          </button>
          <p className="text-zinc-400 font-black uppercase tracking-widest text-[10px] flex items-center gap-2">
            <Info size={14} /> Ready to catch the imposter?
          </p>
        </motion.div>
      </div>
    );
  };

  const renderVoting = () => {
    if (remoteRoom) {
      const myPlayer = remoteRoom.players.find(
        (p: any) => p.name === remotePlayerName,
      );
      const others = remoteRoom.players.filter(
        (p: any) => p.name !== remotePlayerName,
      );
      const hasSubmitted = !!myPlayer?.vote;
      const currentSelection = hasSubmitted
        ? myPlayer.vote.includes(",")
          ? myPlayer.vote.split(",")
          : [myPlayer.vote]
        : localRemoteVotes;

      const votedCount = remoteRoom.players.filter(
        (p: any) => p.hasVoted,
      ).length;

      const toggleLocalVote = (name: string) => {
        if (hasSubmitted) return;
        setLocalRemoteVotes((prev) => {
          if (prev.includes(name)) return prev.filter((n) => n !== name);
          if (prev.length < gameState.numImposters) return [...prev, name];
          return [...prev.slice(1), name];
        });
      };

      return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-12 min-h-screen">
          <div className="text-center space-y-10">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="inline-block px-8 py-3 bg-red-500 text-white rounded-full text-xs font-black uppercase tracking-[0.3em] shadow-[10px_10px_0_#000]"
            >
              Voting Phase • {votedCount}/{remoteRoom.players.length} Voted
            </motion.div>
            <div className="space-y-6">
              <h2 className="text-5xl sm:text-7xl lg:text-9xl font-black text-zinc-900 uppercase italic tracking-tighter leading-[0.85]">
                Who is <span className="text-red-500">Sus?</span>
              </h2>
              <p className="text-zinc-500 font-black uppercase tracking-widest text-xs pt-4">
                Select {gameState.numImposters} Suspected Imposter
                {gameState.numImposters > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {others.map((player: any, index: number) => {
              const isSelected = currentSelection.includes(player.name);
              return (
                <motion.button
                  key={player.name}
                  onClick={() => toggleLocalVote(player.name)}
                  className={`w-full p-8 rounded-[3rem] border-4 transition-all text-left flex justify-between items-center group relative overflow-hidden ${
                    isSelected
                      ? "bg-zinc-900 border-zinc-900 text-white shadow-[15px_15px_0_#ef4444]"
                      : player.hasVoted && !hasSubmitted
                        ? "bg-zinc-50 border-zinc-100 text-zinc-400 opacity-50"
                        : "bg-white border-zinc-100 text-zinc-900 hover:border-zinc-900 hover:shadow-[15px_15px_0_#18181b]"
                  }`}
                >
                  <div className="relative z-10 space-y-2">
                    <div className="flex flex-col">
                      <h3 className="text-2xl font-black uppercase italic leading-none tracking-tighter">
                        {player.name}
                      </h3>
                      {player.team_name && (
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic mt-1">
                          Team: {player.team_name}
                        </span>
                      )}
                    </div>
                    {player.hasVoted && (
                      <span className="text-[10px] font-black uppercase text-emerald-500">
                        Already Voted ✓
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <div className="bg-red-500 text-white w-10 h-10 rounded-2xl flex items-center justify-center font-black">
                      {currentSelection.indexOf(player.name) + 1}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          <div className="pt-10 flex flex-col items-center gap-6">
            {!hasSubmitted ? (
              <button
                disabled={currentSelection.length === 0}
                onClick={() => submitRemoteVote(currentSelection)}
                className="w-full py-6 bg-red-500 text-white rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xl shadow-[0_12px_0_#991b1b] active:shadow-none active:translate-y-3 transition-all disabled:opacity-30 disabled:grayscale flex flex-col items-center justify-center gap-1"
              >
                <div className="flex items-center gap-4">
                  {currentSelection.length < gameState.numImposters ? (
                    <>
                      Pick {gameState.numImposters - currentSelection.length}{" "}
                      More <ChevronRight size={28} />
                    </>
                  ) : (
                    <>
                      Confirm Selection <Check size={28} />
                    </>
                  )}
                </div>
                {currentSelection.length > 0 &&
                  currentSelection.length < gameState.numImposters && (
                    <span className="text-[10px] opacity-60">
                      (You can confirm now if you're sure)
                    </span>
                  )}
              </button>
            ) : isRemoteHost ? (
              <button
                onClick={handleRemoteReveal}
                className="px-12 py-6 bg-zinc-900 text-white rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xl hover:bg-emerald-500 transition-all shadow-[0_12px_0_#000] active:shadow-none active:translate-y-3 flex items-center justify-center gap-4"
              >
                <Trophy size={28} /> Reveal Results <ChevronRight size={28} />
              </button>
            ) : (
              <div className="text-center p-8 bg-zinc-100 rounded-3xl border-4 border-dashed border-zinc-200 w-full">
                <p className="text-zinc-500 font-black uppercase tracking-widest text-sm animate-pulse">
                  Waiting for everyone to vote and host to reveal...
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }
    const currentPlayer = gameState.players[gameState.currentVotingPlayerIndex];
    const currentPlayerVotes = gameState.playerVotes[currentPlayer.id] || [];
    const isLastPlayer =
      gameState.currentVotingPlayerIndex === gameState.players.length - 1;

    const toggleVote = (playerId: string) => {
      setGameState((prev) => {
        const currentVotes = prev.playerVotes[currentPlayer.id] || [];
        let newVotes;
        if (currentVotes.includes(playerId)) {
          newVotes = currentVotes.filter((id) => id !== playerId);
        } else if (currentVotes.length < gameState.numImposters) {
          newVotes = [...currentVotes, playerId];
        } else {
          // Replace the oldest vote if at limit
          const sliceIndex =
            currentVotes.length === gameState.numImposters ? 1 : 0;
          newVotes = [...currentVotes.slice(sliceIndex), playerId];
        }
        return {
          ...prev,
          playerVotes: {
            ...prev.playerVotes,
            [currentPlayer.id]: newVotes,
          },
        };
      });
    };

    const handleConfirmVote = () => {
      if (isLastPlayer) {
        revealResult();
      } else {
        setGameState((prev) => ({
          ...prev,
          currentVotingPlayerIndex: prev.currentVotingPlayerIndex + 1,
        }));
      }
    };

    return (
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-40 sm:py-20 space-y-12 sm:space-y-20 min-h-screen">
        <div className="text-center space-y-10 sm:space-y-16">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-block px-8 py-3 bg-red-500 text-white rounded-full text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] shadow-[6px_6px_0_#000] sm:shadow-[10px_10px_0_#000]"
          >
            Voting Phase • {gameState.currentVotingPlayerIndex + 1}/
            {gameState.players.length}
          </motion.div>
          <div className="space-y-6">
            <h2 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black text-zinc-900 uppercase italic tracking-tighter leading-[0.85] break-words">
              <span className="text-red-500 underline decoration-8 sm:decoration-[12px] underline-offset-[8px] sm:underline-offset-12">
                {currentPlayer.name}
              </span>
              's Turn
            </h2>
            <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px] sm:text-xs pt-2">
              Select {gameState.numImposters} Suspected Imposter
              {gameState.numImposters > 1 ? "s" : ""}
            </p>
          </div>
          <p className="text-zinc-500 font-bold max-w-md mx-auto text-sm sm:text-lg px-4">
            Who is acting suspicious? You must pick {gameState.numImposters}{" "}
            player{gameState.numImposters > 1 ? "s" : ""} you suspect{" "}
            {gameState.numImposters > 1
              ? "are the imposters"
              : "is the imposter"}
            .
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {gameState.players
            .filter((p) => p.id !== currentPlayer.id)
            .map((player, index) => {
              const isSelected = currentPlayerVotes.includes(player.id);
              const playerGroup = gameState.groups.find((g) =>
                g.playerIds.includes(player.id),
              );
              return (
                <motion.button
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => toggleVote(player.id)}
                  className={`w-full p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] border-4 transition-all text-left flex justify-between items-center group relative overflow-hidden ${
                    isSelected
                      ? "bg-zinc-900 border-zinc-900 text-white scale-[1.02] shadow-[8px_8px_0_#ef4444] sm:shadow-[15px_15px_0_#ef4444]"
                      : "bg-white border-zinc-100 text-zinc-900 hover:border-zinc-900 hover:shadow-[8px_8px_0_#18181b] sm:hover:shadow-[15px_15px_0_#18181b]"
                  }`}
                >
                  <div className="relative z-10 space-y-2">
                    <div className="flex items-center gap-2">
                      <Users
                        size={14}
                        className={
                          isSelected ? "text-red-500" : "text-zinc-400"
                        }
                      />
                      <p
                        className={`text-[10px] font-black uppercase tracking-[0.2em] ${isSelected ? "text-zinc-400" : "text-zinc-400"}`}
                      >
                        {playerGroup?.name || "Independent"}
                      </p>
                    </div>
                    <h3 className="text-2xl font-black uppercase italic leading-none tracking-tighter">
                      {player.name}
                    </h3>
                  </div>

                  <div className="relative z-10">
                    <AnimatePresence mode="wait">
                      {isSelected ? (
                        <motion.div
                          key="selected"
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: 45 }}
                          className="bg-red-50 p-3 rounded-2xl shadow-xl flex items-center justify-center border-2 border-red-500"
                        >
                          <span className="text-red-500 font-black text-xl">
                            {currentPlayerVotes.indexOf(player.id) + 1}
                          </span>
                        </motion.div>
                      ) : (
                        <div className="w-10 h-10 rounded-2xl border-4 border-zinc-100 flex items-center justify-center text-zinc-200 group-hover:border-zinc-900 group-hover:text-zinc-900 transition-colors">
                          <div className="w-2 h-2 rounded-full bg-current" />
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>
              );
            })}
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="pt-10"
        >
          <button
            disabled={currentPlayerVotes.length === 0}
            onClick={handleConfirmVote}
            className="w-full py-4 sm:py-6 md:py-8 bg-red-500 text-white rounded-[2rem] md:rounded-[3rem] font-black text-xl sm:text-2xl md:text-3xl shadow-[0_6px_0_#991b1b] sm:shadow-[0_10px_0_#991b1b] md:shadow-[0_15px_0_#991b1b] active:shadow-none active:translate-y-3 transition-all disabled:opacity-30 disabled:grayscale flex flex-col items-center justify-center gap-1 uppercase italic tracking-[0.1em]"
          >
            <div className="flex items-center gap-4">
              {isLastPlayer ? "Reveal Truth" : "Confirm Vote"}{" "}
              <ChevronRight size={32} />
            </div>
            {currentPlayerVotes.length > 0 &&
              currentPlayerVotes.length < gameState.numImposters && (
                <span className="text-xs opacity-60 not-italic font-bold">
                  ({gameState.numImposters - currentPlayerVotes.length} more
                  possible)
                </span>
              )}
          </button>
          <p className="text-center mt-6 text-zinc-400 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
            <Info size={14} /> {currentPlayerVotes.length}/
            {gameState.numImposters} votes selected
          </p>
        </motion.div>
      </div>
    );
  };

  const revealResult = () => {
    const imposters = gameState.players.filter((p) => p.isImposter);
    const imposterIds = imposters.map((p) => p.id);

    // Calculate total votes for each player
    const voteCounts: Record<string, number> = {};
    Object.values(gameState.playerVotes).forEach((votes) => {
      (votes as string[]).forEach((playerId) => {
        voteCounts[playerId] = (voteCounts[playerId] || 0) + 1;
      });
    });

    // Find the player(s) with the most votes
    let maxVotes = 0;
    let mostVotedPlayerIds: string[] = [];
    Object.entries(voteCounts).forEach(([playerId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        mostVotedPlayerIds = [playerId];
      } else if (count === maxVotes) {
        mostVotedPlayerIds.push(playerId);
      }
    });

    // Players "catch" the imposters if at least one imposter is among the most voted
    const caughtImposters = mostVotedPlayerIds.filter((id) =>
      imposterIds.includes(id),
    );
    const isCorrect = caughtImposters.length > 0;

    // Calculate points:
    // 1. Each non-imposter voter gets +1 for EACH imposter they correctly identified.
    // 2. Each imposter gets +1 point for EVERY non-imposter who failed to vote for them specifically.
    const groupPoints: Record<number, number> = {};
    gameState.groups.forEach((g) => (groupPoints[g.id] = 0));

    const nonImposterVoters = gameState.players.filter(
      (p) => !imposterIds.includes(p.id),
    );

    nonImposterVoters.forEach((voter) => {
      const votes = gameState.playerVotes[voter.id] || [];

      // Points for the voter's team
      const correctVotesForThisVoter = votes.filter((targetId) =>
        imposterIds.includes(targetId),
      );
      if (correctVotesForThisVoter.length > 0) {
        const group = gameState.groups.find((g) =>
          g.playerIds.includes(voter.id),
        );
        if (group)
          groupPoints[group.id] =
            (groupPoints[group.id] || 0) + correctVotesForThisVoter.length;
      }

      // Points for the imposters' teams
      imposters.forEach((imp) => {
        if (!votes.includes(imp.id)) {
          // This specific imposter was NOT caught by this voter
          const impGroup = gameState.groups.find((g) =>
            g.playerIds.includes(imp.id),
          );
          if (impGroup)
            groupPoints[impGroup.id] = (groupPoints[impGroup.id] || 0) + 1;
        }
      });
    });

    const updatedGroups = gameState.groups.map((group) => ({
      ...group,
      score: group.score + (groupPoints[group.id] || 0),
    }));

    setGameState((prev) => ({
      ...prev,
      groups: updatedGroups,
      phase: "RESULT",
    }));

    // Perform backend updates in a single bulk request, then refresh
    const updateBackend = async () => {
      try {
        const batch = updatedGroups.map((group) => {
          const roundScore = groupPoints[group.id] || 0;
          const members = group.playerIds.map(
            (id) => gameState.players.find((p) => p.id === id)?.name || "",
          );
          return {
            name: group.name,
            score: roundScore,
            members,
            type: gameMode === "TEAM" ? "team" : "solo",
          };
        });

        if (batch.length > 0) {
          await fetch("/api/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batch),
          });
          // Small delay to let Vercel state settle before fetching the list
          setTimeout(fetchGlobalLeaderboard, 500);
        }
      } catch (err) {
        console.error("Bulk scoring update failed:", err);
      }
    };

    updateBackend();
  };

  const renderResult = () => {
    if (remoteRoom) {
      const imposterPlayers = remoteRoom.players.filter(
        (p: any) => p.role === "imposter",
      );
      const imposterIds = imposterPlayers.map((p: any) => p.name);
      const voteCounts: Record<string, number> = {};
      remoteRoom.players.forEach((p: any) => {
        if (p.vote) {
          const names = p.vote.includes(",") ? p.vote.split(",") : [p.vote];
          names.forEach((name: string) => {
            voteCounts[name] = (voteCounts[name] || 0) + 1;
          });
        }
      });

      let maxVotes = 0;
      let mostVotedPlayerNames: string[] = [];
      Object.entries(voteCounts).forEach(([name, count]) => {
        if (count > maxVotes) {
          maxVotes = count;
          mostVotedPlayerNames = [name];
        } else if (count === maxVotes) {
          mostVotedPlayerNames.push(name);
        }
      });

      const caughtImposters = mostVotedPlayerNames.filter((name) =>
        imposterIds.includes(name),
      );
      const isCorrect = caughtImposters.length > 0;

      const votingSummary = remoteRoom.players.map((p: any) => {
        const votes = p.vote
          ? p.vote.includes(",")
            ? p.vote.split(",")
            : [p.vote]
          : [];
        const isImposter = p.role === "imposter";
        let pointsGained = 0;

        if (!isImposter) {
          pointsGained = votes.filter((v: string) =>
            imposterIds.includes(v),
          ).length;
        } else {
          const nonImposters = remoteRoom.players.filter(
            (pl: any) => pl.role !== "imposter",
          );
          pointsGained = nonImposters.filter((ni: any) => {
            const niVotes = ni.vote
              ? ni.vote.includes(",")
                ? ni.vote.split(",")
                : [ni.vote]
              : [];
            return !niVotes.includes(p.name);
          }).length;
        }

        return {
          name: p.name,
          team_name: p.team_name,
          isImposter,
          pointsGained,
          votes,
        };
      });

      return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-12 min-h-screen">
          <div className="text-center space-y-8 relative">
            <div className="absolute -top-2 -right-2">
              <button
                onClick={() =>
                  setGameState((prev) => ({ ...prev, phase: "LEADERBOARD" }))
                }
                title="View Global Leaderboard"
                className="p-2 text-amber-500 hover:text-amber-600 transition-all hover:scale-110 active:scale-95 flex flex-col items-center"
              >
                <Trophy size={32} fill="currentColor" />
                <span className="text-[8px] font-black uppercase mt-1">
                  Board
                </span>
              </button>
            </div>
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`inline-block px-10 py-3 text-white rounded-full text-xs font-black uppercase tracking-[0.4em] shadow-[8px_8px_0_#18181b] ${isCorrect ? "bg-emerald-500" : "bg-red-500"}`}
            >
              {isCorrect ? "Imposter Caught!" : "Imposter Escaped!"}
            </motion.div>
            <h2 className="text-6xl font-black text-zinc-900 uppercase italic tracking-tighter">
              The <span className="text-emerald-500">Reveal</span>
            </h2>
          </div>

          <div className="bg-white rounded-[3rem] p-8 border-8 border-zinc-900 shadow-[20px_20px_0_#18181b] space-y-8">
            <div className="text-center space-y-4">
              <p className="text-zinc-400 font-black uppercase tracking-widest text-[10px]">
                The Secret Word Was
              </p>
              <h3 className="text-6xl font-black text-emerald-500 uppercase italic tracking-tighter">
                {gameState.secretWord}
              </h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Imposters Column */}
              <div className="space-y-6">
                <div className="bg-zinc-50 rounded-3xl p-6 border-4 border-zinc-100">
                  <h4 className="font-black uppercase text-sm mb-4 flex items-center gap-2">
                    <Ghost size={20} className="text-red-500" /> Imposters
                  </h4>
                  {imposterPlayers.map((p: any) => (
                    <div
                      key={p.name}
                      className="p-4 bg-zinc-900 text-white rounded-2xl font-black uppercase mb-2"
                    >
                      <div className="flex flex-col">
                        <span>{p.name}</span>
                        {p.team_name && (
                          <span className="text-[10px] font-black text-emerald-500/70 uppercase">
                            Team: {p.team_name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-zinc-50 rounded-3xl p-6 border-4 border-zinc-100 max-h-[400px] overflow-y-auto custom-scrollbar">
                  <h4 className="font-black uppercase text-sm mb-4">
                    Voting Breakdown 🗳️
                  </h4>
                  {remoteRoom.players.map((p: any) => {
                    const votes = p.vote
                      ? p.vote.includes(",")
                        ? p.vote.split(",")
                        : [p.vote]
                      : [];
                    return (
                      <div
                        key={p.name}
                        className="text-xs font-bold uppercase py-2 flex flex-col border-b border-zinc-100 last:border-0"
                      >
                        <div className="flex justify-between">
                          <div className="flex flex-col">
                            <span className="text-zinc-900">{p.name}</span>
                            {p.team_name && (
                              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest italic">
                                Team: {p.team_name}
                              </span>
                            )}
                          </div>
                          <span className="text-zinc-400">
                            {votes.length} vote{votes.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {votes.map((v: string) => (
                            <span
                              key={v}
                              className={
                                imposterIds.includes(v)
                                  ? "text-emerald-500"
                                  : "text-red-400"
                              }
                            >
                              {v}
                            </span>
                          ))}
                          {votes.length === 0 && (
                            <span className="text-zinc-300 italic">No one</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scoreboard Column (Spans 2) */}
              <div className="lg:col-span-2 bg-white rounded-[2.5rem] border-4 border-zinc-900 p-8 shadow-[15px_15px_0_#18181b]">
                <div className="flex justify-between items-center mb-8">
                  <h4 className="text-3xl font-black uppercase italic tracking-tighter">
                    Round Scoreboard
                  </h4>
                  <div className="px-4 py-1 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                    Points Gained
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {votingSummary
                    .sort((a, b) => b.pointsGained - a.pointsGained)
                    .map((p: any) => (
                      <div
                        key={p.name}
                        className="flex justify-between items-center p-5 bg-zinc-50 rounded-2xl border-2 border-zinc-100 group hover:border-emerald-500 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl border-4 ${p.pointsGained > 0 ? "bg-emerald-50 border-emerald-500 text-emerald-600" : "bg-white border-zinc-200 text-zinc-300"}`}
                          >
                            {p.isImposter ? "🎭" : "👤"}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xl font-black text-zinc-900 uppercase italic leading-none">
                              {p.name}
                            </span>
                            {p.team_name && (
                              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                                {p.team_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-3xl font-black ${p.pointsGained > 0 ? "text-emerald-500" : "text-zinc-300"}`}
                          >
                            +{p.pointsGained}
                          </span>
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                            pts
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {isRemoteHost ? (
              <button
                onClick={() => updateRemoteState("lobby")}
                className="w-full py-6 bg-zinc-900 text-white rounded-3xl font-black uppercase tracking-widest shadow-[0_10px_0_#000] active:shadow-none active:translate-y-2 transition-all flex items-center justify-center gap-4 text-xl"
              >
                <RefreshCw size={28} /> Start New Round
              </button>
            ) : (
              <div className="text-center p-8 bg-zinc-100 rounded-3xl border-4 border-dashed border-zinc-200">
                <p className="text-zinc-500 font-black uppercase tracking-widest text-sm animate-pulse">
                  The host is preparing the next round...
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }
    const imposterPlayers = gameState.players.filter((p) => p.isImposter);
    const imposterIds = imposterPlayers.map((p) => p.id);

    // Calculate total votes for each player
    const voteCounts: Record<string, number> = {};
    Object.values(gameState.playerVotes).forEach((votes) => {
      (votes as string[]).forEach((playerId) => {
        voteCounts[playerId] = (voteCounts[playerId] || 0) + 1;
      });
    });

    // Find the player(s) with the most votes
    let maxVotes = 0;
    let mostVotedPlayerIds: string[] = [];
    Object.entries(voteCounts).forEach(([playerId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        mostVotedPlayerIds = [playerId];
      } else if (count === maxVotes) {
        mostVotedPlayerIds.push(playerId);
      }
    });

    const caughtImposters = mostVotedPlayerIds.filter((id) =>
      imposterIds.includes(id),
    );
    const isCorrect = caughtImposters.length > 0;
    const sortedGroups = [...gameState.groups].sort(
      (a, b) => b.score - a.score,
    );

    // Identify which players voted correctly (at least one imposter)
    const votingSummary = gameState.players.map((player) => {
      const votes = gameState.playerVotes[player.id] || [];
      const correctVotes = votes.filter((id) => imposterIds.includes(id));
      const group = gameState.groups.find((g) =>
        g.playerIds.includes(player.id),
      )!;
      const isImposter = imposterIds.includes(player.id);

      let pointsGained = 0;
      if (!isImposter) {
        pointsGained = correctVotes.length;
      } else {
        // Imposters gain points for every non-imposter who missed THEM specifically
        const nonImposters = gameState.players.filter(
          (p) => !imposterIds.includes(p.id),
        );
        pointsGained = nonImposters.filter((p) => {
          const pVotes = gameState.playerVotes[p.id] || [];
          return !pVotes.includes(player.id);
        }).length;
      }

      return {
        id: player.id,
        name: player.name,
        groupName: group.name,
        isImposter,
        votes,
        correctVotesCount: correctVotes.length,
        pointsGained,
        votedCorrectly: correctVotes.length > 0,
      };
    });

    return (
      <div className="max-w-6xl mx-auto px-4 py-6 sm:p-6 space-y-8 sm:space-y-12 text-center pb-16 sm:pb-32 min-h-screen">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className={`p-10 sm:p-20 md:p-32 rounded-[3.5rem] sm:rounded-[5rem] lg:rounded-[8rem] border-4 sm:border-8 shadow-[12px_12px_0_#18181b] sm:shadow-[25px_25px_0_#18181b] lg:shadow-[40px_40px_0_#18181b] ${isCorrect ? "bg-emerald-50 border-emerald-500" : "bg-red-50 border-red-500"} space-y-6 sm:space-y-12 relative overflow-hidden`}
        >
          <motion.div
            animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="text-8xl sm:text-9xl md:text-[12rem] mb-6 relative z-10"
          >
            {isCorrect ? "🏆" : "🎭"}
          </motion.div>
          <div className="space-y-6 relative z-10">
            <h2
              className={`text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black uppercase italic leading-[0.85] tracking-tighter ${isCorrect ? "text-emerald-600" : "text-red-600"}`}
            >
              {isCorrect ? "Found Them!" : "They Escaped!"}
            </h2>
            <div className="inline-block px-6 py-2 bg-white/50 backdrop-blur-sm rounded-full border-2 border-zinc-200">
              <p className="text-zinc-500 font-black text-sm uppercase tracking-[0.2em]">
                Secret Word:{" "}
                <span className="text-zinc-900 underline decoration-4 underline-offset-4">
                  {gameState.secretWord}
                </span>
              </p>
            </div>
          </div>

          {/* Decorative background number */}
          <div className="absolute -left-10 md:-left-20 -bottom-10 md:-bottom-20 text-[15rem] md:text-[25rem] font-black italic opacity-[0.03] text-zinc-900 pointer-events-none select-none">
            {isCorrect ? "✓" : "✗"}
          </div>
        </motion.div>

        {/* Voting Accuracy Graph & Points Gained */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-10 shadow-[10px_10px_0_#18181b] md:shadow-[15px_15px_0_#18181b] border-4 border-zinc-900 space-y-8 text-left"
          >
            <div className="space-y-2">
              <div className="inline-block px-4 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
                Hunting Accuracy
              </div>
              <h3 className="text-4xl font-black uppercase italic text-zinc-900 leading-none tracking-tighter">
                Who Found Them?
              </h3>
            </div>

            <div className="space-y-6">
              {votingSummary
                .filter((p) => !p.isImposter)
                .map((p, i) => (
                  <div key={p.id} className="space-y-3">
                    <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-zinc-400">
                      <span>{p.name}</span>
                      <span
                        className={
                          p.votedCorrectly
                            ? "text-emerald-500"
                            : "text-zinc-300"
                        }
                      >
                        {p.correctVotesCount}/{gameState.numImposters} Found
                      </span>
                    </div>
                    <div className="h-4 bg-zinc-100 rounded-full overflow-hidden border-2 border-zinc-900 p-0.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(p.correctVotesCount / gameState.numImposters) * 100}%`,
                        }}
                        className={`h-full rounded-full ${p.votedCorrectly ? "bg-emerald-500" : "bg-zinc-300"}`}
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {p.votes.map((votedId) => {
                        const votedPlayer = gameState.players.find(
                          (pl) => pl.id === votedId,
                        );
                        const isCorrect = imposterIds.includes(votedId);
                        return (
                          <span
                            key={votedId}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 ${
                              isCorrect
                                ? "bg-emerald-50 border-emerald-500 text-emerald-600"
                                : "bg-zinc-50 border-zinc-200 text-zinc-400"
                            }`}
                          >
                            {votedPlayer?.name || "Unknown"} {isCorrect && "✓"}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-10 shadow-[10px_10px_0_#18181b] md:shadow-[15px_15px_0_#18181b] border-4 border-zinc-900 space-y-8 text-left"
          >
            <div className="space-y-2">
              <div className="inline-block px-4 py-1 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
                Round Performance
              </div>
              <h3 className="text-4xl font-black uppercase italic text-zinc-900 leading-none tracking-tighter">
                Points Earned
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {votingSummary.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between items-center p-4 bg-zinc-50 rounded-2xl border-2 border-zinc-100 italic"
                >
                  <div className="flex flex-col">
                    <span className="font-black text-zinc-900 uppercase tracking-tighter">
                      {p.name} {p.isImposter && "🎭"}
                    </span>
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      {p.groupName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-2xl font-black ${p.pointsGained > 0 ? "text-emerald-500" : "text-zinc-300"}`}
                    >
                      +{p.pointsGained}
                    </span>
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                      pts
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Imposter Reveal Card */}
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-white rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-10 shadow-[10px_10px_0_#18181b] md:shadow-[15px_15px_0_#18181b] border-4 border-zinc-900 space-y-8 relative overflow-hidden flex flex-col justify-center"
          >
            <div className="space-y-2">
              <div className="inline-block px-4 py-1 bg-red-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
                The Secret Imposters
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {imposterPlayers.map((player) => (
                <div
                  key={player.id}
                  className="px-8 py-5 bg-zinc-900 text-white rounded-[2.5rem] font-black uppercase tracking-tighter text-xl shadow-lg flex items-center justify-center gap-3"
                >
                  <Users size={20} className="text-red-500" />
                  {player.name}
                </div>
              ))}
            </div>
            <div className="pt-6 border-t-4 border-zinc-50">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">
                Top Voted Players
              </p>
              <div className="space-y-2">
                {gameState.players.map((player) => {
                  const count = voteCounts[player.id] || 0;
                  if (count === 0) return null;

                  // Find who voted for this player
                  const votersForThisPlayer = gameState.players.filter(
                    (voter) => {
                      const votes = gameState.playerVotes[voter.id] || [];
                      return votes.includes(player.id);
                    },
                  );

                  return (
                    <div
                      key={player.id}
                      className="flex flex-col px-4 py-3 bg-zinc-50 rounded-xl border-2 border-zinc-100 space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-black uppercase italic text-zinc-600 text-xs">
                          {player.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-zinc-900">
                            {count}
                          </span>
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                            votes
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {votersForThisPlayer.map((voter) => (
                          <span
                            key={voter.id}
                            className="px-2 py-0.5 bg-zinc-200 rounded text-[9px] font-bold text-zinc-500 uppercase tracking-wider"
                          >
                            {voter.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Leaderboard Card */}
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="bg-white rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-10 shadow-[10px_10px_0_#18181b] md:shadow-[15px_15px_0_#18181b] border-4 border-zinc-900 space-y-8"
          >
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              <div className="p-2 sm:p-4 bg-amber-100 rounded-[1.2rem] sm:rounded-[2rem] border-2 border-amber-200 rotate-3">
                <Medal className="text-amber-500 w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h3 className="text-2xl sm:text-4xl font-black uppercase italic text-zinc-900 tracking-tighter">
                Leaderboard
              </h3>
            </div>
            <div className="space-y-3">
              {sortedGroups.map((group, index) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex justify-between items-center p-5 bg-zinc-50 rounded-[2rem] border-4 border-zinc-100 hover:border-zinc-900 transition-colors"
                >
                  <span className="font-black text-zinc-900 uppercase italic tracking-tighter text-xl truncate pr-4">
                    {group.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-3xl font-black text-zinc-900 italic">
                      {group.score}
                    </span>
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pt-1">
                      pts
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 pt-10"
        >
          <button
            onClick={playAgain}
            className="group py-6 md:py-8 bg-white text-zinc-900 rounded-[2.5rem] md:rounded-[3rem] border-4 border-zinc-900 font-black uppercase italic tracking-[0.2em] text-base md:text-xl hover:bg-zinc-50 transition-all flex items-center justify-center gap-4 shadow-[0_8px_0_#000] md:shadow-[0_12px_0_#000] active:shadow-none active:translate-y-3"
          >
            <RefreshCw
              size={24}
              className="group-hover:rotate-180 transition-transform duration-500"
            />
            Next Round
          </button>
          <button
            onClick={() =>
              setGameState((prev) => ({ ...prev, phase: "LEADERBOARD" }))
            }
            className="py-6 md:py-8 bg-amber-500 text-white rounded-[2.5rem] md:rounded-[3rem] font-black uppercase italic tracking-[0.2em] text-base md:text-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-4 shadow-[0_8px_0_#92400e] active:shadow-none active:translate-y-3"
          >
            <Trophy size={28} />
            All-Time
          </button>
          <button
            onClick={resetGame}
            className="py-6 md:py-8 bg-zinc-900 text-white rounded-[2.5rem] md:rounded-[3rem] font-black uppercase italic tracking-[0.2em] text-base md:text-xl hover:bg-red-500 transition-all flex items-center justify-center gap-4 shadow-[0_8px_0_#000] md:shadow-[0_12px_0_#000] active:shadow-none active:translate-y-3"
          >
            <X size={28} />
            New Lobby
          </button>
        </motion.div>
      </div>
    );
  };

  const renderMaintenance = () => {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-900 overflow-hidden relative">
        {/* Decorative background words */}
        <div className="absolute inset-0 z-0 opacity-[0.05] flex flex-wrap gap-10 p-10 select-none pointer-events-none transform -rotate-12 translate-x-[-10%] translate-y-[-10%] w-[120%] h-[120%]">
          {Array.from({ length: 40 }).map((_, i) => (
            <span
              key={i}
              className="text-8xl font-black italic uppercase text-white tracking-widest leading-none"
            >
              Offline System Failure Error Code 503 Critical
            </span>
          ))}
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="bg-white p-8 md:p-16 rounded-[3rem] md:rounded-[5rem] border-8 border-red-500 shadow-[20px_20px_0_#ef4444] max-w-2xl w-full text-center space-y-8 relative z-10"
        >
          <motion.div
            animate={{ rotate: [-5, 5, -5] }}
            transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            className="text-9xl mb-4"
          >
            🚧
          </motion.div>
          <div className="space-y-4 px-4">
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-black uppercase italic leading-[0.85] tracking-tighter text-zinc-900 border-b-4 sm:border-b-8 border-red-500 pb-4 inline-block">
              Neural Core <br /> Offline
            </h1>
            <p className="text-lg sm:text-2xl font-black text-zinc-900 italic uppercase tracking-tight">
              Stability Threshold Not Met
            </p>
            <p className="text-zinc-500 font-bold max-w-sm mx-auto leading-relaxed text-xs sm:text-sm">
              The game requires a secure link to the Gemini AI API. Your current
              connection or API key is not responding correctly.
            </p>
          </div>

          <div className="bg-red-50 border-2 border-red-100 p-6 rounded-[2rem] text-left space-y-2">
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle size={14} /> Diagnostic Logic
            </span>
            <p className="text-sm font-mono text-red-600 break-words leading-relaxed">
              {aiError ||
                "System Error: The AI core is not responding to health pings."}
            </p>
          </div>

          <div className="pt-4 space-y-4">
            <button
              onClick={() => {
                setAiStatus("CHECKING");
                checkAiHealth();
              }}
              className="w-full py-6 bg-zinc-900 text-white rounded-[2rem] font-black uppercase italic tracking-[0.2em] text-lg hover:bg-red-500 transition-all flex items-center justify-center gap-4 shadow-[0_8px_0_#000] active:shadow-none active:translate-y-2"
            >
              <RefreshCw
                size={24}
                className={aiStatus === "CHECKING" ? "animate-spin" : ""}
              />
              Retry Connection
            </button>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">
              Imposter Game v2.1 // System Status: Critical
            </p>
          </div>
        </motion.div>
      </div>
    );
  };

  // --- Render ---

  if (aiStatus === "CHECKING") {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center text-center p-6">
        <div className="space-y-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="text-8xl"
          >
            🌀
          </motion.div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black uppercase italic text-zinc-900 tracking-tighter">
              Booting Neural Core...
            </h2>
            <p className="text-zinc-400 font-black text-xs uppercase tracking-widest">
              Connecting to Gemini AI Gateway
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (aiStatus === "ERROR") {
    return renderMaintenance();
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-emerald-200">
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
        style={{
          backgroundImage: "radial-gradient(#000 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <main className="relative z-10 py-4 sm:py-8 md:py-12">
        <AnimatePresence mode="wait">
          {gameState.phase === "LOBBY" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {renderLobby()}
            </motion.div>
          )}
          {gameState.phase === "REMOTE_LOBBY" && (
            <motion.div
              key="remote-lobby"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              {renderRemoteLobby()}
            </motion.div>
          )}
          {gameState.phase === "REMOTE_JOIN" && (
            <motion.div
              key="remote-join"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
            >
              {renderRemoteJoin()}
            </motion.div>
          )}
          {gameState.phase === "REVEAL" && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
            >
              {renderReveal()}
            </motion.div>
          )}
          {gameState.phase === "CLUES" && (
            <motion.div
              key="clues"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {renderClues()}
            </motion.div>
          )}
          {gameState.phase === "VOTING" && (
            <motion.div
              key="voting"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {renderVoting()}
            </motion.div>
          )}
          {gameState.phase === "RESULT" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {renderResult()}
            </motion.div>
          )}
          {gameState.phase === "LEADERBOARD" && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {renderLeaderboard()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Watermark */}
      <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
        <div className="bg-zinc-900/90 backdrop-blur-sm text-zinc-300 px-4 py-2.5 rounded-2xl border-2 border-zinc-800 shadow-lg">
          <p className="text-[10px] sm:text-xs font-black select-none uppercase tracking-widest">
            Made by Brigada Developer
          </p>
        </div>
      </div>

      {/* Styled Kicked Message Overlay */}
      <AnimatePresence>
        {kickedMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest shadow-[0_10px_0_#991b1b] border-4 border-zinc-900 flex items-center gap-4"
          >
            <Trash2 size={24} /> {kickedMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e4e4e7;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d4d4d8;
        }
      `}</style>
    </div>
  );
}
