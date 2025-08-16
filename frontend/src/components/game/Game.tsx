import { useState, useEffect } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useGameStore, type Card } from '@/stores/gameStore'
import { PlayerStats } from './PlayerStats'
import { DragDropGameBoard } from './DragDropGameBoard'
import { Web3Actions } from './Web3Actions'
import { DeckBuilder } from './DeckBuilder'
import { CardsPage } from './CardsPage'
import { DecksPage } from './DecksPage'
import { PlayPage } from './PlayPage'
import { ContractDebugPanel } from '@/components/debug/ContractDebugPanel'
import { PrivyDebugInfo } from '@/components/debug/PrivyDebugInfo'
import { useSearchParams } from 'react-router-dom'
import { useGameEngine } from '@/lib/hooks/useGameEngine'
import { watchContractEvent } from 'wagmi/actions'
import { wagmiConfig } from '@/lib/web3/wagmiConfig'
import { CONTRACT_ADDRESSES } from '@/lib/web3/config'
import { GameEngineABI } from '@/lib/contracts/GameEngineABI'

export function Game() {
  const { logout, user } = usePrivy()
  const { wallets } = useWallets()
  const [searchParams] = useSearchParams()
  const { 
    startGame,
    resetGame, 
    isGameActive, 
    activePlayer,
    winner,
    setContractFunctions,
    setContractGameId,
    gameId,
    updateGameFromContract,
    initializeGameFromContract,
    needsToDraw,
  } = useGameStore()
  
  // Get contract functions
  const { endTurn, playCard, stakeETH, getDetailedGameState, getFullGameState, drawToStartTurn } = useGameEngine()
  
  const [showWeb3Panel, setShowWeb3Panel] = useState(false)
  const [showDeckBuilder, setShowDeckBuilder] = useState(false)
  const [showCardsPage, setShowCardsPage] = useState(false)
  const [showDecksPage, setShowDecksPage] = useState(false)
  const [showPlayPage, setShowPlayPage] = useState(false)
  const [currentGameId, setCurrentGameId] = useState<number | null>(null)
  const [customDeck, setCustomDeck] = useState<Card[] | null>(null)
  
  // Set up contract functions in game store
  useEffect(() => {
    setContractFunctions({
      endTurn,
      playCard,
      stakeETH,
      getDetailedGameState,
      getFullGameState,
      drawToStartTurn
    })
  }, [endTurn, playCard, stakeETH, getDetailedGameState, setContractFunctions, drawToStartTurn, getFullGameState])

  // Set up event listeners for the current game
  useEffect(() => {
    if (!gameId) return

    console.log('Setting up event listeners for game', gameId)

    // Listen for game events that affect the current game
    const unsubscribeEvents = [
      // Turn events
      watchContractEvent(wagmiConfig, {
        address: CONTRACT_ADDRESSES.GAME_ENGINE,
        abi: GameEngineABI,
        eventName: 'TurnStarted',
        args: { gameId: BigInt(gameId) },
        onLogs: (logs) => {
          console.log('TurnStarted event:', logs)
          // Refresh game state
          setTimeout(() => {
            if (getDetailedGameState) {
              getDetailedGameState(gameId).then(state => {
                if (state) updateGameFromContract(state)
              })
            }
          }, 1000)
        }
      }),

      watchContractEvent(wagmiConfig, {
        address: CONTRACT_ADDRESSES.GAME_ENGINE,
        abi: GameEngineABI,
        eventName: 'TurnEnded',
        args: { gameId: BigInt(gameId) },
        onLogs: (logs) => {
          console.log('TurnEnded event:', logs)
          // Refresh game state
          setTimeout(() => {
            if (getDetailedGameState) {
              getDetailedGameState(gameId).then(state => {
                if (state) updateGameFromContract(state)
              })
            }
          }, 1000)
        }
      }),

      // Card events
      watchContractEvent(wagmiConfig, {
        address: CONTRACT_ADDRESSES.GAME_ENGINE,
        abi: GameEngineABI,
        eventName: 'CardPlayed',
        args: { gameId: BigInt(gameId) },
        onLogs: (logs) => {
          console.log('CardPlayed event:', logs)
          // Refresh game state
          setTimeout(() => {
            if (getDetailedGameState) {
              getDetailedGameState(gameId).then(state => {
                if (state) updateGameFromContract(state)
              })
            }
          }, 1000)
        }
      }),

      // Resource events
      watchContractEvent(wagmiConfig, {
        address: CONTRACT_ADDRESSES.GAME_ENGINE,
        abi: GameEngineABI,
        eventName: 'ResourcesGained',
        args: { gameId: BigInt(gameId) },
        onLogs: (logs) => {
          console.log('ResourcesGained event:', logs)
          // Refresh game state
          setTimeout(() => {
            if (getDetailedGameState) {
              getDetailedGameState(gameId).then(state => {
                if (state) updateGameFromContract(state)
              })
            }
          }, 1000)
        }
      }),

      // Ability events
      watchContractEvent(wagmiConfig, {
        address: CONTRACT_ADDRESSES.GAME_ENGINE,
        abi: GameEngineABI,
        eventName: 'UpkeepTriggered',
        args: { gameId: BigInt(gameId) },
        onLogs: (logs) => {
          console.log('UpkeepTriggered event (ability processed):', logs)
          // Refresh game state to get updated resources
          setTimeout(() => {
            if (getDetailedGameState) {
              getDetailedGameState(gameId).then(state => {
                if (state) updateGameFromContract(state)
              })
            }
          }, 1000)
        }
      }),

      // Card draw events
      watchContractEvent(wagmiConfig, {
        address: CONTRACT_ADDRESSES.GAME_ENGINE,
        abi: GameEngineABI,
        eventName: 'CardDrawn',
        args: { gameId: BigInt(gameId) },
        onLogs: (logs) => {
          console.log('CardDrawn event (ability effect):', logs)
          // Refresh game state to get updated hand
          setTimeout(() => {
            if (getDetailedGameState) {
              getDetailedGameState(gameId).then(state => {
                if (state) updateGameFromContract(state)
              })
            }
          }, 1000)
        }
      })
    ]

    // Cleanup function
    return () => {
      console.log('Cleaning up event listeners for game', gameId)
      unsubscribeEvents.forEach(unsubscribe => unsubscribe())
    }
  }, [gameId, getDetailedGameState, updateGameFromContract])

  const handleStartGame = () => {
    startGame(user?.id || 'player1', 'player2')
  }

  const handleStartWithCustomDeck = () => {
    setShowDeckBuilder(true)
  }

  const handleDeckReady = (deck: Card[]) => {
    setCustomDeck(deck)
    setShowDeckBuilder(false)
    // Here you would modify the game store to use the custom deck
    startGame(user?.id || 'player1', 'player2')
  }

  const handleEndTurn = () => {
    // End turn using contract
    useGameStore.getState().endTurn()
  }

  const handleDrawToStartTurn = async () => {
    try {
      await drawToStartTurn(gameId!)
      console.log('Draw to start turn completed')
    } catch (error) {
      console.error('Failed to draw to start turn:', error)
    }
  }

  const handleGetGameState = async () => {
    console.log('=== CURRENT GAME STATE DEBUG ===')
    const state = useGameStore.getState()
    console.log('Game Store State:', {
      gameId: state.gameId,
      currentTurn: state.currentTurn,
      turnNumber: state.turnNumber,
      activePlayer: state.activePlayer,
      isGameActive: state.isGameActive,
      isGameStarted: state.isGameStarted,
      players: {
        player1: {
          id: state.players.player1.id,
          balance: state.players.player1.balance,
          eth: state.players.player1.eth,
          coldStorage: state.players.player1.coldStorage,
          handSize: state.players.player1.hand.length,
          boardSize: state.players.player1.board.length,
          deckSize: state.players.player1.deck.length,
          deckRemaining: state.players.player1.deckRemaining,
          battlefieldSize: state.players.player1.battlefieldSize,
          hand: state.players.player1.hand.map(card => ({ id: card.id, name: card.name, cost: card.cost, type: card.type })),
          board: state.players.player1.board.map(card => ({ id: card.id, name: card.name, cost: card.cost, type: card.type })),
          deck: state.players.player1.deck.slice(0, 5).map(card => ({ id: card.id, name: card.name, cost: card.cost, type: card.type })) // Show first 5 deck cards
        },
        player2: {
          id: state.players.player2.id,
          balance: state.players.player2.balance,
          eth: state.players.player2.eth,
          coldStorage: state.players.player2.coldStorage,
          handSize: state.players.player2.hand.length,
          boardSize: state.players.player2.board.length,
          deckSize: state.players.player2.deck.length,
          deckRemaining: state.players.player2.deckRemaining,
          battlefieldSize: state.players.player2.battlefieldSize,
          hand: state.players.player2.hand.map(card => ({ id: card.id, name: card.name, cost: card.cost, type: card.type })),
          board: state.players.player2.board.map(card => ({ id: card.id, name: card.name, cost: card.cost, type: card.type })),
          deck: state.players.player2.deck.slice(0, 5).map(card => ({ id: card.id, name: card.name, cost: card.cost, type: card.type })) // Show first 5 deck cards
        }
      }
    })
    
    if (gameId && getFullGameState) {
      try {
        console.log('=== FETCHING COMPREHENSIVE CONTRACT STATE ===')
        await getFullGameState(gameId)
      } catch (error) {
        console.error('Error fetching comprehensive contract state:', error)
      }
    } else {
      console.log('No gameId or getFullGameState function available')
      console.log('Available functions:', { getDetailedGameState: !!getDetailedGameState, getFullGameState: !!getFullGameState })
    }
    console.log('=== END GAME STATE DEBUG ===')
  }

  const handleLogout = () => {
    resetGame()
    logout()
  }

  const handleOnchainGameStart = async (gameId: number) => {
    setCurrentGameId(gameId)
    setShowPlayPage(false)
    setContractGameId(gameId)
    
    // Update URL to keep the gameId
    const url = new URL(window.location.href)
    url.searchParams.set('gameId', gameId.toString())
    url.searchParams.delete('view') // Remove view param since we're in the game now
    window.history.pushState({}, '', url.toString())
    
    // Get the current user's wallet address
    const privyWallet = wallets.find(w => w.walletClientType === 'privy')
    const userAddress = privyWallet?.address
    
    // Load the game state from the blockchain
    if (getDetailedGameState && getFullGameState) {
      try {
        const gameStateView = await getDetailedGameState(gameId)
        if (gameStateView) {
          console.log('Game started, loading state from contract:', gameStateView)
          updateGameFromContract(gameStateView)
          
          // Set player IDs from the contract addresses
          const player1Address = gameStateView.player1
          const player2Address = gameStateView.player2
          
          // Start the game with actual player addresses
          startGame(player1Address, player2Address)
          
          // Set the viewing player based on which player the current user is
          if (userAddress) {
            if (userAddress.toLowerCase() === player1Address.toLowerCase()) {
              // Current user is player1
              // viewingPlayer should already be set to 'player1' by startGame
            } else if (userAddress.toLowerCase() === player2Address.toLowerCase()) {
              // Current user is player2 - viewing will be handled by DragDropGameBoard
            }
          }
          
          // Load full game state including hands and battlefield
          console.log('Loading full game state including hands and battlefield...')
          await getFullGameState(gameId)
        }
      } catch (error) {
        console.error('Error loading game state:', error)
      }
    }
  }

  // Track if we've already processed the URL params to prevent infinite loops
  const [processedUrlParams, setProcessedUrlParams] = useState<string>('')
  
  // Check URL parameters on mount to restore game state
  useEffect(() => {
    const viewParam = searchParams.get('view')
    const gameIdParam = searchParams.get('gameId')
    const currentParams = `${viewParam || ''}-${gameIdParam || ''}`
    
    // Prevent infinite loop by checking if we've already processed these params
    if (currentParams === processedUrlParams) {
      return
    }
    
    setProcessedUrlParams(currentParams)
    
    // If there's a gameId in the URL, we need to load the game from the contract
    if (gameIdParam) {
      const gameId = parseInt(gameIdParam)
      if (!isNaN(gameId) && getDetailedGameState) {
        console.log('Found gameId in URL, loading game:', gameId)
        setContractGameId(gameId)
        
        // Load the game state from the blockchain
        getDetailedGameState(gameId).then(gameStateView => {
          if (gameStateView) {
            console.log('Loaded game state from contract:', gameStateView)
            
            // Check if the game has started
            if (gameStateView.isStarted) {
              // Game has started, load it directly into the game view
              handleOnchainGameStart(gameId)
            } else {
              // Game hasn't started yet, show the PlayPage/lobby
              setShowPlayPage(true)
            }
          }
        }).catch(error => {
          console.error('Failed to load game from URL parameter:', error)
          // Still show the PlayPage so user can see the error or try again
          setShowPlayPage(true)
        })
      }
    } else if (viewParam) {
      // Just a view parameter without gameId
      setShowPlayPage(true)
    }
  }, [searchParams, getDetailedGameState, processedUrlParams, setContractGameId])

  return (
    <div className="min-h-screen bg-eth-dark flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">Ethereum TCG</h1>
            <span className="text-sm text-gray-400">
              Welcome, {user?.email?.address || user?.wallet?.address?.slice(0, 8)}...
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCardsPage(true)}
              className="btn-secondary text-sm"
            >
              🃏 Cards
            </button>

            <button
              onClick={() => setShowDecksPage(true)}
              className="btn-secondary text-sm"
            >
              📚 Decks
            </button>
            
            <button
              onClick={() => setShowWeb3Panel(!showWeb3Panel)}
              className="btn-secondary text-sm"
            >
              {showWeb3Panel ? 'Hide' : 'Show'} Web3 Panel
            </button>
            
            {!isGameActive ? (
              <>
                <button
                  onClick={() => setShowPlayPage(true)}
                  className="btn-primary"
                >
                  🎮 Play
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {/* Draw Card button when turn needs to be started */}
                {needsToDraw && activePlayer === user?.wallet?.address && (
                  <button
                    onClick={handleDrawToStartTurn}
                    className="btn-primary text-sm animate-pulse"
                  >
                    🃏 Draw Card to Start Turn
                  </button>
                )}
                
                {/* Only show End Turn button if not waiting to draw and it's your turn */}
                {!needsToDraw && activePlayer === user?.wallet?.address && (
                  <button
                    onClick={handleEndTurn}
                    className="btn-primary text-sm"
                  >
                    End Turn
                  </button>
                )}
                
                <button
                  onClick={handleGetGameState}
                  className="btn-secondary text-sm"
                >
                  Get Game State
                </button>
                <button
                  onClick={resetGame}
                  className="btn-secondary text-sm"
                >
                  Reset Game
                </button>
              </div>
            )}
            
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Game Status */}
      <PlayerStats />

      {/* Game Content */}
      <div className="flex-1 flex">
        {/* Main Game Area */}
        <div className="flex-1 flex flex-col">
          {!isGameActive && !winner ? (
            // Welcome Screen
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-6">🃏</div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Ready to Play?
                </h2>
                <p className="text-gray-400 mb-8 max-w-lg">
                  Join an onchain game to play against other players with real blockchain transactions.
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => setShowPlayPage(true)}
                    className="btn-primary text-lg px-8 py-3"
                  >
                    🎮 Start Playing
                  </button>
                  <button
                    onClick={handleStartWithCustomDeck}
                    className="btn-secondary text-lg px-8 py-3"
                  >
                    🃏 Custom Deck
                  </button>
                </div>
                {customDeck && (
                  <p className="text-sm text-eth-success mt-4">
                    ✓ Custom deck ready with {customDeck.length} cards
                  </p>
                )}
              </div>
            </div>
          ) : winner ? (
            // Game Over Screen
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-6">
                  {winner === 'player1' ? '🏆' : '💀'}
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  {winner === 'player1' ? 'Victory!' : 'Defeat!'}
                </h2>
                <p className="text-gray-400 mb-8">
                  {winner === 'player1' 
                    ? 'Congratulations! You defeated your opponent!' 
                    : 'Better luck next time. Your opponent emerged victorious.'}
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => setShowPlayPage(true)}
                    className="btn-primary"
                  >
                    Play Again
                  </button>
                  <button
                    onClick={resetGame}
                    className="btn-secondary"
                  >
                    Back to Lobby
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Active Game
            <DragDropGameBoard />
          )}
        </div>

        {/* Web3 Actions Panel */}
        {showWeb3Panel && (
          <div className="w-80 border-l border-gray-700 bg-gray-900">
            <Web3Actions />
          </div>
        )}
      </div>

      {/* Turn Indicator */}
      {isGameActive && !winner && (
        <div className="fixed bottom-4 left-4 bg-eth-dark border border-gray-700 rounded-lg px-4 py-2">
          <div className="text-sm text-white">
            <div className="font-bold">TURN ACTIVE</div>
            <div className="text-gray-400 text-xs">
              {needsToDraw && activePlayer === user?.wallet?.address
                ? '🃏 Draw card to start turn'
                : activePlayer === user?.wallet?.address
                  ? 'Your turn' 
                  : "Opponent's turn"
              }
            </div>
          </div>
        </div>
      )}

      {/* Deck Builder Modal */}
      {showDeckBuilder && (
        <DeckBuilder
          onDeckReady={handleDeckReady}
          onClose={() => setShowDeckBuilder(false)}
        />
      )}

      {/* Cards Page Modal */}
      {showCardsPage && (
        <CardsPage onClose={() => setShowCardsPage(false)} />
      )}

      {/* Decks Page Modal */}
      {showDecksPage && (
        <DecksPage onClose={() => setShowDecksPage(false)} />
      )}

      {/* Play Page Modal */}
      {showPlayPage && (
        <PlayPage 
          onClose={() => setShowPlayPage(false)} 
          onGameStart={handleOnchainGameStart}
        />
      )}

      {/* Debug Panels */}
      <PrivyDebugInfo />
      <ContractDebugPanel />
    </div>
  )
}