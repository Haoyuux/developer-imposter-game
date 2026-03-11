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
} from "lucide-react";

// --- Types ---

type GamePhase = "LOBBY" | "REVEAL" | "CLUES" | "VOTING" | "RESULT";

interface Player {
  id: string;
  name: string;
  isImposter?: boolean;
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
  playerVotes: Record<string, string[]>;
  currentVotingPlayerIndex: number;
  numImposters: number;
  discussionStarterId: string | null;
  imposterHintWord: string | null;
}

// --- Constants ---

const CATEGORIES = {
  "Everyday Objects": [
    "chair",
    "phone",
    "spoon",
    "table",
    "lamp",
    "clock",
    "mirror",
    "wallet",
  ],
  Foods: [
    "burger",
    "pizza",
    "rice",
    "noodles",
    "taco",
    "sushi",
    "bread",
    "salad",
  ],
  Drinks: [
    "coffee",
    "milk",
    "soda",
    "juice",
    "tea",
    "water",
    "smoothie",
    "wine",
  ],
  Sports: [
    "basketball",
    "soccer",
    "tennis",
    "boxing",
    "golf",
    "baseball",
    "swimming",
    "rugby",
  ],
  "Science & Tech": [
    "computer",
    "robot",
    "satellite",
    "microscope",
    "telescope",
    "battery",
    "internet",
    "laser",
  ],
  Animals: [
    "elephant",
    "penguin",
    "lion",
    "kangaroo",
    "dolphin",
    "giraffe",
    "monkey",
    "cheetah",
  ],
  Instruments: [
    "guitar",
    "piano",
    "violin",
    "drums",
    "flute",
    "trumpet",
    "saxophone",
    "cello",
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
  });

  const [newGroupName, setNewGroupName] = useState("");
  const [newPlayerNames, setNewPlayerNames] = useState<Record<number, string>>({
    0: "",
    1: "",
    2: "",
    3: "",
    4: "",
  });
  const [teamSize, setTeamSize] = useState(2);
  const [gameMode, setGameMode] = useState<"TEAM" | "SOLO">("TEAM");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    Object.keys(CATEGORIES),
  );
  const [showHelp, setShowHelp] = useState(false);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<
    { name: string; score: number }[]
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---

  useEffect(() => {
    fetchGlobalLeaderboard();
  }, []);

  const fetchGlobalLeaderboard = async () => {
    try {
      const res = await fetch("/api/leaderboard");
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

    let generatedWord = "";
    let hintWord = "";
    let assignedCategory =
      categoryNames[Math.floor(Math.random() * categoryNames.length)];

    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: [assignedCategory] }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.word) {
          generatedWord = data.word;
        }
        if (data.hint) {
          hintWord = data.hint;
        }
      }
    } catch (err) {
      console.error("AI word generation failed:", err);
    }

    // Fallback to local
    if (!generatedWord) {
      const words = CATEGORIES[assignedCategory as keyof typeof CATEGORIES];
      generatedWord = words[Math.floor(Math.random() * words.length)];
    }

    // Fallback hint — pick from same category but different word
    if (!hintWord) {
      const words = CATEGORIES[assignedCategory as keyof typeof CATEGORIES];
      const possibleHints = words.filter((w) => w !== generatedWord);
      if (possibleHints.length > 0) {
        hintWord =
          possibleHints[Math.floor(Math.random() * possibleHints.length)];
      }
    }

    setIsGenerating(false);

    // Pick random player to start
    const starterId =
      shuffledPlayers[Math.floor(Math.random() * shuffledPlayers.length)].id;

    setGameState((prev) => ({
      ...prev,
      players: shuffledPlayers,
      groups: prev.groups, // Keep groups as is
      category: assignedCategory,
      secretWord: generatedWord,
      phase: "REVEAL",
      currentRevealIndex: 0,
      isWordVisible: false,
      playerVotes: {},
      currentVotingPlayerIndex: 0,
      discussionStarterId: starterId,
      imposterHintWord: hintWord || "Unknown",
    }));
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

  // --- Sub-renderers ---

  const renderLobby = () => (
    <div className="max-w-md mx-auto px-4 py-4 sm:p-6 space-y-6 sm:space-y-8">
      <div className="text-center space-y-4 relative">
        <motion.div
          initial={{ rotate: -5, scale: 0.9 }}
          animate={{ rotate: 0, scale: 1 }}
          className="inline-block px-4 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-2 shadow-[4px_4px_0_#064e3b]"
        >
          Party Game
        </motion.div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter text-zinc-900 uppercase italic leading-[0.9]">
          Developers <br />
          <span className="text-emerald-500">Imposter Game</span>
        </h1>
        <p className="text-zinc-500 font-bold text-xs md:text-sm">
          A game of deception and groups.
        </p>

        <div className="absolute -top-2 -right-2 flex gap-1">
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

      <div className="bg-white rounded-[2.5rem] p-8 shadow-[12px_12px_0_#18181b] border-4 border-zinc-900 space-y-6">
        <div className="flex bg-zinc-100 p-1 rounded-2xl mb-6 border-4 border-zinc-100 overflow-hidden">
          <button
            onClick={() => setGameMode("TEAM")}
            className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-xl transition-all ${gameMode === "TEAM" ? "bg-white text-zinc-900 shadow-sm border-2 border-zinc-200" : "text-zinc-400 hover:text-zinc-600 border-2 border-transparent"}`}
          >
            Team Mode
          </button>
          <button
            onClick={() => setGameMode("SOLO")}
            className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-xl transition-all ${gameMode === "SOLO" ? "bg-white text-zinc-900 shadow-sm border-2 border-zinc-200" : "text-zinc-400 hover:text-zinc-600 border-2 border-transparent"}`}
          >
            Solo Mode
          </button>
        </div>

        <form onSubmit={addGroup} className="space-y-4">
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

                <div className="grid grid-cols-2 gap-3">
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
            onClick={addGroup}
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
        </form>

        <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar pt-6 border-t-4 border-zinc-50">
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
          <div className="grid grid-cols-2 gap-2">
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

        <button
          disabled={
            gameState.groups.length < 2 ||
            gameState.players.length <= gameState.numImposters ||
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
            : gameState.groups.length > 0 &&
                gameState.players.length <= gameState.numImposters
              ? "Not enough players"
              : "Launch Game"}
        </button>
      </div>

      {globalLeaderboard.length > 0 && (
        <div className="bg-white rounded-[2.5rem] p-8 shadow-[12px_12px_0_#18181b] border-4 border-zinc-900 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={20} className="text-amber-500" />
              <h2 className="text-xl font-black uppercase italic tracking-tight">
                All-Time Legends
              </h2>
            </div>
            <button
              onClick={fetchGlobalLeaderboard}
              className="p-2 text-zinc-400 hover:text-emerald-500 transition-colors"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {globalLeaderboard.map((entry, i) => (
              <div
                key={i}
                className="flex justify-between items-center p-3 bg-zinc-50 rounded-xl border-2 border-zinc-100"
              >
                <span className="font-bold text-zinc-600 truncate max-w-[150px]">
                  {entry.name}
                </span>
                <span className="font-black text-zinc-900">
                  {entry.score} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                          Blending Tip 🎭
                        </p>
                        <p className="text-zinc-700 font-bold text-xs">
                          Think of words like{" "}
                          <span className="text-red-500 font-black">
                            "{gameState.imposterHintWord}"
                          </span>{" "}
                          to blend in.
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
      </div>
    );
  };

  const renderClues = () => (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6 space-y-8 sm:space-y-12 min-h-screen flex flex-col justify-center">
      <div className="text-center space-y-6">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-block px-6 py-2 bg-zinc-900 text-white rounded-full text-xs font-black uppercase tracking-[0.3em] shadow-[8px_8px_0_#10b981]"
        >
          Discussion Phase
        </motion.div>
        <div className="space-y-2">
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-black text-zinc-900 uppercase italic tracking-tighter leading-none">
            Speak Your <span className="text-emerald-500">Truth</span>
          </h2>
          <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">
            Round {gameState.groups.length} • {gameState.players.length} Players
          </p>
        </div>
        <div className="space-y-4">
          <p className="text-zinc-500 font-bold max-w-md mx-auto text-sm sm:text-lg">
            Each player gives one short clue about the secret word. Don't be too
            obvious!
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {gameState.groups.map((group, index) => (
          <motion.div
            key={group.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-[2rem] md:rounded-[3rem] p-6 md:p-8 shadow-[10px_10px_0_#18181b] md:shadow-[15px_15px_0_#18181b] border-4 border-zinc-900 space-y-8 relative overflow-hidden group hover:-translate-y-2 hover:shadow-[15px_15px_0_#18181b] md:hover:shadow-[20px_20px_0_#18181b] transition-all"
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
          onClick={() => setGameState((prev) => ({ ...prev, phase: "VOTING" }))}
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

  const renderVoting = () => {
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
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-32 sm:p-6 space-y-8 sm:space-y-12 min-h-screen flex flex-col justify-center">
        <div className="text-center space-y-8 sm:space-y-12">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-block px-6 py-2 bg-red-500 text-white rounded-full text-xs font-black uppercase tracking-[0.3em] shadow-[8px_8px_0_#000]"
          >
            Voting Phase • {gameState.currentVotingPlayerIndex + 1}/
            {gameState.players.length}
          </motion.div>
          <div className="space-y-4 sm:space-y-6">
            <h2 className="text-3xl sm:text-5xl md:text-7xl font-black text-zinc-900 uppercase italic tracking-tighter leading-normal sm:leading-none">
              <span className="text-red-500 underline decoration-4 sm:decoration-8 underline-offset-[4px] sm:underline-offset-8">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className={`w-full p-6 rounded-[2.5rem] border-4 transition-all text-left flex justify-between items-center group relative overflow-hidden ${
                    isSelected
                      ? "bg-zinc-900 border-zinc-900 text-white scale-[1.02] shadow-[12px_12px_0_#ef4444]"
                      : "bg-white border-zinc-100 text-zinc-900 hover:border-zinc-900 hover:shadow-[10px_10px_0_#18181b]"
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
            disabled={currentPlayerVotes.length < gameState.numImposters}
            onClick={handleConfirmVote}
            className="w-full py-4 sm:py-6 md:py-8 bg-red-500 text-white rounded-[2rem] md:rounded-[3rem] font-black text-xl sm:text-2xl md:text-3xl shadow-[0_6px_0_#991b1b] sm:shadow-[0_10px_0_#991b1b] md:shadow-[0_15px_0_#991b1b] active:shadow-none active:translate-y-3 transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-4 uppercase italic tracking-[0.1em]"
          >
            {isLastPlayer ? "Reveal Truth" : "Confirm Vote"}{" "}
            <ChevronRight size={32} />
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

    // Also update backend for top groups
    updatedGroups.forEach(async (group) => {
      const roundScore = groupPoints[group.id] || 0;
      if (roundScore > 0) {
        try {
          await fetch("/api/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: group.name, score: roundScore }),
          });
        } catch (err) {
          console.error("Failed to update score:", err);
        }
      }
    });

    setGameState((prev) => ({
      ...prev,
      groups: updatedGroups,
      phase: "RESULT",
    }));
  };

  const renderResult = () => {
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
      <div className="max-w-6xl mx-auto px-4 py-6 sm:p-6 space-y-8 sm:space-y-12 text-center pb-16 sm:pb-32 min-h-screen flex flex-col justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className={`p-6 sm:p-8 md:p-16 rounded-[2rem] sm:rounded-[3rem] md:rounded-[5rem] border-4 sm:border-8 shadow-[8px_8px_0_#18181b] sm:shadow-[15px_15px_0_#18181b] md:shadow-[25px_25px_0_#18181b] ${isCorrect ? "bg-emerald-50 border-emerald-500" : "bg-red-50 border-red-500"} space-y-4 sm:space-y-8 relative overflow-hidden`}
        >
          <motion.div
            animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="text-7xl md:text-9xl mb-4 md:mb-6 mt-4 md:mt-0 relative z-10"
          >
            {isCorrect ? "🏆" : "🎭"}
          </motion.div>
          <div className="space-y-4 relative z-10">
            <h2
              className={`text-3xl sm:text-5xl md:text-7xl font-black uppercase italic leading-none tracking-tighter ${isCorrect ? "text-emerald-600" : "text-red-600"}`}
            >
              {isCorrect ? "Imposters Caught!" : "Imposters Won!"}
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
            <div className="space-y-4">
              {sortedGroups.map((group, index) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center justify-between p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border-4 transition-all ${
                    index === 0
                      ? "bg-amber-50 border-amber-400 scale-[1.02] sm:scale-[1.05] shadow-xl"
                      : "bg-zinc-50 border-zinc-100"
                  }`}
                >
                  <div className="flex items-center gap-5">
                    <span
                      className={`w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center rounded-[0.8rem] sm:rounded-[1.2rem] font-black text-sm sm:text-xl italic shrink-0 ${
                        index === 0
                          ? "bg-amber-400 text-white shadow-lg"
                          : "bg-zinc-200 text-zinc-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="text-left space-y-0.5 sm:space-y-1 min-w-0">
                      <p className="text-sm sm:text-xl font-black uppercase italic text-zinc-900 leading-none tracking-tighter truncate">
                        {group.name}
                      </p>
                      <p className="text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate">
                        {group.playerIds
                          .map(
                            (pid) =>
                              gameState.players.find((p) => p.id === pid)?.name,
                          )
                          .join(" & ")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-2">
                    <span className="text-2xl sm:text-4xl font-black text-zinc-900 italic leading-none">
                      {group.score}
                    </span>
                    <span className="text-[8px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest">
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
          className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10"
        >
          <button
            onClick={playAgain}
            className="group py-6 md:py-8 bg-white text-zinc-900 rounded-[2.5rem] md:rounded-[3rem] border-4 border-zinc-900 font-black uppercase italic tracking-[0.2em] text-lg md:text-xl hover:bg-zinc-50 transition-all flex items-center justify-center gap-4 shadow-[0_8px_0_#000] md:shadow-[0_12px_0_#000] active:shadow-none active:translate-y-3"
          >
            <RefreshCw
              size={24}
              className="group-hover:rotate-180 transition-transform duration-500"
            />
            Next Round
          </button>
          <button
            onClick={resetGame}
            className="py-6 md:py-8 bg-zinc-900 text-white rounded-[2.5rem] md:rounded-[3rem] font-black uppercase italic tracking-[0.2em] text-lg md:text-xl hover:bg-red-500 transition-all flex items-center justify-center gap-4 shadow-[0_8px_0_#000] md:shadow-[0_12px_0_#000] active:shadow-none active:translate-y-3"
          >
            <X size={28} />
            New Lobby
          </button>
        </motion.div>
      </div>
    );
  };

  // --- Render ---

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
