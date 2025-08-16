// Local development network configuration (Anvil default)
export const localChain = {
  id: 31337,
  name: 'Local Development',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://localhost:8545'] },
  },
  blockExplorers: {
    default: { name: 'Local Explorer', url: 'http://localhost:8545' },
  },
} as const

// Ethereum mainnet configuration (needed for funding)
export const mainnet = {
  id: 1,
  name: 'Ethereum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://ethereum.publicnode.com'] },
  },
  blockExplorers: {
    default: { name: 'Etherscan', url: 'https://etherscan.io' },
  },
} as const

// Base mainnet (alternative for funding)
export const base = {
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://mainnet.base.org'] },
  },
  blockExplorers: {
    default: { name: 'BaseScan', url: 'https://basescan.org' },
  },
} as const

// Privy configuration
export const privyConfig = {
  appId: import.meta.env.VITE_PRIVY_APP_ID || 'local-dev-app-id',
  config: {
    loginMethods: ['email' as const, 'wallet' as const, 'sms' as const],
    appearance: {
      theme: 'dark' as const,
      accentColor: '#627eea' as `#${string}`,
      logo: undefined,
    },
    embeddedWallets: {
      createOnLogin: 'all-users' as const, // Create embedded wallet for all users for gasless transactions
      requireUserPasswordOnCreate: false,
      noPromptOnSignature: false, // Allow signature prompts
      showWalletUIs: true, // Show wallet UIs for embedded wallets
    },
    externalWallets: {
      metamask: true,
      coinbaseWallet: true,
      walletConnect: true,
    },
    supportedChains: [localChain, mainnet, base],
    defaultChain: localChain,
    // Additional wallet options
    mfa: {
      noPromptOnMfaRequired: false,
    },
    // Legal config
    legal: {
      termsAndConditionsUrl: '',
      privacyPolicyUrl: '',
    },
  },
}

// Contract addresses from deployment (deployed-addresses.json)
export const CONTRACT_ADDRESSES = {
  CARD_REGISTRY: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as `0x${string}`,
  DECK_REGISTRY: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as `0x${string}`,
  GAME_ENGINE: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as `0x${string}`,
} as const