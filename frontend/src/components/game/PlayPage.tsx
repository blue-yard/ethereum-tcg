import React, { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useGameEngine } from '@/lib/hooks/useGameEngine';
import { useDeckRegistry } from '@/lib/hooks/useDeckRegistry';
import { X, Plus, Users, Clock, Loader2 } from 'lucide-react';
import { GameLobby } from './GameLobby';
import { DeckImage } from '@/components/ui/DeckImage';

interface PlayPageProps {
  onClose?: () => void;
  onGameStart?: (gameId: number) => void;
  initialView?: 'menu' | 'create' | 'join' | 'lobby';
}

interface GameInfo {
  gameId: number;
  creator: string;
  player2: string;
  status: 'waiting' | 'ready' | 'started';
  createdAt: number;
  deckIds: { player1: number; player2: number };
}

export const PlayPage: React.FC<PlayPageProps> = ({ 
  onClose = () => window.location.hash = '#/', 
  onGameStart = (gameId) => window.location.hash = `#/game/${gameId}`,
  initialView = 'menu' 
}) => {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  // Get the Privy embedded wallet address
  const privyWallet = wallets.find(w => w.walletClientType === 'privy');
  const address = privyWallet?.address;
  const hasStartedGame = React.useRef(false);
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
  
  const [view, setView] = useState<'menu' | 'create' | 'join' | 'lobby'>(initialView);
  const [availableGames, setAvailableGames] = useState<GameInfo[]>([]);
  const [currentGameId, setCurrentGameId] = useState<number | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<number>(0); // Deck IDs start at 0
  const [loadingGames, setLoadingGames] = useState(false);
  const [gameState, setGameState] = useState<any>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [isStartingGameLocal, setIsStartingGameLocal] = useState(false);


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


  const loadAvailableGames = async () => {
    setLoadingGames(true);
    try {
      // Get games from the blockchain
      const games = await getActiveGames(30);
      console.log('Loaded games from blockchain:', games);
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
      console.log('Creating game with deck:', selectedDeckId);
      console.log('Current wallet address:', address);
      const gameId = await createGame(selectedDeckId);
      console.log('Created game with ID:', gameId);
      
      if (gameId !== undefined && gameId !== null) {
        // Redirect to lobby
        window.location.hash = `#/lobby/${gameId}`;
      }
    } catch (error) {
      console.error('Error creating game:', error);
      
      const errorMessage = error?.message || error?.toString() || ''
      const isInsufficientFunds = errorMessage.toLowerCase().includes('insufficient') || 
                                 errorMessage.toLowerCase().includes('funds')
      
      if (isInsufficientFunds) {
        // Don't show alert for funding issues - the funding flow will handle it
        console.log('Game creation failed due to insufficient funds - funding flow should handle this')
      } else {
        alert('Failed to create game. Please try again.');
      }
    }
  };

  const handleJoinGame = async (gameId: number) => {
    try {
      console.log('Joining game:', gameId, 'with deck:', selectedDeckId);
      console.log('Current wallet address:', address);
      await joinGame(gameId, selectedDeckId);
      
      // Wait a bit for the transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redirect to lobby
      window.location.hash = `#/lobby/${gameId}`;
    } catch (error) {
      console.error('Error joining game:', error);
      alert('Failed to join game. Please try again.');
    }
  };

  const handleStartGame = async () => {
    if (currentGameId === null) return;
    
    try {
      setIsStartingGameLocal(true);
      const result = await startGame(currentGameId);
      console.log('Game started successfully:', result);
      
      // Navigate to the game page after successful start with a flag
      window.location.hash = `#/game/${currentGameId}?started=true`;
    } catch (error) {
      console.error('Error starting game:', error);
      alert('Failed to start game. Make sure both players have joined.');
      setIsStartingGameLocal(false);
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    return `${minutes} minutes ago`;
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-gray-900 rounded-lg flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              {view === 'menu' && '🎮 Play Onchain'}
              {view === 'create' && '🎯 Create Game'}
              {view === 'join' && '🤝 Join Game'}
              {view === 'lobby' && '⏳ Game Lobby'}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-hidden">
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
            <div className="flex flex-col h-full space-y-6 max-h-[calc(90vh-12rem)]">
              <div className="flex-1 min-h-0">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto custom-scrollbar pr-2">
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
                        {/* Deck Image */}
                        <div className="mb-3">
                          <DeckImage 
                            deckName={deck.name}
                            className="w-full h-20 rounded object-cover"
                            fallbackIcon="🃏"
                          />
                        </div>
                        
                        <div className="font-semibold text-white">{deck.name}</div>
                        <div className="text-sm text-gray-400 mt-1">{deck.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between flex-shrink-0">
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
            <div className="flex flex-col h-full space-y-4 max-h-[calc(90vh-12rem)]">
              {/* Deck Selection - Scrollable */}
              <div className="flex-shrink-0">
                <h4 className="text-lg font-semibold text-white mb-3">Select Your Deck</h4>
                {availableDecks.length === 0 ? (
                  <div className="text-gray-400 text-sm">Loading decks...</div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
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
                        {/* Deck Image */}
                        <div className="mb-2">
                          <DeckImage 
                            deckName={deck.name}
                            className="w-full h-16 rounded object-cover"
                            fallbackIcon="🃏"
                          />
                        </div>
                        
                        <div className="font-semibold text-white text-sm">{deck.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{deck.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Games List - Scrollable */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
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
                  <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1">
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
                            disabled={isJoiningGame || availableDecks.length === 0}
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
              isHost={
                address && gameState && (
                  address.toLowerCase() === gameState?.player1?.toLowerCase() || 
                  address.toLowerCase() === gameState?.creator?.toLowerCase()
                )
              }
              isStartingGame={isStartingGame}
            />
          )}
        </div>
      </div>
    </div>
  );
};