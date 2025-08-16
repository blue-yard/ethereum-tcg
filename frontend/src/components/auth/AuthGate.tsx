import { usePrivy, useLogin, useFundWallet } from '@privy-io/react-auth'
import type { ReactNode } from 'react'
import { LoadingScreen } from '@/components/ui/LoadingSpinner'
import { FadeInUp, ScaleIn } from '@/components/ui/PageTransition'

interface AuthGateProps {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const { ready, authenticated, user } = usePrivy()
  const { fundWallet } = useFundWallet()
  
  const { login } = useLogin({
    onComplete: ({ user, isNewUser, wasAlreadyAuthenticated }) => {
      console.log('Login completed:', { user, isNewUser, wasAlreadyAuthenticated, wallet: user.wallet })
      console.log('Wallet client type:', user.wallet?.walletClientType)
      
      // Automatically prompt new users to fund their embedded wallet for gas fees
      if (isNewUser && user.wallet?.walletClientType === 'privy') {
        console.log('Triggering funding for new Privy user:', user.wallet.address)
        fundWallet(user.wallet.address).catch(error => {
          console.error('Funding failed:', error)
        })
      } else {
        console.log('Funding not triggered:', { isNewUser, walletClientType: user.wallet?.walletClientType })
      }
    }
  })
  
  // Manual test function with better configuration
  const testFunding = async () => {
    if (user?.wallet?.address) {
      console.log('Testing manual funding for:', user.wallet.address)
      try {
        // Try funding on Base (more dev-friendly)
        await fundWallet(user.wallet.address, {
          chain: { id: 8453, name: 'base' },
          funding_amount_usd: 5 // Small amount for testing
        })
      } catch (error) {
        console.error('Base funding failed, trying default:', error)
        try {
          // Fallback to default funding
          await fundWallet(user.wallet.address)
        } catch (fallbackError) {
          console.error('All funding attempts failed:', fallbackError)
        }
      }
    }
  }

  if (!ready) {
    return <LoadingScreen message="Initializing Web3..." />
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-eth-dark flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <FadeInUp className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              Ethereum TCG
            </h1>
            <p className="text-gray-400">
              The next generation trading card game on Ethereum
            </p>
          </FadeInUp>
          
          <ScaleIn delay={0.2}>
            <div className="card p-8">
              <h2 className="text-2xl font-semibold text-white mb-6 text-center">
                Connect to Play
              </h2>
              
              <button
                onClick={login}
                className="btn-primary w-full py-3 text-lg font-medium hover:scale-105 transition-transform"
              >
                Connect Wallet
              </button>
              
              <p className="text-sm text-gray-400 text-center mt-4">
                Connect your wallet to start playing and collecting NFT cards
              </p>
            </div>
          </ScaleIn>
        </div>
      </div>
    )
  }

  // Dev helper - fund local account with Anvil
  const fundLocalAccount = async () => {
    if (user?.wallet?.address) {
      console.log('Funding local account with Anvil...')
      try {
        // Use Anvil to fund the account with ETH on local chain
        const response = await fetch('http://localhost:8545', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'anvil_setBalance',
            params: [user.wallet.address, '0x21E19E0C9BAB2400000'], // 10 ETH in wei
            id: 1
          })
        })
        const result = await response.json()
        console.log('Local funding result:', result)
        if (!result.error) {
          alert('✅ Funded with 10 ETH on local chain! Try your transaction again.')
        }
      } catch (error) {
        console.error('Local funding failed:', error)
      }
    }
  }

  if (authenticated && user?.wallet?.walletClientType === 'privy') {
    return (
      <>
        {children}
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          <button
            onClick={testFunding}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Fund Wallet (Mainnet)
          </button>
          <button
            onClick={fundLocalAccount}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Fund Local Dev (10 ETH)
          </button>
        </div>
      </>
    )
  }

  return <>{children}</>
}