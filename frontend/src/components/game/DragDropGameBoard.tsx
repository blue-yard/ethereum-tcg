import React, { useState } from 'react'
import { DndContext, DragOverlay, closestCenter, useDroppable, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useGameStore, type Card } from '@/stores/gameStore'
import { DeckElement } from './DeckElement'
import { ColdStorage } from './ColdStorage'
import { HotWallet } from './HotWallet'
import { CardImage } from '@/components/ui/CardImage'
import { useGameEngine } from '@/lib/hooks/useGameEngine'

interface WalletCardFooterProps {
  card: Card
  playerId: string
  playerETH: number
  isActivePlayer: boolean
}

function WalletCardFooter({ card, playerId, playerETH, isActivePlayer }: WalletCardFooterProps) {
  const { depositETHToWalletCard } = useGameStore()
  
  const handleDeposit = () => {
    if (isActivePlayer && playerETH >= 1) {
      depositETHToWalletCard(playerId, card.id, 1)
    }
  }

  return (
    <div className="p-2 border-t border-gray-600">
      <div className="text-center">
        <div className="text-xs text-gray-400">ETH Balance</div>
        <div className="text-sm font-bold text-eth-secondary">
          {card.heldETH || 0} ETH
        </div>
        {isActivePlayer && playerETH >= 1 && (
          <button
            onClick={handleDeposit}
            className="mt-1 text-xs bg-eth-secondary hover:bg-eth-primary px-2 py-1 rounded transition-colors"
          >
            +1 ETH
          </button>
        )}
      </div>
    </div>
  )
}

interface DeFiCardFooterProps {
  card: Card
  playerId: string
  playerETH: number
  isActivePlayer: boolean
  gameId: number | null
}

function DeFiCardFooter({ card, playerId, playerETH, isActivePlayer, gameId }: DeFiCardFooterProps) {
  const { stakeETH } = useGameEngine()
  const [showStakeModal, setShowStakeModal] = useState(false)
  const [stakeAmount, setStakeAmount] = useState(1)
  const [isStaking, setIsStaking] = useState(false)
  
  // For now we'll track staked ETH locally since we need cardInstance data
  // In full implementation, this would come from contract state
  const stakedETH = card.stakedETH || 0
  const yieldAmount = card.yieldAmount || 1 // Default 1x multiplier

  const handleStake = async () => {
    if (isActivePlayer && playerETH >= stakeAmount && gameId) {
      setIsStaking(true)
      try {
        // Note: This would need the actual card instance ID from the contract
        // For demo purposes, we'll use a placeholder instanceId
        // In full implementation, card instances would have their own IDs from the contract
        const cardInstanceId = parseInt(card.id.split('-').pop() || '0')
        
        await stakeETH(gameId, cardInstanceId, stakeAmount)
        console.log(`Successfully staked ${stakeAmount} ETH on DeFi card ${card.name}`)
        setShowStakeModal(false)
      } catch (error) {
        console.error('Failed to stake ETH:', error)
      } finally {
        setIsStaking(false)
      }
    }
  }

  return (
    <>
      <div className="p-2 border-t border-gray-600">
        <div className="text-center">
          <div className="text-xs text-gray-400">Staked ETH</div>
          <div className="text-sm font-bold text-purple-400">
            {stakedETH} ETH
          </div>
          {stakedETH > 0 && (
            <div className="text-xs text-gray-400">
              Yield: {yieldAmount}x per turn
            </div>
          )}
          {isActivePlayer && playerETH >= 1 && (
            <button
              onClick={() => setShowStakeModal(true)}
              className="mt-1 text-xs bg-purple-600 hover:bg-purple-500 px-2 py-1 rounded transition-colors"
            >
              Stake ETH
            </button>
          )}
        </div>
      </div>

      {/* Staking Modal */}
      {showStakeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 w-80">
            <h3 className="text-lg font-bold text-white mb-4">Stake ETH on {card.name}</h3>
            
            <div className="space-y-4">
              <div className="text-sm text-gray-300">
                Staked ETH earns yield during upkeep phases
              </div>
              
              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  Stake Amount (ETH)
                </label>
                <input
                  type="number"
                  min="1"
                  max={playerETH}
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleStake}
                  disabled={playerETH < stakeAmount || isStaking}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 py-2 rounded font-semibold disabled:opacity-50"
                >
                  {isStaking ? 'Staking...' : `Stake ${stakeAmount} ETH`}
                </button>
                <button
                  onClick={() => setShowStakeModal(false)}
                  disabled={isStaking}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface DraggableCardProps {
  card: Card
  playerId: string
  source: 'hand' | 'board'
  canDrag: boolean
}

interface ExtendedDraggableCardProps extends DraggableCardProps {
  playerETH: number
  isActivePlayer: boolean
  gameId: number | null
}

function DraggableCard({ card, playerId, source, canDrag, playerETH, isActivePlayer, gameId }: ExtendedDraggableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${source}-${card.id}`,
    data: { card, playerId, source },
    disabled: !canDrag,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Determine the specific reason why a card cannot be played
  const canAfford = playerETH >= card.cost
  const inMainPhase = true // Always allow playing cards now
  
  const getCardState = () => {
    if (source === 'board') return 'playable' // Board cards are just displayed
    
    if (!isActivePlayer) return 'not-your-turn'
    if (!inMainPhase) return 'wrong-phase'
    if (!canAfford) return 'cant-afford'
    return 'playable'
  }

  const cardState = getCardState()

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'unit': return 'border-eth-success'
      case 'eoa': return 'border-eth-success'
      case 'spell': return 'border-eth-primary'
      case 'action': return 'border-eth-primary'
      case 'chain': return 'border-eth-secondary'
      case 'defi': return 'border-purple-500'
      case 'resource': return 'border-eth-secondary'
      case 'upgrade': return 'border-purple-500'
      default: return 'border-gray-500'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'unit': return '⚔️'
      case 'eoa': return '👤'
      case 'spell': return '✨'
      case 'action': return '⚡'
      case 'chain': return '🔗'
      case 'defi': return '💰'
      case 'resource': return '⛽'
      case 'upgrade': return '🔧'
      default: return '❓'
    }
  }

  const getCardVisualState = () => {
    switch (cardState) {
      case 'playable':
        return {
          className: 'hover:scale-105 cursor-pointer',
          opacity: '1',
          filter: 'none'
        }
      case 'cant-afford':
        return {
          className: 'cursor-not-allowed',
          opacity: '0.5',
          filter: 'grayscale(0.8) brightness(0.7)'
        }
      case 'wrong-phase':
        return {
          className: 'cursor-not-allowed',
          opacity: '0.7',
          filter: 'grayscale(0.3)'
        }
      case 'not-your-turn':
        return {
          className: 'cursor-not-allowed',
          opacity: '0.6',
          filter: 'grayscale(0.5)'
        }
      default:
        return {
          className: 'cursor-not-allowed',
          opacity: '0.6',
          filter: 'grayscale(0.5)'
        }
    }
  }

  const visualState = getCardVisualState()
  const cardSize = source === 'board' ? 'w-24 h-32' : 'w-32 h-44'

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        filter: visualState.filter,
      }}
      {...attributes}
      {...(canDrag ? listeners : {})}
      className={`${cardSize} card transition-all duration-200 ${getTypeColor(card.type)} ${visualState.className} ${isDragging ? 'z-50' : ''}`}
    >
      {/* Card Header */}
      <div className="p-2 border-b border-gray-600">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400 flex items-center">
            <span className="mr-1">{getTypeIcon(card.type)}</span>
            {source === 'hand' && card.type.toUpperCase()}
          </div>
          {card.cost > 0 && (
            <div className={`text-xs px-2 py-1 rounded-full font-bold ${
              cardState === 'cant-afford' 
                ? 'bg-red-600 text-red-200 border border-red-400' 
                : 'bg-eth-secondary text-white'
            }`}>
              {card.cost} ETH
              {cardState === 'cant-afford' && source === 'hand' && (
                <div className="text-xs text-red-300 mt-1">
                  Need {card.cost - playerETH} more
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="flex-1 relative">
        {source === 'hand' ? (
          // Full card view for hand
          <div className="h-full flex flex-col">
            {/* Card Image */}
            <div className="flex-1 p-2">
              <CardImage 
                card={card} 
                className="w-full h-full rounded"
                fallbackIcon={getTypeIcon(card.type)}
              />
            </div>
            
            {/* Card Name Overlay */}
            <div className="absolute bottom-2 left-2 right-2">
              <div className="bg-black/70 rounded px-2 py-1">
                <h4 className="text-xs font-bold text-white leading-tight">
                  {card.name}
                </h4>
                
                {/* Status message for unplayable cards */}
                {cardState === 'cant-afford' && (
                  <div className="text-xs text-red-400 font-semibold">
                    💸 Need {card.cost - playerETH} more ETH
                  </div>
                )}
                {cardState === 'wrong-phase' && (
                  <div className="text-xs text-yellow-400 font-semibold">
                    🕐 Wrong phase
                  </div>
                )}
                {cardState === 'not-your-turn' && (
                  <div className="text-xs text-gray-400 font-semibold">
                    ⏳ Not your turn
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Compact view for board
          <div className="p-1 h-full">
            <CardImage 
              card={card} 
              className="w-full h-full rounded"
              fallbackIcon={getTypeIcon(card.type)}
            />
          </div>
        )}
      </div>

      {/* Card Footer - Power/Toughness for units, ETH balance for wallet cards, or staking for DeFi cards */}
      {card.type === 'unit' && card.power !== undefined && card.toughness !== undefined ? (
        <div className="p-2 border-t border-gray-600">
          <div className="flex justify-between text-sm font-bold">
            <span className="text-eth-danger">{card.power}</span>
            <span className="text-eth-success">{card.toughness}</span>
          </div>
        </div>
      ) : (card.type === 'EOA' || card.name.toLowerCase().includes('wallet')) && source === 'board' ? (
        <WalletCardFooter 
          card={card}
          playerId={playerId}
          playerETH={playerETH}
          isActivePlayer={isActivePlayer}
        />
      ) : card.type === 'DeFi' && source === 'board' ? (
        <DeFiCardFooter 
          card={card}
          playerId={playerId}
          playerETH={playerETH}
          isActivePlayer={isActivePlayer}
          gameId={gameId}
        />
      ) : null}
    </div>
  )
}

interface DropZoneProps {
  id: string
  children: React.ReactNode
  label: string
  isEmpty: boolean
  canDrop: boolean
  isOver?: boolean
}

function DropZone({ id, children, label, isEmpty, canDrop, isOver: isOverProp = false }: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
    disabled: !canDrop
  })


  return (
    <div
      ref={setNodeRef}
      className={`min-h-36 p-4 border-2 border-dashed rounded-lg transition-all duration-200 ${
        canDrop
          ? isOver
            ? 'border-eth-primary/70 bg-eth-primary/20'
            : 'border-blue-500/30 bg-blue-500/5'
          : 'border-gray-500/30 bg-gray-500/5'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-300">{label}</h4>
        <span className="text-xs text-gray-400">
          {React.Children.count(children)} cards
        </span>
      </div>
      
      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 min-h-24">
          <div className="text-center">
            <div className="text-2xl mb-1">
              {id.includes('board') ? '🏟️' : '🃏'}
            </div>
            <div className="text-xs">
              {id.includes('board') ? 'Drop units here' : 'No cards in hand'}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {children}
        </div>
      )}
    </div>
  )
}

export function DragDropGameBoard() {
  const { 
    players, 
    activePlayer, 
    viewingPlayer,
    isDemoMode,
    playCard,
    playCardByIndex,
    moveCard,
    gameId 
  } = useGameStore()
  
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedCard, setDraggedCard] = useState<Card | null>(null)

  const { player1, player2 } = players
  
  // In demo mode, the viewing player can play cards if it's their turn
  const currentViewingPlayer = viewingPlayer
  
  // Simplified: in demo mode, always allow the viewing player to play cards if it's their turn and main phase
  const canPlayCards = activePlayer === viewingPlayer // Always allow playing cards during your turn
  
  
  // Determine which player's perspective we're showing
  const playerHand = currentViewingPlayer === 'player1' ? player1 : player2
  const opponentHand = currentViewingPlayer === 'player1' ? player2 : player1
  const playerBoard = currentViewingPlayer === 'player1' ? player1 : player2
  const opponentBoard = currentViewingPlayer === 'player1' ? player2 : player1

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)
    
    const data = active.data.current
    if (data) {
      setDraggedCard(data.card)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setDraggedCard(null)

    if (!over) return

    const activeData = active.data.current
    const overId = over.id as string

    if (!activeData) return

    const { card, playerId, source } = activeData

    // Handle card play from hand to board
    const targetBoard = `${currentViewingPlayer}-board`
    if (source === 'hand' && overId === targetBoard && playerId === currentViewingPlayer) {
      if (canPlayCards && playerHand.eth >= card.cost) {
        // Find the card index in the player's hand for contract call
        const cardIndex = playerHand.hand.findIndex(c => c.id === card.id)
        if (cardIndex !== -1) {
          console.log(`Playing card ${card.name} at index ${cardIndex}`)
          playCardByIndex(playerId, cardIndex)
        } else {
          console.error('Card not found in hand:', card.id)
        }
      }
    }
    
    // Handle moving cards between zones (for future features)
    if (active.id !== over.id && source !== 'hand') {
      // This would handle board-to-board moves, board-to-hand returns, etc.
      // For now, we'll keep it simple
    }
  }

  const canDragCard = (card: Card, source: 'hand' | 'board', playerId: string) => {
    // In demo mode, allow the current viewing player to drag their cards
    // In practice mode, only allow player1
    if (isDemoMode) {
      if (playerId !== currentViewingPlayer) return false
    } else {
      if (playerId !== 'player1') return false
    }
    
    if (source === 'hand') {
      const canDrag = canPlayCards && playerHand.eth >= card.cost
      // Debug logging
      console.log('Drag check:', {
        cardName: card.name,
        cardCost: card.cost,
        canPlayCards,
        playerETH: playerHand.eth,
        activePlayer,
        currentViewingPlayer,
        canDrag
      })
      return canDrag
    }
    return false // Board cards can't be moved yet
  }

  return (
    <div className="relative">
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 p-6 bg-gradient-to-b from-gray-800 to-eth-dark">
          <div className="max-w-6xl mx-auto h-full">
            <div className="h-full flex flex-col gap-6">
            {/* Opponent Board - Not droppable for now */}
            <DropZone
              id={`${currentViewingPlayer === 'player1' ? 'player2' : 'player1'}-board`}
              label={`Opponent Board (Player ${currentViewingPlayer === 'player1' ? '2' : '1'})`}
              isEmpty={opponentBoard.board.length === 0}
              canDrop={false}
            >
              <SortableContext 
                items={opponentBoard.board.map(card => `board-${card.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {opponentBoard.board.map((card) => (
                  <div
                    key={card.id}
                    className="w-24 h-32 card border-red-500/50 transform rotate-180"
                  >
                    <div className="p-1 border-b border-gray-600">
                      <div className="text-xs text-center text-gray-300">
                        {card.name}
                      </div>
                    </div>
                    <div className="p-1 flex-1">
                      <CardImage 
                        card={card} 
                        className="w-full h-full rounded"
                        fallbackIcon="🃏"
                      />
                    </div>
                    {card.type === 'unit' && (
                      <div className="p-1 border-t border-gray-600">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-eth-danger">{card.power}</span>
                          <span className="text-eth-success">{card.toughness}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </SortableContext>
            </DropZone>

            {/* Battlefield Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-eth-primary/50"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-eth-dark px-4 py-1 text-eth-primary font-medium border border-eth-primary/30 rounded-full">
                  ⚔️ BATTLEFIELD ⚔️
                </span>
              </div>
            </div>

            {/* Player Board - Droppable */}
            <DropZone
              id={`${currentViewingPlayer}-board`}
              label={`Your Board (Player ${currentViewingPlayer === 'player1' ? '1' : '2'})`}
              isEmpty={playerBoard.board.length === 0}
              canDrop={canPlayCards}
            >
              <SortableContext 
                items={playerBoard.board.map(card => `board-${card.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {playerBoard.board.map((card) => (
                  <DraggableCard
                    key={card.id}
                    card={card}
                    playerId={currentViewingPlayer}
                    source="board"
                    canDrag={canDragCard(card, 'board', currentViewingPlayer)}
                    playerETH={playerHand.eth}
                    isActivePlayer={activePlayer === currentViewingPlayer}
                    gameId={gameId}
                  />
                ))}
              </SortableContext>
            </DropZone>

            {/* Player Hand */}
            <div className="p-4 bg-gray-900 border-t border-gray-700">
              <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Your Hand ({playerHand.hand.length})
                  </h3>
                  <div className="text-sm">
                    {canPlayCards ? (
                      <>
                        <span className="text-eth-success">⚡ Drag cards to board to play</span>
                        <span className="text-gray-400 ml-4">💰 {playerHand.eth} ETH available</span>
                      </>
                    ) : activePlayer !== currentViewingPlayer ? (
                      <span className="text-gray-400">⏳ Opponent's turn</span>
                    ) : (
                      <span className="text-gray-400">⏸ Not your turn</span>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-3 overflow-x-auto pb-2">
                  <SortableContext 
                    items={playerHand.hand.map(card => `hand-${card.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {playerHand.hand.map((card) => (
                      <DraggableCard
                        key={card.id}
                        card={card}
                        playerId={currentViewingPlayer}
                        source="hand"
                        canDrag={canDragCard(card, 'hand', currentViewingPlayer)}
                        playerETH={playerHand.eth}
                        isActivePlayer={activePlayer === currentViewingPlayer}
                        gameId={gameId}
                      />
                    ))}
                  </SortableContext>
                </div>
                
                {canPlayCards && (
                  <div className="mt-3 text-xs text-gray-400">
                    💡 Drag cards from hand to board to play them. ETH available: {playerHand.eth}
                  </div>
                )}
                
                {isDemoMode && !canPlayCards && (
                  <div className="mt-3 text-xs text-yellow-400">
                    🔄 {activePlayer !== currentViewingPlayer ? 'Not your turn' : 'Wrong phase'} - Use "Switch Player" or "Next Phase" to continue
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId && draggedCard ? (
            <div className="w-32 h-44 card border-eth-primary shadow-2xl opacity-90 transform rotate-12">
              <div className="p-2 border-b border-gray-600">
                <div className="text-xs text-center text-white font-bold">
                  {draggedCard.name}
                </div>
              </div>
              <div className="p-2 flex-1">
                <CardImage 
                  card={draggedCard} 
                  className="w-full h-full rounded"
                  fallbackIcon="🃏"
                />
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Game UI Elements - Outside DndContext to avoid interference */}
      {/* Player's deck (lower left) */}
      <DeckElement 
        playerId={currentViewingPlayer}
        position="lower-left"
      />
      
      {/* Opponent's deck (upper right) - only visible in demo mode */}
      {isDemoMode && (
        <DeckElement 
          playerId={currentViewingPlayer === 'player1' ? 'player2' : 'player1'}
          position="upper-right"
        />
      )}

      {/* Player's wallet controls (lower right) */}
      <div className="fixed bottom-4 right-4 z-10 flex flex-col gap-3">
        <HotWallet playerId={currentViewingPlayer} />
        <ColdStorage playerId={currentViewingPlayer} />
      </div>

      {/* Opponent's wallet displays (upper left) - only in demo mode */}
      {isDemoMode && (
        <div className="fixed top-4 left-4 z-10 flex flex-col gap-3">
          <HotWallet playerId={currentViewingPlayer === 'player1' ? 'player2' : 'player1'} />
          <ColdStorage playerId={currentViewingPlayer === 'player1' ? 'player2' : 'player1'} />
        </div>
      )}
    </div>
  )
}