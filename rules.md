**Game Flow**
1. Draw a card - Action a player takes to start the turn. Only the first player's first turn does not require (or allow) drawing a card.
2. Upkeep - Automatically done after draw a card. Player does not trigger this it just passes through this phase and onto play automatically after the card is drawn. 
*     Gain 1 ETH
3. Play - The game sits in this phase and the player is allowed to play cards from their hand, move ETH on or off cards that allow staking, or move ETH to their cold storage. 
4. End Turn - After the player has performed all the actions they want to take they click end turn. Then the game switches turn to the other player and the other player must click Draw a Card to start their own turn. 

**Playing Cards**
* DeFi cards can be played on a chain or on the battlefield by themself. If they are not placed on a chain they cost 1 more, as they are played on mainnet. Mainnet could be the main section of the battlefield. 
* You can only play cards or move ETH during the play phase
* First player doesn't draw on first turn. When the game is started it immediately goes through the upkeep phase of the first player doing all actions (game never stops in upkeep phase) and then goes to their play phase. 

**Smart Contracts**

* All state and gameplay is done via smart contracts, the frontend should merely be reading and writing to the smart contracts, make sure no gameplay related state is ever stored in the frontend. The frontend should continually read the latest state from the smart contracts and update accordingly. 

**Starting a game**

* When a user starts a game they can either create a game or join a game. To create a game, the user chooses a deck and stakes the required amount of ETH (0.01) to play. This may change in the future and require any pair of assets but for now we'll keep it simple with ETH. They then click create game and wait for someone to join.
* When a user starts a game and chooses to join a game they will see a list of games in the matchmaking lobby.  They can then choose a game to join and also stake the required amoutn of ETH to play. 
* When both users have both staked and joined, the game starts automatically. 

**Winning and Losing**
* The game ends when either one player accumulates 10 ETH in cold storage or one player's balance across all wallets + cold storage reaches 0.
* When the game ends, the winner receives the full stake (combination of both opponents) minus a protocol fee which is deposited into the game protocol's treasury.


**Open Questions**
* what happens to the stake if one or both players fail to continue the game? We need a way to unlock the staked ETH nd return it (minus a fee) to the players.
