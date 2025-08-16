import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useGameEngine } from '@/lib/hooks/useGameEngine';
import { useDeckRegistry } from '@/lib/hooks/useDeckRegistry';
import { X, Plus, Users, Clock, Loader2 } from 'lucide-react';
import { GameLobby } from './GameLobby';

interface PlayPageProps {
  onClose: () => void;
  onGameStart: (gameId: number) => void;
}

interface GameInfo {
  gameId: number;
  creator: string;
  player2: string;
  status: 'waiting' | 'ready' | 'started';
  createdAt: number;
  deckIds: { player1: number; player2: number };
}

export const PlayPage: React.FC<PlayPageProps> = ({ onClose, onGameStart }) => {
  const { address } = useAccount();
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const { 
    createGame, 
    joinGame, 
    startGame,
    getActiveGames,
    getGameState,
    isCreatingGame,
    isJoiningGame,
    isStartingGame 
  } = useGameEngine();
  const { decks, deckCount, isLoadingDecks } = useDeckRegistry();
  
  const [view, setView] = useState<'menu' | 'create' | 'join' | 'lobby'>('menu');
  const [availableGames, setAvailableGames] = useState<GameInfo[]>([]);
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<number>(0); // Deck IDs start at 0
  const [loadingGames, setLoadingGames] = useState(false);
  const [gameState, setGameState] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Format decks for display (deck IDs start at 0)
  const availableDecks = React.useMemo(() => {
    console.log('Raw decks data:', decks);
    console.log('Deck count:', deckCount);
    console.log('Loading decks:', isLoadingDecks);
    
    if (decks && decks.length > 0) {
      return decks.map((deck: any, index: number) => ({
        id: deck.id !== undefined ? deck.id : index, // Use 0-based index
        name: deck.name || `Deck ${index}`,
        description: deck.description || 'No description available'
      }));
    }
    // Return empty array if no decks loaded
    return [];
  }, [decks, deckCount, isLoadingDecks]);

  // Load available games when joining
  useEffect(() => {
    if (view === 'join') {
      loadAvailableGames();
    }
  }, [view]);

  // Poll for game state updates when in lobby
  useEffect(() => {
    if (view === 'lobby' && currentGameId !== null) {
      // Poll every 2 seconds for game state updates
      const interval = setInterval(async () => {
        const state = await getGameState(currentGameId);
        setGameState(state);
        
        // Check if game has started
        if (state?.status === 'started') {
          clearInterval(interval);
          onGameStart(currentGameId);
        }
      }, 2000);
      
      setPollingInterval(interval);
      
      // Initial fetch
      getGameState(currentGameId).then(setGameState);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [view, currentGameId, getGameState, onGameStart]);

  const loadAvailableGames = async () => {
    setLoadingGames(true);
    try {
      // Get games from the blockchain
      const games = await getActiveGames(30);
      setAvailableGames(games || []);
    } catch (error) {
      console.error('Error loading games:', error);
      setAvailableGames([]);
    } finally {
      setLoadingGames(false);
    }
  };

  const handleCreateGame = async () => {
    try {
      const gameId = await createGame(selectedDeckId);
      if (gameId) {
        setCurrentGameId(gameId);
        setView('lobby');
      }
    } catch (error) {
      console.error('Error creating game:', error);
      alert('Failed to create game. Please try again.');
    }
  };

  const handleJoinGame = async (gameId: number) => {
    try {
      await joinGame(gameId, selectedDeckId);
      setCurrentGameId(gameId);
      setView('lobby');
    } catch (error) {
      console.error('Error joining game:', error);
      alert('Failed to join game. Please try again.');
    }
  };

  const handleStartGame = async () => {
    if (currentGameId === null) return;
    
    try {
      await startGame(currentGameId);
      // The polling interval will detect when game starts and call onGameStart
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Failed to start game. Make sure both players have joined.');
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    return `${minutes} minutes ago`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-gray-900 rounded-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              {view === 'menu' && '🎮 Play Onchain'}
              {view === 'create' && '🎯 Create Game'}
              {view === 'join' && '🤝 Join Game'}
              {view === 'lobby' && '⏳ Game Lobby'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {view === 'menu' && (
            <div className="space-y-4">
              {/* Wallet Status */}
              {wallets.length === 0 && (
                <div className="p-4 bg-yellow-900/20 border border-yellow-600 rounded-lg">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ No wallet detected. Please create a wallet using the Privy debug panel (bottom left) before playing.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Create Game Option */}
                <button
                  onClick={() => setView('create')}
                  disabled={wallets.length === 0}
                  className={`group p-6 bg-gray-800 rounded-lg border-2 transition-all ${
                    wallets.length === 0 
                      ? 'border-gray-800 opacity-50 cursor-not-allowed' 
                      : 'border-gray-700 hover:border-cyan-500'
                  }`}
                >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-cyan-600/20 rounded-full group-hover:bg-cyan-600/30 transition-colors">
                    <Plus className="w-12 h-12 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Create Game</h3>
                    <p className="text-gray-400 text-sm">
                      Start a new game and wait for an opponent to join
                    </p>
                  </div>
                </div>
              </button>

                {/* Join Game Option */}
                <button
                  onClick={() => setView('join')}
                  disabled={wallets.length === 0}
                  className={`group p-6 bg-gray-800 rounded-lg border-2 transition-all ${
                    wallets.length === 0 
                      ? 'border-gray-800 opacity-50 cursor-not-allowed' 
                      : 'border-gray-700 hover:border-purple-500'
                  }`}
                >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-purple-600/20 rounded-full group-hover:bg-purple-600/30 transition-colors">
                    <Users className="w-12 h-12 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Join Game</h3>
                    <p className="text-gray-400 text-sm">
                      Browse and join an existing game waiting for players
                    </p>
                  </div>
                </div>
              </button>
              </div>
            </div>
          )}

          {view === 'create' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Select Your Deck</h3>
                {isLoadingDecks ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  </div>
                ) : availableDecks.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No decks available. Please deploy decks to the contract first.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableDecks.map(deck => (
                      <div
                        key={deck.id}
                        onClick={() => setSelectedDeckId(deck.id)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedDeckId === deck.id
                            ? 'bg-cyan-900/30 border-cyan-500'
                            : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="font-semibold text-white">{deck.name}</div>
                        <div className="text-sm text-gray-400 mt-1">{deck.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setView('menu')}
                  className="btn-secondary"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateGame}
                  disabled={isCreatingGame || availableDecks.length === 0}
                  className="btn-primary flex items-center gap-2"
                >
                  {isCreatingGame && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Game
                </button>
              </div>
            </div>
          )}

          {view === 'join' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Available Games</h3>
                  <button
                    onClick={loadAvailableGames}
                    className="text-cyan-400 hover:text-cyan-300 text-sm"
                  >
                    Refresh
                  </button>
                </div>

                {loadingGames ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  </div>
                ) : availableGames.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    No games available. Try creating one!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableGames.filter(g => g.status === 'waiting').map(game => (
                      <div
                        key={game.gameId}
                        className="p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-cyan-500 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-white font-semibold">
                              Game #{game.gameId}
                            </div>
                            <div className="text-sm text-gray-400 mt-1">
                              Created by {game.creator}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <span className="text-xs text-gray-500">
                                {formatTimeAgo(game.createdAt)}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleJoinGame(game.gameId)}
                            disabled={isJoiningGame}
                            className="btn-primary text-sm px-4 py-2"
                          >
                            {isJoiningGame ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Join'
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Deck Selection for Joining */}
                {availableGames.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-white mb-2">Your Deck</h4>
                    <select
                      value={selectedDeckId}
                      onChange={(e) => setSelectedDeckId(Number(e.target.value))}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                    >
                      {availableDecks.map(deck => (
                        <option key={deck.id} value={deck.id}>
                          {deck.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setView('menu')}
                  className="btn-secondary"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {view === 'lobby' && currentGameId !== null && (
            <GameLobby
              gameId={currentGameId}
              gameState={gameState}
              availableDecks={availableDecks}
              onStartGame={handleStartGame}
              onBack={() => {
                if (pollingInterval) clearInterval(pollingInterval);
                setView('menu');
                setCurrentGameId(null);
              }}
              isHost={gameState?.creator === address}
              isStartingGame={isStartingGame}
            />
          )}
        </div>
      </div>
    </div>
  );
};