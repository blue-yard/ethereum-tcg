// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./CardRegistry.sol";
import "./DeckRegistry.sol";

contract GameEngine {
    enum GamePhase {
        NotStarted,
        Playing,
        Finished
    }
    
    struct CardInstance {
        uint256 cardId;
        uint256 instanceId;
        address owner;
        uint256 turnPlayed;
        uint256 stakedETH;       // ETH staked on this card (for DeFi cards)
    }
    
    struct PlayerState {
        address player;
        uint256 deckId;
        uint256[] deck;           // Shuffled deck of card IDs
        uint256[] hand;           // Card IDs in hand
        uint256[] battlefield;    // Card instance IDs on battlefield
        uint256 deckIndex;        // Current position in deck for drawing
        uint256 eth;              // ETH resources
    }
    
    struct Game {
        uint256 gameId;
        address player1;
        address player2;
        uint256 player1DeckId;
        uint256 player2DeckId;
        PlayerState player1State;
        PlayerState player2State;
        bool isStarted;
        bool isFinished;
        uint256 currentTurn;      // 0 for player1, 1 for player2
        uint256 turnNumber;
        bool needsToDraw;         // True if current player needs to draw to start turn
        uint256 createdAt;
        uint256 startedAt;
    }
    
    struct GameView {
        address player1;
        address player2;
        uint256 player1ETH;
        uint256 player2ETH;
        uint256 player1HandSize;
        uint256 player2HandSize;
        uint256 player1BattlefieldSize;
        uint256 player2BattlefieldSize;
        uint256 player1DeckRemaining;
        uint256 player2DeckRemaining;
        uint256 currentTurn;
        uint256 turnNumber;
        bool needsToDraw;
        bool isStarted;
        bool isFinished;
    }
    
    uint256 public nextGameId;
    uint256 public nextCardInstanceId;
    mapping(uint256 => Game) public games;
    mapping(uint256 => CardInstance) public cardInstances;
    uint256[] public gameIds;
    
    mapping(address => uint256[]) public playerGames;
    
    CardRegistry public cardRegistry;
    DeckRegistry public deckRegistry;
    
    uint256 public constant INITIAL_HAND_SIZE = 5;
    uint256 public constant MAX_HAND_SIZE = 10;
    uint256 public constant INITIAL_ETH = 3;
    uint256 public constant ETH_PER_TURN = 1;
    
    event GameCreated(uint256 indexed gameId, address indexed creator, uint256 deckId);
    event GameJoined(uint256 indexed gameId, address indexed player, uint256 deckId);
    event GameStarted(uint256 indexed gameId, address indexed player1, address indexed player2);
    event TurnStarted(uint256 indexed gameId, address indexed player, uint256 turnNumber);
    event CardDrawn(uint256 indexed gameId, address indexed player, uint256 cardId);
    event CardPlayed(uint256 indexed gameId, address indexed player, uint256 cardId, uint256 instanceId);
    event TurnEnded(uint256 indexed gameId, address indexed player);
    event ResourcesGained(uint256 indexed gameId, address indexed player, uint256 amount);
    event UpkeepTriggered(uint256 indexed gameId, uint256 cardInstanceId, string abilityName);
    event ETHStaked(uint256 indexed gameId, address indexed player, uint256 cardInstanceId, uint256 amount);
    
    error GameNotFound();
    error GameAlreadyStarted();
    error GameFull();
    error NotEnoughPlayers();
    error NotInGame();
    error AlreadyInGame();
    error InvalidDeck();
    error NotYourTurn();
    error DeckEmpty();
    error HandFull();
    error GameNotStarted();
    error InsufficientResources();
    error CardNotInHand();
    error GameFinished();
    error InvalidStakeAmount();
    error CardNotOnBattlefield();
    error NotDeFiCard();
    error NotCardOwner();
    
    constructor(address _cardRegistry, address _deckRegistry) {
        cardRegistry = CardRegistry(_cardRegistry);
        deckRegistry = DeckRegistry(_deckRegistry);
    }
    
    // ========== GAME CREATION AND JOINING ==========
    
    function createGame(uint256 _deckId) external returns (uint256) {
        DeckRegistry.Deck memory deck = deckRegistry.getDeck(_deckId);
        if (deck.totalCards == 0) revert InvalidDeck();
        
        uint256 gameId = nextGameId++;
        
        Game storage game = games[gameId];
        game.gameId = gameId;
        game.player1 = msg.sender;
        game.player1DeckId = _deckId;
        game.isStarted = false;
        game.isFinished = false;
        game.createdAt = block.timestamp;
        
        game.player1State.player = msg.sender;
        game.player1State.deckId = _deckId;
        game.player1State.eth = INITIAL_ETH;
        
        gameIds.push(gameId);
        playerGames[msg.sender].push(gameId);
        
        emit GameCreated(gameId, msg.sender, _deckId);
        
        return gameId;
    }
    
    function joinGame(uint256 _gameId, uint256 _deckId) external {
        Game storage game = games[_gameId];
        
        if (game.player1 == address(0)) revert GameNotFound();
        if (game.isStarted) revert GameAlreadyStarted();
        if (game.player2 != address(0)) revert GameFull();
        if (game.player1 == msg.sender) revert AlreadyInGame();
        
        DeckRegistry.Deck memory deck = deckRegistry.getDeck(_deckId);
        if (deck.totalCards == 0) revert InvalidDeck();
        
        game.player2 = msg.sender;
        game.player2DeckId = _deckId;
        
        game.player2State.player = msg.sender;
        game.player2State.deckId = _deckId;
        game.player2State.eth = INITIAL_ETH;
        
        playerGames[msg.sender].push(_gameId);
        
        emit GameJoined(_gameId, msg.sender, _deckId);
    }
    
    function startGame(uint256 _gameId) external {
        Game storage game = games[_gameId];
        
        if (game.player1 == address(0)) revert GameNotFound();
        if (game.isStarted) revert GameAlreadyStarted();
        if (game.player2 == address(0)) revert NotEnoughPlayers();
        if (game.player1 != msg.sender && game.player2 != msg.sender) revert NotInGame();
        
        game.isStarted = true;
        game.startedAt = block.timestamp;
        game.currentTurn = 0; // Player 1 starts
        game.turnNumber = 1;
        
        _initializePlayerDeck(game.player1State, game.player1DeckId);
        _initializePlayerDeck(game.player2State, game.player2DeckId);
        
        _drawInitialHand(game.player1State);
        _drawInitialHand(game.player2State);
        
        emit GameStarted(_gameId, game.player1, game.player2);
        
        // Start player 1's first turn (they don't draw on first turn)
        _startTurn(game, game.player1State, true);
    }
    
    // ========== TURN MANAGEMENT ==========
    
    function _startTurn(Game storage game, PlayerState storage playerState, bool isFirstTurn) private {
        emit TurnStarted(game.gameId, playerState.player, game.turnNumber);
        
        // DRAW PHASE - Skip draw on very first turn of the game
        if (!isFirstTurn) {
            if (playerState.hand.length < MAX_HAND_SIZE && playerState.deckIndex < playerState.deck.length) {
                uint256 cardId = playerState.deck[playerState.deckIndex];
                playerState.hand.push(cardId);
                playerState.deckIndex++;
                emit CardDrawn(game.gameId, playerState.player, cardId);
            }
        }
        
        // UPKEEP PHASE
        _executeUpkeep(game, playerState);
        
        // Now the player is in PLAY PHASE and can play cards
    }
    
    function _executeUpkeep(Game storage game, PlayerState storage playerState) private {
        // Gain 1 ETH
        playerState.eth += ETH_PER_TURN;
        emit ResourcesGained(game.gameId, playerState.player, ETH_PER_TURN);
        
        // Execute upkeep abilities for all cards on battlefield
        for (uint256 i = 0; i < playerState.battlefield.length; i++) {
            uint256 instanceId = playerState.battlefield[i];
            CardInstance storage instance = cardInstances[instanceId];
            CardRegistry.Card memory card = cardRegistry.getCard(instance.cardId);
            
            // Process each ability
            for (uint256 j = 0; j < card.abilities.length; j++) {
                _processUpkeepAbility(game, playerState, instance, card.abilities[j]);
            }
        }
    }
    
    function _processUpkeepAbility(
        Game storage game,
        PlayerState storage playerState,
        CardInstance storage instance,
        CardRegistry.Ability memory ability
    ) private {
        // Check if this is an upkeep ability
        if (keccak256(bytes(ability.name)) == keccak256(bytes("income"))) {
            // Find the amount in options
            for (uint256 i = 0; i < ability.options.length; i++) {
                if (keccak256(bytes(ability.options[i].key)) == keccak256(bytes("amount"))) {
                    uint256 amount = _parseUint(ability.options[i].value);
                    playerState.eth += amount;
                    emit ResourcesGained(game.gameId, playerState.player, amount);
                    emit UpkeepTriggered(game.gameId, instance.instanceId, "income");
                    break;
                }
            }
        } else if (keccak256(bytes(ability.name)) == keccak256(bytes("yield"))) {
            // Yield ability - gain ETH based on staked amount
            if (instance.stakedETH > 0) {
                for (uint256 i = 0; i < ability.options.length; i++) {
                    if (keccak256(bytes(ability.options[i].key)) == keccak256(bytes("amount"))) {
                        uint256 yieldRate = _parseUint(ability.options[i].value);
                        uint256 yieldAmount = instance.stakedETH * yieldRate;
                        playerState.eth += yieldAmount;
                        emit ResourcesGained(game.gameId, playerState.player, yieldAmount);
                        emit UpkeepTriggered(game.gameId, instance.instanceId, "yield");
                        break;
                    }
                }
            }
        }
    }
    
    // ========== STAKING ==========
    
    function stakeETH(uint256 _gameId, uint256 _instanceId, uint256 _amount) external {
        Game storage game = games[_gameId];
        
        if (!game.isStarted) revert GameNotStarted();
        if (game.isFinished) revert GameFinished();
        if (_amount == 0) revert InvalidStakeAmount();
        
        CardInstance storage instance = cardInstances[_instanceId];
        if (instance.owner != msg.sender) revert NotCardOwner();
        
        // Check card is DeFi type
        CardRegistry.Card memory card = cardRegistry.getCard(instance.cardId);
        if (card.cardType != CardRegistry.CardType.DeFi) revert NotDeFiCard();
        
        // Check player has enough ETH
        PlayerState storage playerState;
        if (msg.sender == game.player1) {
            playerState = game.player1State;
        } else if (msg.sender == game.player2) {
            playerState = game.player2State;
        } else {
            revert NotInGame();
        }
        
        if (playerState.eth < _amount) revert InsufficientResources();
        
        // Check card is on player's battlefield
        bool foundOnBattlefield = false;
        for (uint256 i = 0; i < playerState.battlefield.length; i++) {
            if (playerState.battlefield[i] == _instanceId) {
                foundOnBattlefield = true;
                break;
            }
        }
        if (!foundOnBattlefield) revert CardNotOnBattlefield();
        
        // Stake the ETH
        playerState.eth -= _amount;
        instance.stakedETH += _amount;
        
        emit ETHStaked(_gameId, msg.sender, _instanceId, _amount);
    }
    
    // ========== PLAY PHASE ==========
    
    function playCard(uint256 _gameId, uint256 _cardIndex) external {
        Game storage game = games[_gameId];
        
        if (!game.isStarted) revert GameNotStarted();
        if (game.isFinished) revert GameFinished();
        if (game.needsToDraw) revert("Must draw card to start turn first");
        
        PlayerState storage playerState;
        if (msg.sender == game.player1 && game.currentTurn == 0) {
            playerState = game.player1State;
        } else if (msg.sender == game.player2 && game.currentTurn == 1) {
            playerState = game.player2State;
        } else {
            revert NotYourTurn();
        }
        
        if (_cardIndex >= playerState.hand.length) revert CardNotInHand();
        
        uint256 cardId = playerState.hand[_cardIndex];
        CardRegistry.Card memory card = cardRegistry.getCard(cardId);
        
        // Check if player has enough ETH
        if (playerState.eth < card.cost) revert InsufficientResources();
        
        // Pay the cost
        playerState.eth -= card.cost;
        
        // Create card instance on battlefield (only for permanent cards, not Actions)
        if (card.cardType != CardRegistry.CardType.Action) {
            uint256 instanceId = nextCardInstanceId++;
            cardInstances[instanceId] = CardInstance({
                cardId: cardId,
                instanceId: instanceId,
                owner: msg.sender,
                turnPlayed: game.turnNumber,
                stakedETH: 0
            });
            
            playerState.battlefield.push(instanceId);
        }
        
        // Remove card from hand
        playerState.hand[_cardIndex] = playerState.hand[playerState.hand.length - 1];
        playerState.hand.pop();
        
        // Process immediate abilities (like draw for Action cards)
        _processImmediateAbilities(game, playerState, card);
        
        emit CardPlayed(_gameId, msg.sender, cardId, card.cardType == CardRegistry.CardType.Action ? 0 : nextCardInstanceId - 1);
    }
    
    function _processImmediateAbilities(
        Game storage game,
        PlayerState storage playerState,
        CardRegistry.Card memory card
    ) private {
        for (uint256 i = 0; i < card.abilities.length; i++) {
            if (keccak256(bytes(card.abilities[i].name)) == keccak256(bytes("draw"))) {
                // Draw ability
                for (uint256 j = 0; j < card.abilities[i].options.length; j++) {
                    if (keccak256(bytes(card.abilities[i].options[j].key)) == keccak256(bytes("amount"))) {
                        uint256 amount = _parseUint(card.abilities[i].options[j].value);
                        for (uint256 k = 0; k < amount; k++) {
                            if (playerState.hand.length < MAX_HAND_SIZE && 
                                playerState.deckIndex < playerState.deck.length) {
                                uint256 drawnCardId = playerState.deck[playerState.deckIndex];
                                playerState.hand.push(drawnCardId);
                                playerState.deckIndex++;
                                emit CardDrawn(game.gameId, playerState.player, drawnCardId);
                            }
                        }
                        break;
                    }
                }
            }
        }
    }
    
    function endTurn(uint256 _gameId) external {
        Game storage game = games[_gameId];
        
        if (!game.isStarted) revert GameNotStarted();
        if (game.isFinished) revert GameFinished();
        if (game.needsToDraw) revert("Must draw card to start turn first");
        
        // Verify it's the current player ending their turn
        if ((game.currentTurn == 0 && msg.sender != game.player1) ||
            (game.currentTurn == 1 && msg.sender != game.player2)) {
            revert NotYourTurn();
        }
        
        emit TurnEnded(_gameId, msg.sender);
        
        // Switch turns
        game.currentTurn = 1 - game.currentTurn;
        game.turnNumber++;
        
        // Next player must draw to start their turn (except on very first turn)
        game.needsToDraw = true;
    }
    
    function drawToStartTurn(uint256 _gameId) external {
        Game storage game = games[_gameId];
        
        if (!game.isStarted) revert GameNotStarted();
        if (game.isFinished) revert GameFinished();
        if (!game.needsToDraw) revert("Turn already started");
        
        // Verify it's the current player starting their turn
        if ((game.currentTurn == 0 && msg.sender != game.player1) ||
            (game.currentTurn == 1 && msg.sender != game.player2)) {
            revert NotYourTurn();
        }
        
        PlayerState storage currentPlayerState = game.currentTurn == 0 ? game.player1State : game.player2State;
        
        // Start the turn with draw and upkeep
        _startTurn(game, currentPlayerState, false);
        
        // Turn is now officially started
        game.needsToDraw = false;
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    function getPlayerHand(uint256 _gameId, address _player) external view returns (uint256[] memory) {
        Game storage game = games[_gameId];
        
        if (_player == game.player1) {
            return game.player1State.hand;
        } else if (_player == game.player2) {
            return game.player2State.hand;
        } else {
            revert NotInGame();
        }
    }
    
    function getPlayerBattlefield(uint256 _gameId, address _player) external view returns (uint256[] memory) {
        Game storage game = games[_gameId];
        
        if (_player == game.player1) {
            return game.player1State.battlefield;
        } else if (_player == game.player2) {
            return game.player2State.battlefield;
        } else {
            revert NotInGame();
        }
    }
    
    function getCardInstance(uint256 _instanceId) external view returns (CardInstance memory) {
        return cardInstances[_instanceId];
    }
    
    function getGameState(uint256 _gameId) external view returns (GameView memory) {
        Game storage game = games[_gameId];
        
        return GameView({
            player1: game.player1,
            player2: game.player2,
            player1ETH: game.player1State.eth,
            player2ETH: game.player2State.eth,
            player1HandSize: game.player1State.hand.length,
            player2HandSize: game.player2State.hand.length,
            player1BattlefieldSize: game.player1State.battlefield.length,
            player2BattlefieldSize: game.player2State.battlefield.length,
            player1DeckRemaining: game.player1State.deck.length - game.player1State.deckIndex,
            player2DeckRemaining: game.player2State.deck.length - game.player2State.deckIndex,
            currentTurn: game.currentTurn,
            turnNumber: game.turnNumber,
            needsToDraw: game.needsToDraw,
            isStarted: game.isStarted,
            isFinished: game.isFinished
        });
    }
    
    function getOpenGames() external view returns (uint256[] memory) {
        uint256 openCount = 0;
        
        for (uint256 i = 0; i < gameIds.length; i++) {
            Game memory game = games[gameIds[i]];
            if (game.player2 == address(0) && !game.isStarted && !game.isFinished) {
                openCount++;
            }
        }
        
        uint256[] memory openGames = new uint256[](openCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < gameIds.length; i++) {
            Game memory game = games[gameIds[i]];
            if (game.player2 == address(0) && !game.isStarted && !game.isFinished) {
                openGames[index++] = gameIds[i];
            }
        }
        
        return openGames;
    }
    
    // ========== HELPER FUNCTIONS ==========
    
    function _initializePlayerDeck(PlayerState storage playerState, uint256 deckId) private {
        uint256[] memory expandedDeck = deckRegistry.expandDeck(deckId);
        
        playerState.deck = new uint256[](expandedDeck.length);
        for (uint256 i = 0; i < expandedDeck.length; i++) {
            playerState.deck[i] = expandedDeck[i];
        }
        
        // Simple shuffle
        for (uint256 i = expandedDeck.length - 1; i > 0; i--) {
            uint256 j = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, i))) % (i + 1);
            uint256 temp = playerState.deck[i];
            playerState.deck[i] = playerState.deck[j];
            playerState.deck[j] = temp;
        }
        
        playerState.deckIndex = 0;
    }
    
    function _drawInitialHand(PlayerState storage playerState) private {
        for (uint256 i = 0; i < INITIAL_HAND_SIZE && i < playerState.deck.length; i++) {
            playerState.hand.push(playerState.deck[i]);
            playerState.deckIndex++;
        }
    }
    
    function _parseUint(string memory s) private pure returns (uint256) {
        bytes memory b = bytes(s);
        uint256 result = 0;
        for (uint256 i = 0; i < b.length; i++) {
            uint256 c = uint256(uint8(b[i]));
            if (c >= 48 && c <= 57) {
                result = result * 10 + (c - 48);
            }
        }
        return result;
    }
}